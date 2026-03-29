'use client';
import { useEffect, useState, useMemo } from 'react';

const EVENT_CONFIG: Record<string, { icon: string; color: string; accent: string; bg: string }> = {
  issue_created: { icon: '✦', color: '#10b981', accent: '#d1fae5', bg: '#ecfdf5' },
  issue_closed:  { icon: '✔',  color: '#6366f1', accent: '#e0e7ff', bg: '#eef2ff' },
  issue_blocked: { icon: '⊘',  color: '#ef4444', accent: '#fee2e2', bg: '#fef2f2' },
  comment_added: { icon: '💬', color: '#f59e0b', accent: '#fef3c7', bg: '#fffbeb' },
  success:       { icon: '✔',  color: '#6366f1', accent: '#e0e7ff', bg: '#eef2ff' },
  warning:       { icon: '⚠',  color: '#f59e0b', accent: '#fef3c7', bg: '#fffbeb' },
  error:         { icon: '✕',  color: '#ef4444', accent: '#fee2e2', bg: '#fef2f2' },
  info:          { icon: 'ℹ',  color: '#0ea5e9', accent: '#e0f2fe', bg: '#f0f9ff' },
};

function getConfig(event_type: string) {
  return EVENT_CONFIG[event_type] || EVENT_CONFIG['info'];
}

function formatDate(ts: string) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const FILTER_OPTIONS = [
  { key: 'all',           label: 'All' },
  { key: 'issue_created', label: 'Created' },
  { key: 'issue_closed',  label: 'Closed' },
  { key: 'issue_blocked', label: 'Blocked' },
  { key: 'comment_added', label: 'Comments' },
];

