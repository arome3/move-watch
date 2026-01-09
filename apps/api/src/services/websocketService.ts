/**
 * WebSocket Service for Real-Time Alerts
 *
 * Provides real-time notifications to connected clients when alerts trigger.
 * Clients can subscribe to specific alerts or receive all alerts.
 */

import WebSocket from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { NotificationPayload } from '@movewatch/shared';

// Type alias for the WebSocket Server instance
type WSSInstance = InstanceType<typeof WebSocket.Server>;

// Message types
interface WSMessage {
  type: 'subscribe' | 'unsubscribe' | 'ping' | 'auth';
  payload?: unknown;
}

interface WSSubscription {
  alertIds?: string[];      // Subscribe to specific alerts
  actionIds?: string[];     // Subscribe to specific action executions
  networks?: string[];      // Subscribe to alerts from specific networks
  all?: boolean;            // Subscribe to all alerts and actions
}

interface ConnectedClient {
  ws: WebSocket;
  userId?: string;
  subscriptions: WSSubscription;
  lastPing: number;
}

// Singleton WebSocket server instance
let wss: WSSInstance | null = null;
const clients: Map<WebSocket, ConnectedClient> = new Map();

// Heartbeat interval (30 seconds)
const HEARTBEAT_INTERVAL = 30000;
const CLIENT_TIMEOUT = 60000;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(server: Server): WSSInstance {
  if (wss) {
    console.log('WebSocket server already initialized');
    return wss;
  }

  wss = new WebSocket.Server({
    server,
    path: '/ws/alerts',
  });

  console.log('WebSocket server initialized on /ws/alerts');

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage) => {
    console.log('New WebSocket connection');

    // Initialize client state
    const client: ConnectedClient = {
      ws,
      subscriptions: { all: true }, // Default to all alerts
      lastPing: Date.now(),
    };
    clients.set(ws, client);

    // Send welcome message
    sendToClient(ws, {
      type: 'connected',
      message: 'Connected to MoveWatch real-time alerts',
      timestamp: new Date().toISOString(),
    });

    // Handle incoming messages
    ws.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        handleMessage(ws, message);
      } catch (error) {
        sendToClient(ws, {
          type: 'error',
          message: 'Invalid message format',
        });
      }
    });

    // Handle disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });

    // Handle errors
    ws.on('error', (error: Error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });

    // Handle pong (heartbeat response)
    ws.on('pong', () => {
      const client = clients.get(ws);
      if (client) {
        client.lastPing = Date.now();
      }
    });
  });

  // Start heartbeat interval
  setInterval(() => {
    const now = Date.now();
    clients.forEach((client, ws) => {
      if (now - client.lastPing > CLIENT_TIMEOUT) {
        console.log('Terminating inactive WebSocket client');
        ws.terminate();
        clients.delete(ws);
        return;
      }

      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    });
  }, HEARTBEAT_INTERVAL);

  return wss;
}

/**
 * Handle incoming WebSocket message
 */
function handleMessage(ws: WebSocket, message: WSMessage): void {
  const client = clients.get(ws);
  if (!client) return;

  switch (message.type) {
    case 'subscribe':
      handleSubscribe(client, message.payload as WSSubscription);
      sendToClient(ws, {
        type: 'subscribed',
        subscriptions: client.subscriptions,
      });
      break;

    case 'unsubscribe':
      handleUnsubscribe(client, message.payload as WSSubscription);
      sendToClient(ws, {
        type: 'unsubscribed',
        subscriptions: client.subscriptions,
      });
      break;

    case 'ping':
      client.lastPing = Date.now();
      sendToClient(ws, { type: 'pong', timestamp: Date.now() });
      break;

    case 'auth':
      // Simple token-based auth (could be expanded)
      const authPayload = message.payload as { userId?: string };
      if (authPayload?.userId) {
        client.userId = authPayload.userId;
        sendToClient(ws, { type: 'authenticated', userId: client.userId });
      }
      break;

    default:
      sendToClient(ws, {
        type: 'error',
        message: `Unknown message type: ${message.type}`,
      });
  }
}

/**
 * Handle subscription request
 */
function handleSubscribe(client: ConnectedClient, subscription: WSSubscription): void {
  if (!subscription) return;

  if (subscription.all) {
    client.subscriptions.all = true;
  }

  if (subscription.alertIds) {
    client.subscriptions.alertIds = [
      ...(client.subscriptions.alertIds || []),
      ...subscription.alertIds,
    ];
  }

  if (subscription.actionIds) {
    client.subscriptions.actionIds = [
      ...(client.subscriptions.actionIds || []),
      ...subscription.actionIds,
    ];
  }

  if (subscription.networks) {
    client.subscriptions.networks = [
      ...(client.subscriptions.networks || []),
      ...subscription.networks,
    ];
  }
}

/**
 * Handle unsubscribe request
 */
