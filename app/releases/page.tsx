'use client';
import { useEffect, useMemo, useState } from 'react';

export default function Releases() {
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [newRelease, setNewRelease] = useState({ product_id: '', title: '', due_date: '', description: '' });
  const [creating, setCreating] = useState(false);

  const loadData = async () => {
    const dashboard = await fetch('/api/dashboard').then(r => r.json());
    setData(dashboard);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredMilestones = useMemo(() => {
    if (!data?.milestones) return [];
    return product === 'all'
      ? data.milestones
      : data.milestones.filter((m: any) => m.product_id === product);
  }, [data, product]);

  const releaseStats = useMemo(() => {
    const milestones = filteredMilestones;
    const issues = data?.issues || [];
    const totalIssues = issues.length;
    const closedIssues = issues.filter((i: any) => i.status === 'closed').length;
    const blockedIssues = issues.filter((i: any) => i.status === 'blocked').length;
    const percentComplete = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;
    return { totalMilestones: milestones.length, totalIssues, closedIssues, blockedIssues, percentComplete };
  }, [filteredMilestones, data]);

  const syncData = async () => {
    setIsSyncing(true);
    await fetch('/api/sync', { method: 'POST' });
    await loadData();
    setIsSyncing(false);
  };

  const createRelease = async () => {
    if (!newRelease.product_id || !newRelease.title) return;
    setCreating(true);

    const res = await fetch('/api/releases/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newRelease),
    });

    if (res.ok) {
      setNewRelease({ product_id: '', title: '', due_date: '', description: '' });
      await syncData();
    } else {
      let errorPayload;
      try {
        errorPayload = await res.json();
      } catch {
        errorPayload = await res.text();
      }
      console.error('release create failed', errorPayload);
    }

    setCreating(false);
  };

  if (!data) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white text-slate-900 py-8">
      <div className="max-w-6xl mx-auto px-4">
        <style>{`
          .glass-card { background: rgba(255, 255, 255, 0.95); border: 1px solid rgba(148, 163, 184, 0.35); backdrop-filter: blur(6px); color: #1f2937; }
          .glass-card:hover { transform: translateY(-2px); }
          .glass-card h2, .glass-card p, .glass-card span, .glass-card button, .glass-card input, .glass-card select, .glass-card textarea { color: #1f2937; }
          .status-pill { font-size: 11px; font-weight: 700; letter-spacing: 0.03em; }
          .input-primary { background: rgba(255, 255, 255, 0.2); border: 1px solid #cbd5e1; color: #1f2937; }
          .input-primary:focus { border-color: #4f46e5; outline: none; box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.2); }
        `}</style>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Releases</h1>
          <p className="text-sm text-slate-600">Track milestones, view linked issues, and manage release workflow with quick actions.</p>
        </div>
        <div className="flex gap-2 items-center">
          <button
            onClick={syncData}
            disabled={isSyncing}
            className="text-xs tracking-wide rounded-lg bg-indigo-500 px-3 py-1.5 font-semibold text-white shadow-lg transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? 'Syncing...' : 'Sync Data'}
          </button>
        </div>
      </div>

      <div className="grid gap-3 mb-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs uppercase tracking-widest text-blue-100">Milestones</p>
          <p className="text-2xl font-bold text-white">{releaseStats.totalMilestones}</p>
        </div>
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs uppercase tracking-widest text-blue-100">Issues</p>
          <p className="text-2xl font-bold text-white">{releaseStats.totalIssues}</p>
        </div>
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs uppercase tracking-widest text-blue-100">Closed</p>
          <p className="text-2xl font-bold text-white">{releaseStats.closedIssues}</p>
        </div>
        <div className="rounded-xl glass-card p-4">
          <p className="text-xs uppercase tracking-widest text-blue-100">Blocked</p>
          <p className="text-2xl font-bold text-white">{releaseStats.blockedIssues}</p>
        </div>
      </div>

      <div className="p-4 rounded-xl glass-card mb-6 transition-transform duration-200">
        <h2 className="text-sm font-semibold mb-2 text-slate-900">Create New Release</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <select
            value={newRelease.product_id}
            onChange={e => setNewRelease({ ...newRelease, product_id: e.target.value })}
            className="input-primary rounded-lg px-3 py-2 text-sm"
          >
            <option value="">Select product</option>
            {data.products?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            value={newRelease.title}
            onChange={e => setNewRelease({ ...newRelease, title: e.target.value })}
            placeholder="Release name"
            className="input-primary rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="date"
            value={newRelease.due_date}
            onChange={e => setNewRelease({ ...newRelease, due_date: e.target.value })}
            className="input-primary rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={createRelease}
            disabled={creating || !newRelease.product_id || !newRelease.title}
            className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-400 disabled:opacity-60"
          >
            {creating ? 'Creating...' : 'Create Release'}
          </button>
        </div>
        <textarea
          value={newRelease.description}
          onChange={e => setNewRelease({ ...newRelease, description: e.target.value })}
          rows={2}
          placeholder="Description (optional)"
          className="input-primary mt-3 w-full rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600">Total releases: {filteredMilestones.length}</div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>Product:</span>
          <select
            value={product}
            onChange={e => setProduct(e.target.value)}
            className="rounded-lg border border-gray-300 bg-white px-2 py-1"
          >
            <option value="all">All</option>
            {data.products?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredMilestones.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-gray-500">
            No releases available yet. Use "Create New Release" and then sync.
          </div>
        ) : (
          filteredMilestones.map((m: any, idx: number) => {
            const prod = data.products?.find((p: any) => p.id === m.product_id);
            const milestoneIssues = data.issues?.filter((i: any) => i.milestone_id === m.id) || [];
            const statusMap: Record<string, number> = { open: 0, blocked: 0, closed: 0, 'in progress': 0 };
            milestoneIssues.forEach((i: any) => {
              statusMap[i.status] = (statusMap[i.status] || 0) + 1;
            });

            const isExpanded = expandedId === m.id;

            return (
              <div key={`${m.id}-${idx}`} className="rounded-xl glass-card p-4 shadow-lg transition-transform duration-200 hover:-translate-y-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-1 rounded-md text-xs font-medium" style={{ background: prod?.color + '33', color: prod?.color || '#1f2937' }}>
                        {prod?.name || 'Unknown'}
                      </span>
                      <h2 className="text-base font-semibold text-slate-900">{m.name}</h2>
                    </div>
                    <p className="mt-1 text-xs text-gray-500">Due: {m.due_date || 'Unscheduled'} | Status: {m.status}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : m.id)}
                      className="rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >{isExpanded ? 'Hide Issues' : 'View Issues'}</button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <div className="rounded-lg bg-gray-50 p-2 text-xs">
                    Total issues
                    <div className="text-sm font-semibold text-slate-900">{milestoneIssues.length}</div>
                  </div>
                  <div className="rounded-lg bg-blue-50 p-2 text-xs">
                    Open
                    <div className="text-sm font-semibold text-blue-700">{statusMap.open || 0}</div>
                  </div>
                  <div className="rounded-lg bg-red-50 p-2 text-xs">
                    Blocked
                    <div className="text-sm font-semibold text-red-700">{statusMap.blocked || 0}</div>
                  </div>
                  <div className="rounded-lg bg-emerald-50 p-2 text-xs">
                    Closed
                    <div className="text-sm font-semibold text-emerald-700">{statusMap.closed || 0}</div>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs text-gray-400 mb-1">Release progress</div>
                  <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                      style={{ width: `${milestoneIssues.length ? Math.round((statusMap.closed / milestoneIssues.length) * 100) : 0}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-300">
                    {milestoneIssues.length ? `${Math.round((statusMap.closed / milestoneIssues.length) * 100)}% complete` : 'No issue progress yet'}
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    <div className="mb-2 text-xs font-semibold text-gray-600">Issues in this release</div>
                    {milestoneIssues.length === 0 ? (
                      <div className="rounded-md border border-dashed border-gray-300 p-3 text-xs text-gray-500">No issues attached to this release yet.</div>
                    ) : (
                      <div className="space-y-2">
                        {milestoneIssues.map((issue: any) => (
                          <div key={issue.id} className="rounded-lg border border-gray-100 bg-slate-50 p-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-medium text-slate-900">#{issue.github_number} {issue.title}</span>
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                issue.status === 'closed' ? 'bg-emerald-100 text-emerald-700' :
                                issue.status === 'blocked' ? 'bg-red-100 text-red-700' :
                                issue.status === 'open' ? 'bg-blue-100 text-blue-700' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {issue.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-500">Assigned to: {issue.assignee || 'Unassigned'}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  </div>
  );
}