export default function Notifications() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => { setNotifications(d.notifications || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filter, showUnreadOnly]);

  const markAllRead = () => {
    setReadIds(new Set(notifications.map(n => n.id)));
  };

  const markRead = (id: string) => {
    setReadIds(prev => new Set([...prev, id]));
  };

  const isRead = (n: any) => n.read || readIds.has(n.id);

  const filtered = useMemo(() => {
    return notifications.filter(n => {
      if (showUnreadOnly && isRead(n)) return false;
      if (filter !== 'all' && n.event_type !== filter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (n.title + n.message + (n.product || '') + (n.assignee || '')).toLowerCase().includes(q);
      }
      return true;
    });
  }, [notifications, filter, search, showUnreadOnly, readIds]);

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage]);

  const unreadCount = notifications.filter(n => !isRead(n)).length;

  // Group by date
  const grouped = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const n of paginated) {
      const label = n.timestamp ? formatDate(n.timestamp) : 'Unknown date';
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    }
    return Object.entries(groups);
  }, [paginated]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)' }}>

      {/* ── TOPBAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', height: '58px', gap: '12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '18px' }}>🔔</span>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.025em' }}>
            Notifications
          </h1>
          {unreadCount > 0 && (
            <span style={{
              background: '#ef4444', color: 'white', fontSize: '11px',
              fontWeight: 700, padding: '2px 7px', borderRadius: '999px',
            }}>
              {unreadCount}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notifications..."
            style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: '9px',
              color: 'white', fontSize: '12px', padding: '7px 12px', outline: 'none', width: '200px',
            }}
          />
          <button
            onClick={() => setShowUnreadOnly(p => !p)}
            style={{
              background: showUnreadOnly ? '#6366f1' : '#1e293b',
              border: '1px solid ' + (showUnreadOnly ? '#6366f1' : '#334155'),
              borderRadius: '9px', color: 'white', fontSize: '12px',
              fontWeight: 500, padding: '7px 14px', cursor: 'pointer',
            }}
          >
            {showUnreadOnly ? 'Unread only' : 'All'}
          </button>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                border: 'none', borderRadius: '9px', color: 'white',
                fontSize: '12px', fontWeight: 600, padding: '7px 16px',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
              }}
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
          {FILTER_OPTIONS.map(f => {
            const active = filter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                style={{
                  padding: '6px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', border: 'none', transition: 'all 0.15s',
                  background: active ? '#0f172a' : 'white',
                  color: active ? 'white' : '#64748b',
                  boxShadow: active ? '0 4px 12px rgba(15,23,42,0.18)' : '0 1px 3px rgba(0,0,0,0.08)',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: '15px' }}>
            Loading notifications…
          </div>
        ) : filtered.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            background: 'white', borderRadius: '20px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
            <div style={{ fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>All caught up!</div>
            <div style={{ fontSize: '14px', color: '#94a3b8', marginTop: '6px' }}>No notifications match your filter.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {grouped.map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {/* Date divider */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px',
                }}>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                  <span style={{
                    fontSize: '12px', fontWeight: 700, color: '#64748b',
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                    background: '#f1f5f9', padding: '3px 12px', borderRadius: '999px',
                  }}>
                    {dateLabel}
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#e2e8f0' }} />
                </div>

                {/* Notification cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {items.map((n: any) => {
                    const cfg = getConfig(n.event_type);
                    const read = isRead(n);
                    return (
                      <div
                        key={n.id}
                        onClick={() => {
                          markRead(n.id);
                          if (n.github_url) window.open(n.github_url, '_blank');
                        }}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '16px',
                          background: read ? 'white' : cfg.bg,
                          border: `1px solid ${read ? '#e2e8f0' : cfg.accent}`,
                          borderLeft: `4px solid ${cfg.color}`,
                          borderRadius: '14px',
                          padding: '16px 20px',
                          cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          boxShadow: read ? '0 1px 4px rgba(0,0,0,0.05)' : '0 4px 16px rgba(0,0,0,0.08)',
                          opacity: read ? 0.75 : 1,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 10px 25px rgba(0,0,0,0.1)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = read ? '0 1px 4px rgba(0,0,0,0.05)' : '0 4px 16px rgba(0,0,0,0.08)';
                        }}
                      >
                        {/* Icon badge */}
                        <div style={{
                          width: '38px', height: '38px', borderRadius: '12px', flexShrink: 0,
                          background: cfg.accent, display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: '16px', color: cfg.color,
                          fontWeight: 700,
                        }}>
                          {cfg.icon}
                        </div>

                        {/* Content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>
                              {n.title}
                            </span>
                            {!read && (
                              <span style={{
                                background: cfg.color, color: 'white',
                                fontSize: '10px', fontWeight: 700,
                                padding: '2px 7px', borderRadius: '999px',
                              }}>
                                NEW
                              </span>
                            )}
                            {n.issue_number && (
                              <span style={{
                                fontSize: '11px', color: '#6366f1', fontWeight: 600,
                                background: '#eef2ff', padding: '2px 8px', borderRadius: '6px',
                              }}>
                                #{n.issue_number}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
                            {n.message}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                            {n.product && (
                              <span style={{
                                fontSize: '11px', color: '#64748b', fontWeight: 500,
                                background: '#f1f5f9', padding: '2px 8px', borderRadius: '6px',
                              }}>
                                {n.product}
                              </span>
                            )}
                            {n.assignee && (
                              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                👤 {n.assignee}
                              </span>
                            )}
                            {n.time_ago && (
                              <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: 'auto' }}>
                                {n.time_ago}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          }
        </div>
      )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '20px',
            marginTop: '40px', paddingBottom: '20px'
          }}>
            <button
              disabled={currentPage === 1}
              onClick={() => { setCurrentPage(p => p - 1); window.scrollTo(0, 0); }}
              style={{
                padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer', border: '1px solid #e2e8f0',
                background: 'white', color: currentPage === 1 ? '#cbd5e1' : '#1e293b',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
            >
              ← Previous
            </button>

            <span style={{ fontSize: '13px', color: '#64748b', fontWeight: 500 }}>
              Page <span style={{ color: '#0f172a', fontWeight: 700 }}>{currentPage}</span> of {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => { setCurrentPage(p => p + 1); window.scrollTo(0, 0); }}
              style={{
                padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: 600,
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', border: '1px solid #e2e8f0',
                background: 'white', color: currentPage === totalPages ? '#cbd5e1' : '#1e293b',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                transition: 'all 0.2s'
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
