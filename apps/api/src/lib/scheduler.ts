/**
 * Scheduler Library
 *
 * Wraps node-cron for managing scheduled action triggers.
 * Handles cron job lifecycle, validation, and timezone support.
 */

import cron, { ScheduledTask } from 'node-cron';
import { queueExecution, getScheduleActions } from '../services/actionProcessor.js';
import { checkCooldown } from '../services/actions.js';
import type { Network, ScheduleTriggerConfig } from '@movewatch/shared';

// Store active cron jobs keyed by actionId
const activeJobs: Map<string, ScheduledTask> = new Map();

// Scheduler state per network
const runningNetworks: Set<Network> = new Set();
const refreshIntervals: Map<Network, ReturnType<typeof setInterval>> = new Map();

// How often to refresh schedules from database (5 minutes)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Validate a cron expression
 */
export function validateCron(expression: string): boolean {
  return cron.validate(expression);
}

/**
 * Get human-readable description of next execution time
 */
export function getNextExecutionTime(expression: string, timezone?: string): Date | null {
  try {
    // node-cron doesn't have a built-in way to get next execution
    // Use a simple calculation based on the expression
    const task = cron.schedule(expression, () => {}, {
      scheduled: false,
      timezone,
    });

    // We can't easily get next execution from node-cron
    // Return null and let the frontend calculate if needed
    task.stop();
    return null;
  } catch {
    return null;
  }
}

/**
 * Schedule a single action
 */
export function scheduleAction(
  actionId: string,
  config: ScheduleTriggerConfig,
  network: Network
): boolean {
  // Stop existing job if any
  unscheduleAction(actionId);

  if (!validateCron(config.cron)) {
    console.error(`[Scheduler] Invalid cron expression for action ${actionId}: ${config.cron}`);
    return false;
  }

  try {
    const task = cron.schedule(
      config.cron,
      async () => {
        console.log(`[Scheduler] Triggering scheduled action ${actionId}`);

        try {
          // Check cooldown before queuing
          const canExecute = await checkCooldown(actionId);
          if (!canExecute) {
            console.log(`[Scheduler] Action ${actionId} is in cooldown, skipping`);
            return;
          }

          // Queue execution
          const executionId = await queueExecution(actionId, {
            type: 'schedule',
            cron: config.cron,
            timezone: config.timezone,
            triggeredAt: new Date().toISOString(),
          });

          console.log(`[Scheduler] Queued execution ${executionId} for action ${actionId}`);
        } catch (error) {
          console.error(`[Scheduler] Failed to queue action ${actionId}:`, error);
        }
      },
      {
        scheduled: true,
        timezone: config.timezone || 'UTC',
      }
    );

    activeJobs.set(actionId, task);
    console.log(`[Scheduler] Scheduled action ${actionId} with cron: ${config.cron} (${config.timezone || 'UTC'})`);
    return true;
  } catch (error) {
    console.error(`[Scheduler] Failed to schedule action ${actionId}:`, error);
    return false;
  }
}

/**
 * Unschedule an action
 */
export function unscheduleAction(actionId: string): void {
  const task = activeJobs.get(actionId);
  if (task) {
    task.stop();
    activeJobs.delete(actionId);
    console.log(`[Scheduler] Unscheduled action ${actionId}`);
  }
}

/**
 * Refresh all schedules from database
 */
export async function refreshSchedules(network: Network): Promise<void> {
  console.log(`[Scheduler] Refreshing schedules for ${network}...`);

  try {
    // Get all enabled schedule actions
    const actions = await getScheduleActions(network);
    console.log(`[Scheduler] Found ${actions.length} schedule actions for ${network}:`, actions.map(a => ({ id: a.id, name: a.name, enabled: a.enabled })));

    // Track which actions are still active
    const activeActionIds = new Set<string>();

    // Schedule or update each action
    for (const action of actions) {
      const config = action.triggerConfig as unknown as ScheduleTriggerConfig;
      activeActionIds.add(action.id);
      scheduleAction(action.id, config, network);
    }

    // Stop jobs for actions that no longer exist or are disabled
    for (const [actionId] of activeJobs) {
      if (!activeActionIds.has(actionId)) {
        unscheduleAction(actionId);
      }
    }

    console.log(`[Scheduler] Active schedules: ${activeJobs.size}`);
  } catch (error) {
    console.error('[Scheduler] Failed to refresh schedules:', error);
  }
}

