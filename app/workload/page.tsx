'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function Workload() {
  const [data, setData] = useState<any>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedAssignee = searchParams.get('assignee') || '';

  useEffect(() => {
    fetch('/api/dashboard').then((r) => r.json()).then(setData);
  }, []);

  const [assigneeFilter, setAssigneeFilter] = useState<'all' | 'overloaded' | 'healthy' | 'free'>('all');
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<string>('all');

  const productIssues = useMemo(() => {
    if (!data?.issues) return [];
    if (selectedProduct === 'all') return data.issues;
    return data.issues.filter((i: any) => i.product_id?.toString() === selectedProduct.toString());
  }, [data?.issues, selectedProduct]);

  const derivedWorkload = useMemo(() => {
    if (!data?.workload) return [];

    // Base from team data (from API), ensure all members are present
    const map: Record<string, any> = {};
    data.workload.forEach((member: any) => {
      map[member.github_username] = {
        ...member,
        open_issues: 0,
        load_pct: 0,
      };
    });

    // Add product-specific issue counts per assignee
    productIssues
      .filter((issue: any) => issue.status !== 'closed')
      .forEach((issue: any) => {
        const username = issue.assignee || 'unknown';
        if (!map[username]) {
          map[username] = {
            id: `generated-${username}`,
            name: username,
            role: 'Contributor',
            github_username: username,
            open_issues: 0,
            load_pct: 0,
          };
        }
        map[username].open_issues += 1;
      });

    return Object.values(map).map((member: any) => ({
      ...member,
      open_issues: member.open_issues ?? 0,
      load_pct: Math.min(100, Math.round(((member.open_issues ?? 0) / 5) * 100)),
    }));
  }, [data?.workload, productIssues]);

  const filteredWorkload = useMemo(() => {
    return derivedWorkload.filter((m: any) => {
      const matchesSearch = m.name.toLowerCase().includes(assigneeSearch.toLowerCase()) || m.github_username.toLowerCase().includes(assigneeSearch.toLowerCase());
      const isFree = (m.open_issues ?? 0) === 0;
      const isOverloaded = m.load_pct >= 80;
      const isHealthy = !isFree && !isOverloaded;
      const matchesFilter = assigneeFilter === 'all'
        ? true
        : assigneeFilter === 'overloaded'
        ? isOverloaded
        : assigneeFilter === 'healthy'
        ? isHealthy
        : assigneeFilter === 'free'
        ? isFree
        : true;
      return matchesSearch && matchesFilter;
    });
  }, [derivedWorkload, assigneeFilter, assigneeSearch]);

  const summary = useMemo(() => {
    const total = filteredWorkload.length;
    const overloaded = filteredWorkload.filter((m: any) => m.load_pct >= 80).length;
    const healthy = filteredWorkload.filter((m: any) => m.open_issues === 0 || m.load_pct < 80).length;
    const open = data?.issues.filter((i: any) => i.status !== 'closed' && (selectedProduct === 'all' || i.product_id?.toString() === selectedProduct.toString())).length ?? 0;
    const avgLoad = total > 0 ? Math.round(filteredWorkload.reduce((sum: number, m: any) => sum + (m.load_pct || 0), 0) / total) : 0;
    return { total, overloaded, healthy, open, avgLoad };
  }, [filteredWorkload, data?.issues, selectedProduct]);

  if (!data) return <div className="p-8 text-sm text-gray-500">Loading workload...</div>;

  const activeCard = data.workload.find((m: any) => m.github_username === selectedAssignee);
  const activeIssues = selectedAssignee
    ? data.issues.filter((i: any) => i.assignee === selectedAssignee && i.status !== 'closed')
    : [];

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Team workload</h1>
          <p className="text-sm text-slate-500">Click rows to expand detail directly beneath each assignee.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={assigneeSearch}
            onChange={(e) => setAssigneeSearch(e.target.value)}
            placeholder="Search assignee..."
            className="w-52 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          />
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value as any)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All workload</option>
            <option value="overloaded">Overloaded</option>
            <option value="healthy">Healthy</option>
            <option value="free">Free</option>
          </select>
          <select
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
          >
            <option value="all">All products</option>
            {data?.products?.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Team members</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{summary.total}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Overloaded</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700">{summary.overloaded}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Healthy</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">{summary.healthy}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Average load %</div>
          <div className="mt-1 text-2xl font-semibold text-indigo-700">{summary.avgLoad}%</div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Assignee</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-center">Open Issues</th>
              <th className="px-4 py-3 text-center">Load %</th>
              <th className="px-4 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredWorkload
              .slice()
              .sort((a: any, b: any) => b.load_pct - a.load_pct)
              .map((m: any) => {
                const isSelected = selectedAssignee === m.github_username;
                const isOverloaded = m.load_pct >= 80;
                const hasOpenIssues = (m.open_issues ?? 0) > 0;
                const statusLabel = hasOpenIssues ? (isOverloaded ? 'Overloaded' : 'Healthy') : 'Free';
                const statusClass = hasOpenIssues
                  ? isOverloaded
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-emerald-100 text-emerald-700'
                  : 'bg-indigo-100 text-indigo-700';
                const memberIssues = data.issues.filter((i: any) => i.assignee === m.github_username && i.status !== 'closed');

                return (
                  <>
                    <tr
                      key={`${m.id}-row`}
                      onClick={() => {
                        if (isSelected) {
                          router.push('/workload');
                        } else {
                          router.push(`/workload?assignee=${encodeURIComponent(m.github_username)}`);
                        }
                      }}
                      className={`cursor-pointer transition hover:bg-slate-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                            {m.name
                              .split(' ')
                              .map((part: string) => part[0])
                              .join('')
                              .slice(0, 2)
                              .toUpperCase()}
                          </span>
                          <div>
                            <p className="font-medium text-slate-900">{m.name}</p>
                            <p className="text-xs text-slate-500">{m.github_username}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{m.role || 'Contributor'}</td>
                      <td className="px-4 py-3 text-center text-slate-700">{m.open_issues ?? 0}</td>
                      <td className="px-4 py-3 text-center">
                        <div className="mx-auto h-3 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${isOverloaded ? 'bg-rose-500' : 'bg-indigo-500'}`} style={{ width: `${m.load_pct}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-500">{m.load_pct}%</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                    {isSelected && (
                      <tr key={`${m.id}-details`} className="bg-white">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                            <div className="mb-2 flex items-center justify-between">
                              <p className="text-sm font-semibold text-slate-800">Details for {m.name}</p>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  router.push('/workload');
                                }}
                                className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                              >
                                Collapse
                              </button>
                            </div>
                            <div className="grid gap-2 sm:grid-cols-3">
                              <div className="rounded-md bg-white p-2 text-xs text-slate-700 border border-slate-200">Open Issues: {m.open_issues ?? 0}</div>
                              <div className="rounded-md bg-white p-2 text-xs text-slate-700 border border-slate-200">Load %: {m.load_pct}%</div>
                              <div className="rounded-md bg-white p-2 text-xs text-slate-700 border border-slate-200">Status: {statusLabel}</div>
                            </div>
                            <div className="mt-3 space-y-2">
                              {memberIssues.length === 0 ? (
                                <p className="rounded-md bg-emerald-50 p-2 text-xs text-emerald-700">No assigned issues</p>
                              ) : (
                                memberIssues.map((issue: any) => {
                                  const milestone = data.milestones.find((ms: any) => ms.id === issue.milestone_id);
                                  return (
                                    <div key={issue.id} className="rounded-md bg-white p-2 border border-slate-200">
                                      <div className="flex items-center justify-between gap-2 text-xs">
                                        <span className="font-mono text-slate-500">#{issue.github_number}</span>
                                        <span className={`rounded-full px-2 py-0.5 ${
                                          issue.status === 'closed'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : issue.status === 'blocked'
                                            ? 'bg-rose-100 text-rose-700'
                                            : 'bg-amber-100 text-amber-700'
                                        }`}>{issue.status}</span>
                                      </div>
                                      <p className="text-xs text-slate-700">{issue.title}</p>
                                      {milestone && <p className="text-xs text-indigo-600">Milestone: {milestone.name}</p>}
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
          </tbody>
        </table>
      </div>

    </div>
  );
}