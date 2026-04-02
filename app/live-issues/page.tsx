'use client';
import { useEffect, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useRouter } from 'next/navigation';

export default function LiveIssuesPage() {
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState('all');
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  useEffect(() => {
    fetch('/api/live-issues').then((res) => res.json()).then(setData);
  }, []);

  const refresh = () => {
    fetch('/api/live-issues').then((res) => res.json()).then(setData);
  };

  if (!data) {
    return <div className="p-6 text-sm text-gray-500">Loading live issues...</div>;
  }

  const filteredIssues = product === 'all'
    ? data.issues
    : data.issues.filter((i: any) => i.product_id === product);

  const paginatedIssues = filteredIssues.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const totalPages = Math.ceil(filteredIssues.length / itemsPerPage) || 1;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, color: '#ffffff', letterSpacing: '-0.025em' }}>
            Live Issues
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm focus:ring-1 focus:ring-indigo-400"
            style={{
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '9px',
              color: '#1e293b', fontSize: '12px', padding: '7px 12px', cursor: 'pointer',
              fontWeight: 500,
            }}
            value={product}
            onChange={(e) => {
              setProduct(e.target.value);
              setPage(1);
            }}
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
        {/* ── STATS GRID ── */}
        <div className="mb-8 grid gap-3 sm:grid-cols-5">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total Live</div>
            <div className="mt-1 text-2xl font-semibold text-slate-900">{data.stats.total}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Open</div>
            <div className="mt-1 text-2xl font-semibold text-orange-700">{data.stats.open}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Closed</div>
            <div className="mt-1 text-2xl font-semibold text-emerald-700">{data.stats.closed}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Blocked</div>
            <div className="mt-1 text-2xl font-semibold text-red-700">{data.stats.blocked}</div>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">By Product</div>
            <div className="mt-1 text-xs text-slate-600">
              {Object.entries(data.stats.byProduct).map(([name, count]: any) => (
                <div key={name}>{name}: {count}</div>
              ))}
            </div>
          </div>
        </div>

        {/* ── ISSUES TABLE ── */}
        <div className="mb-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-800">Live Issues ({filteredIssues.length})</h2>
          </div>

          {paginatedIssues.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-slate-500">
              No live issues found.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50">
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">#</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Title</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Product</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Assignee</th>
                      <th className="px-6 py-3 text-left font-semibold text-slate-700">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedIssues.map((issue: any) => {
                      const product = data.products.find((p: any) => p.id === issue.product_id);
                      const statusColor =
                        issue.status === 'closed' ? 'text-emerald-700 bg-emerald-50' :
                        issue.status === 'blocked' ? 'text-red-700 bg-red-50' :
                        'text-orange-700 bg-orange-50';

                      const createdDate = issue.created_at
                        ? new Date(issue.created_at).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })
                        : '—';

                      const issueUrl = `https://github.com/city-tech/PMO/issues/${issue.github_number}`;

                      return (
                        <tr
                          key={issue.id}
                          className="border-b border-slate-200 hover:bg-slate-50"
                          onClick={() => window.open(issueUrl, '_blank')}
                          style={{ cursor: 'pointer' }}
                        >
                          <td className="px-6 py-3 text-slate-600">
                            <span className="text-red-600">#{issue.github_number}</span>
                          </td>
                          <td className="px-6 py-3 text-slate-800">
                            <span className="max-w-xs truncate block">{issue.title}</span>
                          </td>
                          <td className="px-6 py-3">
                            <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${statusColor}`}>
                              {issue.status}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-slate-600">{product?.name || '—'}</td>
                          <td className="px-6 py-3 text-slate-600">{issue.assignee || '—'}</td>
                          <td className="px-6 py-3 text-slate-600 text-xs">{createdDate}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINATION ── */}
              <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
                <div className="text-sm text-slate-600">
                  Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: page === 1 ? '#f1f5f9' : 'white',
                      color: page === 1 ? '#cbd5e1' : '#1e293b',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: page === 1 ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <FaChevronLeft /> Previous
                  </button>
                  <button
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: '1px solid #e2e8f0',
                      background: page === totalPages ? '#f1f5f9' : 'white',
                      color: page === totalPages ? '#cbd5e1' : '#1e293b',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: page === totalPages ? 'default' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Next <FaChevronRight />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
