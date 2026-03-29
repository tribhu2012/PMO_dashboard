'use client';
import { useEffect, useMemo, useState } from 'react';

const LOADING_TEXT = 'Loading…';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'progress' | 'open'>('progress');

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(setData);
  }, []);

  const refresh = async () => {
    setSyncing(true);
    await fetch('/api/sync', { method: 'POST' });
    const fresh = await fetch('/api/dashboard').then(r => r.json());
    setData(fresh);
    setSyncing(false);
  };

  const filteredMilestones = useMemo(() => {
    if (!data?.milestones) return [];

    let list = product === 'all'
      ? data.milestones
      : data.milestones.filter((m: any) => m.product_id === product);

    if (search.trim()) {
      list = list.filter((m: any) => m.name.toLowerCase().includes(search.toLowerCase()));
    }

    return list.sort((a: any, b: any) => {
      if (sort === 'progress') return b.progress - a.progress;
      return (b.total ?? 0) - (a.total ?? 0);
    });
  }, [data, product, search, sort]);

  if (!data) {
    return <div className="flex items-center justify-center h-screen text-gray-400">{LOADING_TEXT}</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl p-4 md:p-6">

        <header className="mb-6 rounded-2xl bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-900">Citytech Dashboard</h1>
              <p className="text-sm text-slate-500">Sync GitHub milestones, issues, and workload data for Citytech</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={refresh} disabled={syncing} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70">
                {syncing ? 'Syncing…' : 'Sync GitHub'}
              </button>
              <select value={product} onChange={e => setProduct(e.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm">
                <option value="all">All products</option>
                {data.products?.map((p: any) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

        </header>

        <section className="mb-6 grid gap-4 md:grid-cols-4">
          {[
            { label: 'Active Milestones', value: data.metrics?.active_milestones ?? 0, icon: '🗓' },
            { label: 'Open Issues', value: data.metrics?.open_tickets ?? 0, icon: '🐛', note: `${data.metrics?.blocked_tickets ?? 0} blocked` },
            { label: 'Team Members', value: data.workload?.length ?? 0, icon: '👥', note: `${data.metrics?.overloaded_members ?? 0} overloaded` },
            { label: 'Avg Progress', value: `${data.metrics?.avg_progress ?? 0}%`, icon: '📈' },
          ].map(card => (
            <article key={card.label} className="rounded-2xl bg-gradient-to-r from-white via-slate-50 to-slate-100 p-4 shadow-md">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-600">
                <span>{card.icon}</span>
                <span>{card.label}</span>
              </div>
              <div className="text-3xl font-bold text-slate-900">{card.value}</div>
              {card.note && <p className="mt-1 text-xs text-rose-600">{card.note}</p>}
            </article>
          ))}
        </section>

        {/* No additional sections on Overview page by request */}
      </div>
    </div>
  );
}
