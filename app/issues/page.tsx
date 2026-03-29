'use client';
import { useEffect, useState } from 'react';

export default function Issues() {
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState('all');
  const [showCreate, setShowCreate] = useState(true);
  const [form, setForm] = useState({ title: '', body: '', product_id: '', milestone_id: '', assignees: '', labels: '' });

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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Issues</h1>
        <select
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs"
          value={product}
          onChange={(e) => setProduct(e.target.value)}
        >
          <option value="all">All products</option>
          {data.products.map((p: any) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Recently created (3 days)</h2>
          {recentlyCreated.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">No issues created in the last 3 days.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {recentlyCreated.slice(0, 10).map((issue: any) => (
                <li key={issue.id} className="rounded-lg border border-gray-100 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">#{issue.github_number} {issue.title}</span>
                    <span className="text-gray-400">{new Date(issue.created_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-500">{issue.assignee || 'Unassigned'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="text-sm font-semibold">Recently resolved (3 days)</h2>
          {recentlyResolved.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">No issues resolved in the last 3 days.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-xs">
              {recentlyResolved.slice(0, 10).map((issue: any) => (
                <li key={issue.id} className="rounded-lg border border-gray-100 p-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">#{issue.github_number} {issue.title}</span>
                    <span className="text-gray-400">{new Date(issue.updated_at || issue.closed_at).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-500">{issue.assignee || 'Unassigned'}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Create new issue</h2>
          <button
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs"
            onClick={() => setShowCreate((v) => !v)}
          >
            {showCreate ? 'Hide' : 'Show'}
          </button>
        </div>

        {showCreate && (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-600">Product</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
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
                <label className="text-xs font-medium text-gray-600">Milestone</label>
                <select
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
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
              <label className="text-xs font-medium text-gray-600">Title</label>
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Issue title"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600">Description</label>
              <textarea
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                rows={4}
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                placeholder="Describe the issue"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <label className="text-xs font-medium text-gray-600">Assignees</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                  value={form.assignees}
                  onChange={(e) => setForm({ ...form, assignees: e.target.value })}
                  placeholder="Comma-separated usernames"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Labels</label>
                <input
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs"
                  value={form.labels}
                  onChange={(e) => setForm({ ...form, labels: e.target.value })}
                  placeholder="Comma-separated labels"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                className="rounded-lg bg-indigo-600 px-4 py-2 text-xs text-white hover:bg-indigo-700"
                onClick={submit}
              >
                Create issue
              </button>
              <button
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs"
                onClick={() => setShowCreate(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
