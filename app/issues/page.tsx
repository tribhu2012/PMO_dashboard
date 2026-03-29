'use client';
import { useEffect, useState } from 'react';
import { FaChevronLeft, FaChevronRight, FaPlusCircle } from 'react-icons/fa';

export default function Issues() {
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState('all');
  const [showCreate, setShowCreate] = useState(true);
  const [form, setForm] = useState({ title: '', body: '', product_id: '', milestone_id: '', assignees: '', labels: '' });
  const [createdPage, setCreatedPage] = useState(1);
  const [resolvedPage, setResolvedPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    fetch('/api/dashboard').then((res) => res.json()).then(setData);
  }, []);

  const refresh = () => fetch('/api/dashboard').then((res) => res.json()).then(setData);

  const submit = async () => {
    if (!form.product_id) return alert('Select a product.');
    if (!form.title.trim()) return alert('Enter title.');

    await fetch('/api/issues/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        assignees: form.assignees
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean),
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
    <div className="p-8 min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      <div className="flex items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold text-indigo-900 tracking-tight">Issues</h1>
        <select
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-400"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        >
          <option value="all">All products</option>
          {data.products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg flex flex-col items-center">
          <span className="text-3xl font-bold text-indigo-700">{active.length}</span>
          <span className="text-sm text-indigo-900 font-semibold mt-1">Total Issues</span>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg flex flex-col items-center">
          <span className="text-3xl font-bold text-green-600">{recentlyCreated.length}</span>
          <span className="text-sm text-indigo-900 font-semibold mt-1">Recently Created</span>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg flex flex-col items-center">
          <span className="text-3xl font-bold text-blue-600">{recentlyResolved.length}</span>
          <span className="text-sm text-indigo-900 font-semibold mt-1">Recently Resolved</span>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-6 shadow-lg flex flex-col items-center">
          <span className="text-3xl font-bold text-orange-600">{active.filter((i: any) => i.status === 'open').length}</span>
          <span className="text-sm text-indigo-900 font-semibold mt-1">Open Issues</span>
        </div>
      </div>

      <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-xl mb-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2"><FaPlusCircle className="text-indigo-500" /> Create new issue</h2>
          <button
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Hide' : 'Show'}
          </button>
        </div>
        {showCreate && (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-indigo-800">Product</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-400"
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
                <label className="text-sm font-semibold text-indigo-800">Milestone</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-400"
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
              <label className="text-sm font-semibold text-indigo-800">Title</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-400"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Issue title"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-indigo-800">Description</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-400"
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Describe the issue"
              />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-indigo-800">Assignees</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-400"
                  value={form.assignees}
                  onChange={(e) => setForm({ ...form, assignees: e.target.value })}
                  placeholder="Comma-separated usernames"
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-indigo-800">Labels</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-indigo-900 shadow-sm focus:ring-2 focus:ring-indigo-400"
                  value={form.labels}
                  onChange={(e) => setForm({ ...form, labels: e.target.value })}
                  placeholder="Comma-separated labels"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button
                className="rounded-lg bg-indigo-600 px-6 py-2 text-sm font-bold text-white hover:bg-indigo-700 transition"
                onClick={submit}
              >
                Create issue
              </button>
              <button
                className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 transition"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-lg flex flex-col">
          <h2 className="text-lg font-bold text-indigo-900 mb-4">Recently created (3 days)</h2>
          {paginatedCreated.length === 0 ? (
            <p className="mt-2 text-base text-gray-600">No issues created in the last 3 days.</p>
          ) : (
            <ul className="space-y-3 text-base">
              {paginatedCreated.map((issue: any) => (
                <li key={issue.id} className="rounded-lg border border-gray-200 p-4 bg-indigo-50 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-900">#{issue.github_number} {issue.title}</span>
                    <span className="text-gray-500 text-xs">{new Date(issue.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-indigo-800 text-xs">{issue.assignee || 'Unassigned'}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setCreatedPage((prev) => Math.max(1, prev - 1))}
              disabled={createdPage === 1}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium transition ${createdPage === 1 ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : 'text-indigo-700 bg-white hover:bg-indigo-50'}`}
            >
              <FaChevronLeft /> Previous
            </button>
            <span className="text-sm text-indigo-900 font-semibold">Page {createdPage} of {createdTotalPages}</span>
            <button
              onClick={() => setCreatedPage((prev) => Math.min(createdTotalPages, prev + 1))}
              disabled={createdPage === createdTotalPages}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium transition ${createdPage === createdTotalPages ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : 'text-indigo-700 bg-white hover:bg-indigo-50'}`}
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
        <div className="rounded-2xl border border-indigo-100 bg-white p-8 shadow-lg flex flex-col">
          <h2 className="text-lg font-bold text-indigo-900 mb-4">Recently resolved (3 days)</h2>
          {paginatedResolved.length === 0 ? (
            <p className="mt-2 text-base text-gray-600">No issues resolved in the last 3 days.</p>
          ) : (
            <ul className="space-y-3 text-base">
              {paginatedResolved.map((issue: any) => (
                <li key={issue.id} className="rounded-lg border border-gray-200 p-4 bg-blue-50 flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-900">#{issue.github_number} {issue.title}</span>
                    <span className="text-gray-500 text-xs">{new Date(issue.updated_at || issue.closed_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-indigo-800 text-xs">{issue.assignee || 'Unassigned'}</p>
                </li>
              ))}
            </ul>
          )}
          <div className="flex justify-between items-center mt-6">
            <button
              onClick={() => setResolvedPage((prev) => Math.max(1, prev - 1))}
              disabled={resolvedPage === 1}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium transition ${resolvedPage === 1 ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : 'text-indigo-700 bg-white hover:bg-indigo-50'}`}
            >
              <FaChevronLeft /> Previous
            </button>
            <span className="text-sm text-indigo-900 font-semibold">Page {resolvedPage} of {resolvedTotalPages}</span>
            <button
              onClick={() => setResolvedPage((prev) => Math.min(resolvedTotalPages, prev + 1))}
              disabled={resolvedPage === resolvedTotalPages}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium transition ${resolvedPage === resolvedTotalPages ? 'text-gray-300 bg-gray-100 cursor-not-allowed' : 'text-indigo-700 bg-white hover:bg-indigo-50'}`}
            >
              Next <FaChevronRight />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
