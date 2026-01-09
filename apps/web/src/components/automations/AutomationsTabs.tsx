'use client';

import { motion } from 'framer-motion';

interface AutomationsTabsProps {
  activeTab: 'alerts' | 'actions' | 'channels';
  onTabChange: (tab: 'alerts' | 'actions' | 'channels') => void;
  alertsCount?: number;
  actionsCount?: number;
  channelsCount?: number;
}

export function AutomationsTabs({
  activeTab,
  onTabChange,
  alertsCount,
  actionsCount,
  channelsCount,
}: AutomationsTabsProps) {
  const tabs = [
    {
      id: 'alerts' as const,
      label: 'Alerts',
      count: alertsCount,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      description: 'Condition-based notifications',
    },
    {
      id: 'actions' as const,
      label: 'Actions',
      count: actionsCount,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      description: 'Serverless code execution',
    },
    {
      id: 'channels' as const,
      label: 'Channels',
      count: channelsCount,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      description: 'Notification destinations',
    },
  ];

  return (
    <div className="relative">
      {/* Tab Container */}
      <div className="flex gap-2 p-1 rounded-xl bg-dark-800/50 border border-dark-700/50 backdrop-blur-sm">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex items-center gap-2.5 px-5 py-3 rounded-lg text-sm font-medium
                transition-all duration-300 ease-out
                ${isActive
                  ? 'text-white'
                  : 'text-dark-400 hover:text-dark-200 hover:bg-dark-700/30'
                }
              `}
            >
              {/* Active Background */}
              {isActive && (
                <motion.div
                  layoutId="activeTabBg"
                  className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary-500/20 to-primary-600/10 border border-primary-500/30"
                  style={{ boxShadow: '0 0 20px rgba(23, 133, 130, 0.15)' }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                />
              )}

              {/* Content */}
              <span className="relative z-10 flex items-center gap-2.5">
                <span className={`transition-colors duration-300 ${isActive ? 'text-primary-400' : ''}`}>
                  {tab.icon}
                </span>
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className={`
                      px-2 py-0.5 text-xs font-semibold rounded-full
                      transition-all duration-300
                      ${isActive
                        ? 'bg-primary-500/20 text-primary-300'
                        : 'bg-dark-700 text-dark-400'
                      }
                    `}
                  >
                    {tab.count}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Decorative Glow Line */}
      <div className="absolute -bottom-px left-0 right-0 h-px">
        <motion.div
          className="h-full bg-gradient-to-r from-transparent via-primary-500/50 to-transparent"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
        />
      </div>
    </div>
  );
}
