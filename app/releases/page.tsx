'use client';
import { useEffect, useState } from 'react';

export default function Milestones() {
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState('all');

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  if (!data) return <div className="p-6 text-sm text-gray-400">Loading...</div>;

  const filtered = product === 'all'
    ? data.milestones
    : data.milestones.filter((m: any) => m.product_id === product);

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-base font-medium">Milestones</h1>
        <select className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white"
          value={product} onChange={e => setProduct(e.target.value)}>
          <option value="all">All products</option>
          {data.products?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      <div className="grid gap-4">
        {filtered.length === 0 ? (
          <div className="text-sm text-gray-400 p-6 text-center">
            No milestones found. Create milestones in GitHub and run sync.
          </div>
        ) : (
          filtered.map((m: any) => {
            const prod = data.products?.find((p: any) => p.id === m.product_id);
            const milestoneIssues = data.issues?.filter((i: any) => i.milestone_id === m.id) || [];
            const openIssues = milestoneIssues.filter((i: any) => i.status === 'open');
            const blockedIssues = milestoneIssues.filter((i: any) => i.status === 'blocked');
            const closedIssues = milestoneIssues.filter((i: any) => i.status === 'closed');

            return (
              <div key={m.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 flex-1">
                    <span className="w-3 h-3 rounded-full" style={{ background: prod?.color || '#534AB7' }} />
                    <div className="flex-1">
                      <h2 className="text-sm font-medium text-gray-900">{m.name}</h2>
                      <p className="text-xs text-gray-400">{prod?.name}</p>
                    </div>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    m.status === 'active' ? 'bg-blue-100 text-blue-700' :
                    m.status === 'completed' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {m.status}
                  </span>
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-600">Progress</span>
                    <span className="text-xs font-medium text-gray-900">{m.progress}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{ width: `${m.progress}%`, background: prod?.color || '#534AB7' }} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-gray-600">Total issues</div>
                    <div className="text-base font-medium text-gray-900">{milestoneIssues.length}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <div className="text-blue-600">Open</div>
                    <div className="text-base font-medium text-blue-900">{openIssues.length}</div>
                  </div>
                  <div className="bg-red-50 rounded-lg p-2">
                    <div className="text-red-600">Blocked</div>
                    <div className="text-base font-medium text-red-900">{blockedIssues.length}</div>
                  </div>
                </div>

                {closedIssues.length > 0 && (
                  <div className="mt-3 text-xs text-green-600">
                    ✓ {closedIssues.length} completed
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
