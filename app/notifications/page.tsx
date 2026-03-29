'use client';
import { useEffect, useState } from 'react';

const ICONS: Record<string, string> = {
  info: 'ℹ️',
  warning: '⚠️',
  error: '❌',
  success: '✅',
};

export default function Notifications() {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);


  if (!data) return <div className="p-8 text-gray-400 text-center">Loading notifications…</div>;

  // Mock notifications for local testing if backend returns none
  let notifications = data.notifications || [];
  if (notifications.length === 0 && process.env.NODE_ENV !== 'production') {
    notifications = [
      { type: 'info', title: 'Welcome!', message: 'You have joined the project.', timestamp: new Date().toISOString(), read: false },
      { type: 'success', title: 'Sync Complete', message: 'GitHub data synced successfully.', timestamp: new Date().toISOString(), read: true },
      { type: 'warning', title: 'Blocked Issue', message: 'Some issues are blocked.', timestamp: new Date().toISOString(), read: false },
      { type: 'error', title: 'API Error', message: 'Failed to fetch releases.', timestamp: new Date().toISOString(), read: false },
    ];
  }

  return (
    <div className="p-6 min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="inline-block w-7 h-7 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 text-xl">🔔</span>
          Notifications
        </h1>
        {notifications.length === 0 ? (
          <div className="bg-white rounded-xl shadow p-8 text-gray-400 text-center">
            No notifications found.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {notifications.map((n: any, idx: number) => (
              <div key={idx} className={`flex items-start gap-4 bg-white rounded-xl shadow-md p-4 border-l-4 transition-all duration-200 ${
                n.type === 'error' ? 'border-red-400' :
                n.type === 'warning' ? 'border-yellow-400' :
                n.type === 'success' ? 'border-green-400' :
                'border-indigo-400'
              }`}>
                <span className="text-2xl mt-1">{ICONS[n.type] || '🔔'}</span>
                <div className="flex-1">
                  <div className="font-medium text-slate-900 mb-1 flex items-center gap-2">
                    {n.title || (n.type ? `${n.type.replace('_', ' ')} notification` : 'Notification')}
                    {(n.read === false || n.read === 'false') && <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-indigo-100 text-indigo-700 font-semibold">New</span>}
                  </div>
                  <div className="text-sm text-gray-600 mb-1">{n.message || 'No details available.'}</div>
                  {n.timestamp && (
                    <div className="text-xs text-gray-400 mt-1">{new Date(n.timestamp).toLocaleString()}</div>
                  )}
                </div>
                {/* Optionally, add a mark as read/clear button here */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
