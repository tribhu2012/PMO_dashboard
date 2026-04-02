'use client';
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/navigation';
import { FaChevronLeft, FaChevronRight, FaPlusCircle } from 'react-icons/fa';

function IssuesContent() {
  const [data, setData] = useState<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [product, setProduct] = useState('all');
  const [showCreate, setShowCreate] = useState(true);
  const [form, setForm] = useState({ title: '', body: '', product_id: '', milestone_id: '', assignees: '', labels: '' });
  const [createdPage, setCreatedPage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetch('/api/dashboard').then((res) => res.json()).then(setData);
  }, []);

  useEffect(() => {
    const assignee = searchParams.get('assignee');
    const shouldShowCreate = searchParams.get('showCreate') === 'true';
    if (assignee) {
      setForm((prev) => ({ ...prev, assignees: assignee }));
    }
    if (shouldShowCreate) {
      setShowCreate(true);
    }
  }, [searchParams]);

  const refresh = () => fetch('/api/dashboard').then((res) => res.json()).then(setData);

  const submit = async () => {
    if (!form.product_id) return alert('Select a product.');
    if (!form.title.trim()) return alert('Enter title.');

    await fetch('/api/issues/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        assignees: form.assignees ? [form.assignees] : [],
        labels: form.labels
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
      }),
    });

    setForm({ title: '', body: '', product_id: '', milestone_id: '', assignees: '', labels: '' });
    setShowCreate(false);
    refresh();
  };

  if (!data) {
    return <div className="p-6 text-sm text-gray-500">Loading issues dashboard...</div>;
  }

  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  const active = product === 'all' ? data.issues : data.issues.filter((i: any) => i.product_id === product);

  const recentlyCreated = active
    .filter((i: any) => i.created_at)
    .filter((i: any) => now - new Date(i.created_at).getTime() <= threeDays)
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const recentlyResolved = active
    .filter((i: any) => i.status === 'closed')
    .filter((i: any) => (i.updated_at || i.closed_at))
    .filter((i: any) => now - new Date(i.updated_at || i.closed_at).getTime() <= threeDays)
    .sort(
      (a: any, b: any) =>
        new Date(b.updated_at || b.closed_at).getTime() - new Date(a.updated_at || a.closed_at).getTime(),
    );

  const milestonesForProduct = data.milestones.filter((m: any) => !form.product_id || m.product_id === form.product_id);

  const paginatedCreated = recentlyCreated.slice((createdPage - 1) * itemsPerPage, createdPage * itemsPerPage);
  const paginatedResolved = recentlyResolved.slice((resolvedPage - 1) * itemsPerPage, resolvedPage * itemsPerPage);
  const createdTotalPages = Math.ceil(recentlyCreated.length / itemsPerPage) || 1;
  const resolvedTotalPages = Math.ceil(recentlyResolved.length / itemsPerPage) || 1;

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* ── TOPBAR ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#0f172a',
        borderBottom: '1px solid #1e293b',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', height: '58px', gap: '8px',
      }}>
        {/* LEFT SIDE — Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.025em' }}>
            Issues
          </h1>
        </div>

        {/* RIGHT SIDE — filter + refresh */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          <button
            onClick={() => router.push('/live-issues')}
            style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              borderRadius: '9px', color: 'white',
              fontSize: '12px', fontWeight: 600,
              padding: '7px 16px',
              boxShadow: '0 4px 12px rgba(239,68,68,0.3)',
              cursor: 'pointer'
            }}
          >
            Live Issues
          </button>

          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:ring-1 focus:ring-indigo-400"
            style={{
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '9px',
              color: '#1e293b', fontSize: '12px', padding: '7px 12px', cursor: 'pointer',
              fontWeight: 500,
            }}
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="all">All products</option>
            {data.products.map((p: any) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button
            onClick={refresh}
            style={{
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              border: 'none',
              borderRadius: '9px', color: 'white',
              fontSize: '12px', fontWeight: 600,
              padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px',
              boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
              cursor: 'pointer'
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="p-8">

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Total Issues</div>
          <div className="mt-1 text-2xl font-semibold text-slate-900">{active.length}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Recently Created</div>
          <div className="mt-1 text-2xl font-semibold text-emerald-700">{recentlyCreated.length}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Recently Resolved</div>
          <div className="mt-1 text-2xl font-semibold text-blue-700">{recentlyResolved.length}</div>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-slate-500">Open Issues</div>
          <div className="mt-1 text-2xl font-semibold text-orange-700">{active.filter((i: any) => i.status === 'open').length}</div>
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800"><FaPlusCircle className="text-indigo-500" /> Create new issue</h2>
          <button
            className="rounded-md bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Hide' : 'Show'}
          </button>
        </div>
        {showCreate && (
          <div className="mt-3 space-y-3">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Product</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value, milestone_id: '' })}
                >
                  <option value="">Choose product</option>
                  {data.products.map((p: any) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Milestone</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={form.milestone_id}
                  onChange={(e) => setForm({ ...form, milestone_id: e.target.value })}
                >
                  <option value="">Choose milestone</option>
                  {milestonesForProduct.map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Title</label>
              <input
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Issue title"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">Description</label>
              <textarea
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                rows={2}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Describe the issue"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Assignee</label>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={form.assignees}
                  onChange={(e) => setForm({ ...form, assignees: e.target.value })}
                >
                  <option value="">Unassigned</option>
                  {(data.workload ?? []).map((m: any) => (
                    <option key={m.github_username} value={m.github_username}>
                      {m.name || m.github_username}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">Labels</label>
                <input
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  value={form.labels}
                  onChange={(e) => setForm({ ...form, labels: e.target.value })}
                  placeholder="Comma-separated labels"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                onClick={submit}
              >
                Create issue
              </button>
              <button
                className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 pb-0">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Recently created (3 days)</h2>
          </div>
          {paginatedCreated.length === 0 ? (
            <p className="p-6 pt-0 text-sm text-slate-500">No issues created in the last 3 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Issue</th>
                    <th className="px-4 py-3 text-left font-semibold">Assignee</th>
                    <th className="px-4 py-3 text-right font-semibold">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paginatedCreated.map((issue: any) => (
                    <tr key={issue.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 text-left">
                        <div className="flex items-center">
                          <a href={issue.html_url || issue.url || `https://github.com/city-tech/PMO/issues/${issue.github_number}`} target="_blank" rel="noopener noreferrer" className="block max-w-[200px] lg:max-w-[260px] truncate font-normal text-slate-700 transition-all duration-500 hover:max-w-[600px] hover:text-slate-900 hover:underline">
                            <span className="text-red-600">#{issue.github_number}</span> {issue.title}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{issue.assignee ? issue.assignee.split(/[-_\s]/)[0].charAt(0).toUpperCase() + issue.assignee.split(/[-_\s]/)[0].slice(1) : 'Unassigned'}</td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">{new Date(issue.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-auto flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setCreatedPage((prev) => Math.max(1, prev - 1))}
              disabled={createdPage === 1}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${createdPage === 1 ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <FaChevronLeft /> Previous
            </button>
            <span className="text-xs font-medium text-slate-600">Page {createdPage} of {createdTotalPages}</span>
            <button
              onClick={() => setCreatedPage((prev) => Math.min(createdTotalPages, prev + 1))}
              disabled={createdPage === createdTotalPages}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${createdPage === createdTotalPages ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="p-6 pb-0">
            <h2 className="mb-4 text-lg font-semibold text-slate-800">Recently resolved (3 days)</h2>
          </div>
          {paginatedResolved.length === 0 ? (
            <p className="p-6 pt-0 text-sm text-slate-500">No issues resolved in the last 3 days.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Issue</th>
                    <th className="px-4 py-3 text-left font-semibold">Assignee</th>
                    <th className="px-4 py-3 text-right font-semibold">Resolved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {paginatedResolved.map((issue: any) => (
                    <tr key={issue.id} className="transition-colors hover:bg-slate-50">
                      <td className="px-4 py-3 text-left">
                        <div className="flex items-center">
                          <a href={issue.html_url || issue.url || `https://github.com/city-tech/PMO/issues/${issue.github_number}`} target="_blank" rel="noopener noreferrer" className="block max-w-[200px] lg:max-w-[260px] truncate font-normal text-slate-700 transition-all duration-500 hover:max-w-[600px] hover:text-slate-900 hover:underline">
                            <span className="text-red-600">#{issue.github_number}</span> {issue.title}
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{issue.assignee ? issue.assignee.split(/[-_\s]/)[0].charAt(0).toUpperCase() + issue.assignee.split(/[-_\s]/)[0].slice(1) : 'Unassigned'}</td>
                      <td className="px-4 py-3 text-right text-slate-500 whitespace-nowrap">{new Date(issue.updated_at || issue.closed_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-auto flex items-center justify-between p-4 border-t border-slate-200 bg-slate-50">
            <button
              onClick={() => setResolvedPage((prev) => Math.max(1, prev - 1))}
              disabled={resolvedPage === 1}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${resolvedPage === 1 ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              <FaChevronLeft /> Previous
            </button>
            <span className="text-xs font-medium text-slate-600">Page {resolvedPage} of {resolvedTotalPages}</span>
            <button
              onClick={() => setResolvedPage((prev) => Math.min(resolvedTotalPages, prev + 1))}
              disabled={resolvedPage === resolvedTotalPages}
              className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold transition ${resolvedPage === resolvedTotalPages ? 'cursor-not-allowed bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
    </div>
  );
}

export default function IssuesPage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>}>
      <IssuesContent />
    </Suspense>
  );
}