function handleUnsubscribe(client: ConnectedClient, subscription: WSSubscription): void {
  if (!subscription) return;

  if (subscription.all) {
    client.subscriptions.all = false;
  }

  if (subscription.alertIds && client.subscriptions.alertIds) {
    client.subscriptions.alertIds = client.subscriptions.alertIds.filter(
      (id) => !subscription.alertIds!.includes(id)
    );
  }

  if (subscription.actionIds && client.subscriptions.actionIds) {
    client.subscriptions.actionIds = client.subscriptions.actionIds.filter(
      (id) => !subscription.actionIds!.includes(id)
    );
  }

  if (subscription.networks && client.subscriptions.networks) {
    client.subscriptions.networks = client.subscriptions.networks.filter(
      (n) => !subscription.networks!.includes(n)
    );
  }
}

/**
 * Send message to a specific client
 */
function sendToClient(ws: WebSocket, data: unknown): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

/**
 * Broadcast alert to all subscribed clients
 */
export function broadcastAlert(
  alertId: string,
  network: string,
  payload: NotificationPayload
): void {
  if (!wss) {
    console.log('WebSocket server not initialized, skipping broadcast');
    return;
  }

  const message = {
    type: 'alert',
    alertId,
    network,
    payload,
    timestamp: new Date().toISOString(),
  };

  let sentCount = 0;

  clients.forEach((client, ws) => {
    if (!shouldReceiveAlert(client, alertId, network)) {
      return;
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      sentCount++;
    }
  });

  if (sentCount > 0) {
    console.log(`[WebSocket] Broadcast alert ${alertId} to ${sentCount} clients`);
  }
}

/**
 * Action execution payload for WebSocket broadcast
 */
export interface ActionExecutionBroadcast {
  actionId: string;
  executionId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT';
  network: string;
  triggerType: string;
  durationMs?: number;
  output?: unknown;
  error?: { message: string; stack?: string };
  logs?: string[];
}

/**
 * Broadcast action execution update to subscribed clients
 */
export function broadcastActionExecution(
  payload: ActionExecutionBroadcast
): void {
  if (!wss) {
    console.log('WebSocket server not initialized, skipping action broadcast');
    return;
  }

  const message = {
    type: 'action_execution',
    ...payload,
    timestamp: new Date().toISOString(),
  };

  let sentCount = 0;

  clients.forEach((client, ws) => {
    if (!shouldReceiveAction(client, payload.actionId, payload.network)) {
      return;
    }

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
      sentCount++;
    }
  });

  if (sentCount > 0) {
    console.log(
      `[WebSocket] Broadcast action execution ${payload.executionId} (${payload.status}) to ${sentCount} clients`
    );
  }
}

/**
 * Check if a client should receive an action execution based on subscriptions
 */
function shouldReceiveAction(
  client: ConnectedClient,
  actionId: string,
  network: string
): boolean {
  const { subscriptions } = client;

  // If subscribed to all, receive everything
  if (subscriptions.all) {
    return true;
  }

  // Check specific action subscription
  if (subscriptions.actionIds?.includes(actionId)) {
    return true;
  }

  // Check network subscription
  if (subscriptions.networks?.includes(network)) {
    return true;
  }

  return false;
}

/**
 * Check if a client should receive an alert based on subscriptions
 */
function shouldReceiveAlert(
  client: ConnectedClient,
  alertId: string,
  network: string
): boolean {
  const { subscriptions } = client;

  // If subscribed to all, receive everything
  if (subscriptions.all) {
    return true;
  }

  // Check specific alert subscription
  if (subscriptions.alertIds?.includes(alertId)) {
    return true;
  }

  // Check network subscription
  if (subscriptions.networks?.includes(network)) {
    return true;
  }

  return false;
}

/**
 * Broadcast transaction metrics update
 */
export function broadcastMetricsUpdate(
  network: string,
  moduleAddress: string,
  metrics: {
    totalTransactions: number;
    failedTransactions: number;
    failureRate: number;
  }
): void {
  if (!wss) return;

  const message = {
    type: 'metrics',
    network,
    moduleAddress,
    metrics,
    timestamp: new Date().toISOString(),
  };

  clients.forEach((client, ws) => {
    if (ws.readyState === WebSocket.OPEN && client.subscriptions.all) {
      ws.send(JSON.stringify(message));
    }
  });
}

/**
 * Get WebSocket server stats
 */
export function getWebSocketStats(): {
  connected: number;
  authenticated: number;
} {
  let authenticated = 0;
  clients.forEach((client) => {
    if (client.userId) authenticated++;
  });

  return {
    connected: clients.size,
    authenticated,
  };
}

/**
 * Gracefully close all connections
 */
export function closeAllConnections(): void {
  clients.forEach((client, ws) => {
    sendToClient(ws, {
      type: 'closing',
      message: 'Server shutting down',
    });
    ws.close();
  });
  clients.clear();

  if (wss) {
    wss.close();
    wss = null;
  }
}