/**
 * Start the scheduler for a network
 */
export async function startScheduler(network: Network): Promise<void> {
  if (runningNetworks.has(network)) {
    console.warn(`[Scheduler] Already running for ${network}`);
    return;
  }

  runningNetworks.add(network);
  console.log(`[Scheduler] Starting for ${network}...`);

  // Initial load of schedules
  await refreshSchedules(network);

  // Periodically refresh schedules to pick up changes
  const interval = setInterval(() => {
    if (runningNetworks.has(network)) {
      refreshSchedules(network);
    }
  }, REFRESH_INTERVAL_MS);
  refreshIntervals.set(network, interval);

  console.log(`[Scheduler] Started ${network} with ${activeJobs.size} total active schedules`);
}

/**
 * Stop the scheduler for all networks
 */
export function stopScheduler(): void {
  if (runningNetworks.size === 0) {
    return;
  }

  console.log('[Scheduler] Stopping all schedulers...');

  // Stop all refresh intervals
  for (const [network, interval] of refreshIntervals) {
    clearInterval(interval);
    console.log(`[Scheduler] Stopped refresh for ${network}`);
  }
  refreshIntervals.clear();
  runningNetworks.clear();

  // Stop all active jobs
  for (const [actionId, task] of activeJobs) {
    task.stop();
    console.log(`[Scheduler] Stopped job for action ${actionId}`);
  }
  activeJobs.clear();

  console.log('[Scheduler] All schedulers stopped');
}

/**
 * Stop the scheduler for a specific network
 */
export function stopSchedulerForNetwork(network: Network): void {
  if (!runningNetworks.has(network)) {
    return;
  }

  console.log(`[Scheduler] Stopping scheduler for ${network}...`);

  // Stop refresh interval for this network
  const interval = refreshIntervals.get(network);
  if (interval) {
    clearInterval(interval);
    refreshIntervals.delete(network);
  }
  runningNetworks.delete(network);

  // Note: We don't stop individual jobs here because we'd need to track
  // which jobs belong to which network. Jobs will be cleaned up on next refresh
  // when the action is no longer in the active list.

  console.log(`[Scheduler] Stopped scheduler for ${network}`);
}

/**
 * Get scheduler statistics
 */
export function getSchedulerStats(): {
  running: boolean;
  activeNetworks: Network[];
  activeJobs: number;
  jobIds: string[];
} {
  return {
    running: runningNetworks.size > 0,
    activeNetworks: Array.from(runningNetworks),
    activeJobs: activeJobs.size,
    jobIds: Array.from(activeJobs.keys()),
  };
}

/**
 * Common cron presets for UI
 */
export const cronPresets = {
  everyMinute: '* * * * *',
  every5Minutes: '*/5 * * * *',
  every15Minutes: '*/15 * * * *',
  everyHour: '0 * * * *',
  everyDay: '0 0 * * *',
  everyWeek: '0 0 * * 0',
  everyMonth: '0 0 1 * *',
};

/**
 * Describe a cron expression in human-readable format
 */
export function describeCron(expression: string): string {
  const parts = expression.split(' ');
  if (parts.length !== 5) {
    return 'Invalid cron expression';
  }

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  // Common patterns
  if (expression === cronPresets.everyMinute) {
    return 'Every minute';
  }
  if (expression === cronPresets.every5Minutes) {
    return 'Every 5 minutes';
  }
  if (expression === cronPresets.every15Minutes) {
    return 'Every 15 minutes';
  }
  if (expression === cronPresets.everyHour) {
    return 'Every hour at minute 0';
  }
  if (expression === cronPresets.everyDay) {
    return 'Every day at midnight';
  }
  if (expression === cronPresets.everyWeek) {
    return 'Every Sunday at midnight';
  }
  if (expression === cronPresets.everyMonth) {
    return 'First day of every month at midnight';
  }

  // Generic description
  if (minute.startsWith('*/')) {
    return `Every ${minute.slice(2)} minutes`;
  }
  if (hour.startsWith('*/')) {
    return `Every ${hour.slice(2)} hours`;
  }

  return `${minute} ${hour} ${dayOfMonth} ${month} ${dayOfWeek}`;
}
