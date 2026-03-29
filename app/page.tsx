'use client';
import { useEffect, useMemo, useState, useRef } from 'react';
import dynamic from 'next/dynamic';

const Bar = dynamic(() => import('../lib/charts').then(mod => mod.Bar), { ssr: false });
const Pie = dynamic(() => import('../lib/charts').then(mod => mod.Pie), { ssr: false });
const Line = dynamic(() => import('../lib/charts').then(mod => mod.Line), { ssr: false });

function getDateRange(start: string, end: string) {
  const range: string[] = [];
  let current = new Date(start);
  const last = new Date(end);
  while (current <= last) {
    range.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return range;
}

function AnimatedNumber({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (start === end) { setDisplay(end); return; }
    const step = Math.max(1, Math.ceil(end / 50));
    const timer = setInterval(() => {
      start = Math.min(start + step, end);
      setDisplay(start);
      if (start >= end) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [value]);
  return <>{display}{suffix}</>;
}

const ACCENT = '#6C63FF';
const ACCENT2 = '#00D4AA';
const DANGER = '#FF4757';
const WARN = '#FFA502';

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [product, setProduct] = useState('all');
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'progress' | 'open'>('progress');
  const [milestoneCount, setMilestoneCount] = useState(4);
  const [activeTab, setActiveTab] = useState<'overview' | 'releases' | 'team'>('overview');
  const [loaded, setLoaded] = useState(false);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/dashboard').then(r => r.json()).then(d => {
      setData(d);
      setTimeout(() => setLoaded(true), 100);
    });
  }, []);

  const refresh = async () => {
    setSyncing(true);
    await fetch('/api/sync', { method: 'POST' });
    const fresh = await fetch('/api/dashboard').then(r => r.json());
    setData(fresh);
    setSyncing(false);
  };

  // All milestones sorted newest first
  const sortedMilestones = useMemo(() => {
    if (!data?.milestones) return [];
    return [...data.milestones].sort((a: any, b: any) =>
      new Date(b.due_on || b.created_at).getTime() - new Date(a.due_on || a.created_at).getTime()
    );
  }, [data]);

  // Active milestone for burndown — use selected or default to most recent
  const activeMilestone = useMemo(() => {
    if (!sortedMilestones.length) return null;
    if (selectedMilestoneId) return sortedMilestones.find((m: any) => m.id === selectedMilestoneId) || sortedMilestones[0];
    return sortedMilestones[0];
  }, [sortedMilestones, selectedMilestoneId]);

  const burndownData = useMemo(() => {
    if (!activeMilestone || !data?.issues) return null;
    const issues = data.issues.filter((i: any) => i.milestone_id === activeMilestone.id);
    if (!issues.length) return null;
    const start = activeMilestone.start_date || activeMilestone.created_at || issues[0].created_at;
    const end = activeMilestone.due_on || new Date().toISOString().slice(0, 10);
    const days = getDateRange(start, end);
    const ideal = days.map((_, idx) => Math.round(issues.length * (1 - idx / (days.length - 1 || 1))));
    const actual = days.map(day => {
      const dayEnd = day + 'T23:59:59Z';
      return issues.filter((i: any) =>
        (!i.closed_at || i.closed_at > dayEnd) && i.created_at <= dayEnd
      ).length;
    });
    const totalIssues = issues.length;
    const closedIssues = issues.filter((i: any) => i.status === 'closed').length;
    const pct = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;
    return {
      labels: days.map(d => d.slice(5)),
      ideal, actual,
      milestoneName: activeMilestone.name,
      total: totalIssues,
      closed: closedIssues,
      open: totalIssues - closedIssues,
      pct,
    };
  }, [activeMilestone, data]);

  const milestoneStatusData = useMemo(() => {
    if (!data?.milestones || !data?.issues) return null;
    const selected = sortedMilestones.slice(0, milestoneCount).reverse();
    const statuses: string[] = Array.from(new Set(data.issues.map((i: any) => i.status)));
    const statusColors: Record<string, string> = {
      open: ACCENT, blocked: DANGER, closed: ACCENT2, 'in progress': WARN,
    };
    return {
      labels: selected.map((m: any) => m.name),
      datasets: statuses.map((status: string) => ({
        label: status,
        data: selected.map((m: any) =>
          data.issues.filter((i: any) => i.milestone_id === m.id && i.status === status).length
        ),
        backgroundColor: statusColors[status] || '#888',
        borderRadius: 6,
        stack: 'status',
      })),
    };
  }, [data, milestoneCount, sortedMilestones]);

  const issuesByStatus = useMemo(() => {
    if (!data?.issues) return { labels: [], counts: [] };
    const counts: Record<string, number> = {};
    data.issues.forEach((i: any) => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return { labels: Object.keys(counts), counts: Object.values(counts) as number[] };
  }, [data]);

  const issuesByProduct = useMemo(() => {
    if (!data?.issues || !data?.products) return { labels: [], counts: [], colors: [] };
    const counts: Record<string, number> = {};
    const colorMap: Record<string, string> = {};
    const palette = [ACCENT, ACCENT2, DANGER, WARN, '#FF6B9D', '#A78BFA', '#38BDF8', '#FB923C'];
    data.issues.forEach((i: any) => {
      const prod = data.products.find((p: any) => p.id === i.product_id);
      const name = prod?.name || 'Unknown';
      counts[name] = (counts[name] || 0) + 1;
      if (!colorMap[name]) colorMap[name] = prod?.color || palette[Object.keys(colorMap).length % palette.length];
    });
    return {
      labels: Object.keys(counts),
      counts: Object.values(counts) as number[],
      colors: Object.keys(counts).map(k => colorMap[k]),
    };
  }, [data]);

  const filteredReleases = useMemo(() => {
    if (!data?.releases) return [];
    let list = product === 'all'
      ? data.releases
      : data.releases.filter((r: any) => r.product_id === product);
    if (search.trim()) list = list.filter((r: any) => r.name.toLowerCase().includes(search.toLowerCase()));
    return list.sort((a: any, b: any) =>
      sort === 'progress' ? b.progress - a.progress : (b.total ?? 0) - (a.total ?? 0)
    );
  }, [data, product, search, sort]);

  if (!data) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f8fafc', gap: '16px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `3px solid ${ACCENT}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ color: '#94a3b8', fontSize: '12px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Loading dashboard</div>
    </div>
  );

  const metrics = [
    {
      label: 'Active releases', value: data.metrics?.active_releases ?? data.metrics?.active_milestones ?? 0,
      suffix: '', color: ACCENT, bg: 'rgba(108,99,255,0.08)',
      icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M10 2L12.5 7.5H18L13.5 11L15.5 17L10 13.5L4.5 17L6.5 11L2 7.5H7.5L10 2Z" stroke={ACCENT} strokeWidth="1.5" strokeLinejoin="round" /></svg>,
    },
    {
      label: 'Open issues', value: data.metrics?.open_tickets ?? 0,
      suffix: '', sub: `${data.metrics?.blocked_tickets ?? 0} blocked`, color: WARN, bg: 'rgba(255,165,2,0.08)',
      icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke={WARN} strokeWidth="1.5" /><path d="M10 6v5M10 13v1" stroke={WARN} strokeWidth="1.5" strokeLinecap="round" /></svg>,
    },
    {
      label: 'Team members', value: data.workload?.length ?? 0,
      suffix: '', sub: `${data.metrics?.overloaded_members ?? 0} overloaded`, color: ACCENT2, bg: 'rgba(0,212,170,0.08)',
      icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><circle cx="8" cy="7" r="3" stroke={ACCENT2} strokeWidth="1.5" /><circle cx="14" cy="7" r="2" stroke={ACCENT2} strokeWidth="1.5" /><path d="M2 17c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke={ACCENT2} strokeWidth="1.5" strokeLinecap="round" /><path d="M14 11c1.7.5 3 2.1 3 4" stroke={ACCENT2} strokeWidth="1.5" strokeLinecap="round" /></svg>,
    },
    {
      label: 'Avg progress', value: data.metrics?.avg_progress ?? 0,
      suffix: '%', color: '#FF6B9D', bg: 'rgba(255,107,157,0.08)',
      icon: <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M3 14l4-4 3 3 4-5 3 3" stroke="#FF6B9D" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>,
    },
  ];

  const statusColorMap: Record<string, string> = { open: ACCENT, blocked: DANGER, closed: ACCENT2, 'in progress': WARN };

  const totalIssues = issuesByProduct.counts.reduce((a, b) => a + b, 0);

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', color: '#1e293b', fontFamily: "'DM Sans', 'Segoe UI', sans-serif", opacity: loaded ? 1 : 0, transition: 'opacity 0.5s ease' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 4px; }
        .card { background: white; border: 1px solid #e2e8f0; border-radius: 16px; transition: border-color 0.2s, box-shadow 0.2s; }
        .card:hover { border-color: #c7d2fe; box-shadow: 0 4px 20px rgba(99,102,241,0.08); }
        .btn { cursor: pointer; border: none; outline: none; font-family: inherit; transition: all 0.15s; }
        .btn:hover { opacity: 0.88; transform: translateY(-1px); }
        .btn:active { transform: translateY(0); opacity: 1; }
        .tab { cursor: pointer; padding: 7px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; transition: all 0.2s; border: none; outline: none; font-family: inherit; }
        .tab-active { background: ${ACCENT}15; color: ${ACCENT}; }
        .tab-inactive { background: transparent; color: #94a3b8; }
        .tab-inactive:hover { color: #64748b; background: #f1f5f9; }
        .pill { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 99px; font-size: 11px; font-weight: 600; letter-spacing: 0.02em; }
        .progress-track { background: #f1f5f9; border-radius: 99px; overflow: hidden; }
        .progress-fill { height: 100%; border-radius: 99px; transition: width 1s cubic-bezier(0.4,0,0.2,1); }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        .fade-up { animation: fadeUp 0.35s ease both; }
        @keyframes spin2 { to { transform: rotate(360deg); } }
        .spinning { animation: spin2 0.8s linear infinite; display: inline-block; }
        input, select { outline: none; font-family: inherit; }
        input::placeholder { color: #94a3b8; }
        .milestone-select { appearance: none; -webkit-appearance: none; cursor: pointer; }
      `}</style>

      {/* ── TOPBAR ── */}
      <div ref={headerRef} style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(248,250,252,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: '1px solid #e2e8f0',
        padding: '0 28px',
        display: 'flex', alignItems: 'center', height: '58px', gap: '8px',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginRight: '16px' }}>
          <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M7 1L9 5.5H14L10 8.5L11.5 13L7 10L2.5 13L4 8.5L0 5.5H5L7 1Z" fill="white" /></svg>
          </div>
          <span style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b', letterSpacing: '-0.02em' }}>ProjectOS</span>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', flex: 1 }}>
          {(['overview', 'releases', 'team'] as const).map(tab => (
            <button key={tab} className={`tab ${activeTab === tab ? 'tab-active' : 'tab-inactive'}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* RIGHT SIDE — search + product filter + sync */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: 'auto' }}>
          {/* Search */}
          <div style={{ position: 'relative' }}>
            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }}>
              <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search releases..." style={{
              background: 'white', border: '1px solid #e2e8f0', borderRadius: '9px',
              color: '#1e293b', fontSize: '12px', padding: '7px 12px 7px 28px', width: '170px',
            }} />
          </div>

          {/* Product filter */}
          <select value={product} onChange={e => setProduct(e.target.value)} style={{
            background: 'white', border: '1px solid #e2e8f0', borderRadius: '9px',
            color: '#1e293b', fontSize: '12px', padding: '7px 12px', cursor: 'pointer',
            fontWeight: 500,
          }}>
            <option value="all">All products</option>
            {data.products?.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>

          {/* Sync button */}
          <button className="btn" onClick={refresh} disabled={syncing} style={{
            background: syncing ? '#f1f5f9' : `linear-gradient(135deg, ${ACCENT}, #8B5CF6)`,
            border: syncing ? '1px solid #e2e8f0' : 'none',
            borderRadius: '9px', color: syncing ? '#94a3b8' : 'white',
            fontSize: '12px', fontWeight: 600,
            padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px',
            boxShadow: syncing ? 'none' : '0 4px 12px rgba(108,99,255,0.3)',
          }}>
            {syncing
              ? <span className="spinning" style={{ fontSize: '14px', lineHeight: 1 }}>⟳</span>
              : <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 1v10M1 6l5-5 5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            }
            {syncing ? 'Syncing...' : 'Sync GitHub'}
          </button>
        </div>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: '1400px', margin: '0 auto' }}>

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <>
            {/* Metric cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
              {metrics.map((m, i) => (
                <div key={m.label} className="card fade-up" style={{ padding: '18px 20px', animationDelay: `${i * 70}ms` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: m.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.icon}
                    </div>
                    {(m as any).sub && (
                      <span className="pill" style={{ background: DANGER + '12', color: DANGER }}>{(m as any).sub}</span>
                    )}
                  </div>
                  <div style={{ fontSize: '30px', fontWeight: 700, color: m.color, letterSpacing: '-0.03em', lineHeight: 1 }}>
                    <AnimatedNumber value={m.value} suffix={m.suffix} />
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '5px', fontWeight: 500, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {m.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 1: Milestone Burndown (wide) + Issues by status */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '14px', marginBottom: '14px' }}>

              {/* ── MILESTONE BURNDOWN ── */}
              <div className="card fade-up" style={{ padding: '22px', animationDelay: '180ms' }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Milestone burndown</div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                      Ideal vs actual open issues over time
                    </div>
                  </div>
                  {/* Milestone selector */}
                  <div style={{ position: 'relative' }}>
                    <select
                      className="milestone-select"
                      value={selectedMilestoneId || activeMilestone?.id || ''}
                      onChange={e => setSelectedMilestoneId(e.target.value)}
                      style={{
                        background: ACCENT + '0E', border: `1px solid ${ACCENT}30`,
                        borderRadius: '8px', color: ACCENT,
                        fontSize: '11px', fontWeight: 600, padding: '5px 28px 5px 10px',
                        cursor: 'pointer',
                      }}>
                      {sortedMilestones.map((m: any) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                      {sortedMilestones.length === 0 && <option value="">No milestones</option>}
                    </select>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: ACCENT }}>
                      <path d="M2 3.5l3 3 3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* Mini stats row */}
                {burndownData && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid #f1f5f9' }}>
                    {[
                      { label: 'Total', value: burndownData.total, color: '#64748b' },
                      { label: 'Closed', value: burndownData.closed, color: ACCENT2 },
                      { label: 'Open', value: burndownData.open, color: WARN },
                      { label: 'Progress', value: `${burndownData.pct}%`, color: ACCENT },
                    ].map(s => (
                      <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: s.color }}>{s.value}</span>
                        <span style={{ fontSize: '11px', color: '#94a3b8' }}>{s.label}</span>
                      </div>
                    ))}
                    {/* Progress mini bar */}
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                      <div className="progress-track" style={{ flex: 1, height: '4px' }}>
                        <div className="progress-fill" style={{ width: `${burndownData.pct}%`, background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT2})` }} />
                      </div>
                    </div>
                  </div>
                )}

                {/* Legend */}
                <div style={{ display: 'flex', gap: '16px', marginBottom: '12px' }}>
                  {[{ color: ACCENT, label: 'Ideal', dashed: true }, { color: ACCENT2, label: 'Actual', dashed: false }].map(l => (
                    <span key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                      <span style={{ width: '22px', height: '2px', background: l.dashed ? 'none' : l.color, display: 'inline-block', borderRadius: '2px', borderTop: l.dashed ? `2px dashed ${l.color}` : 'none' }} />
                      {l.label}
                    </span>
                  ))}
                </div>

                <div style={{ position: 'relative', height: '190px' }}>
                  {burndownData ? (
                    <Line
                      data={{
                        labels: burndownData.labels,
                        datasets: [
                          {
                            label: 'Ideal',
                            data: burndownData.ideal,
                            borderColor: ACCENT + '80',
                            borderDash: [5, 4],
                            borderWidth: 1.5,
                            pointRadius: 0,
                            tension: 0,
                            fill: false,
                          },
                          {
                            label: 'Actual',
                            data: burndownData.actual,
                            borderColor: ACCENT2,
                            backgroundColor: ACCENT2 + '18',
                            fill: true,
                            tension: 0.35,
                            pointRadius: 3,
                            pointBackgroundColor: ACCENT2,
                            pointBorderColor: 'white',
                            pointBorderWidth: 1.5,
                            borderWidth: 2.5,
                          },
                        ],
                      }}
                      options={{
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                        scales: {
                          x: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 10 }, maxRotation: 0, maxTicksLimit: 8 } },
                          y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 10 } }, beginAtZero: true },
                        },
                      }}
                      height={190}
                    />
                  ) : (
                    <EmptyState text="No issues found for this milestone" />
                  )}
                </div>
              </div>

              {/* Issues by status bar */}
              <div className="card fade-up" style={{ padding: '22px', animationDelay: '220ms' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>Issues by status</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>Current distribution</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  {issuesByStatus.labels.map((label, i) => (
                    <span key={label} className="pill" style={{ background: (statusColorMap[label] || '#888') + '15', color: statusColorMap[label] || '#888' }}>
                      {label} · {issuesByStatus.counts[i]}
                    </span>
                  ))}
                </div>
                <div style={{ position: 'relative', height: '200px' }}>
                  <Bar
                    data={{
                      labels: issuesByStatus.labels,
                      datasets: [{
                        label: 'Issues',
                        data: issuesByStatus.counts,
                        backgroundColor: issuesByStatus.labels.map(l => (statusColorMap[l] || '#888') + 'BB'),
                        hoverBackgroundColor: issuesByStatus.labels.map(l => statusColorMap[l] || '#888'),
                        borderRadius: 8,
                        borderSkipped: false,
                      }],
                    }}
                    options={{
                      responsive: true, maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 11 } } },
                        y: { grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 11 } }, beginAtZero: true },
                      },
                    }}
                    height={200}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: By Product (improved) + Stacked milestones */}
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '14px', marginBottom: '14px' }}>

              {/* ── BY PRODUCT — improved ── */}
              <div className="card fade-up" style={{ padding: '22px', animationDelay: '260ms' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b', marginBottom: '4px' }}>By product</div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '16px' }}>
                  {totalIssues} total issues across {issuesByProduct.labels.length} product{issuesByProduct.labels.length !== 1 ? 's' : ''}
                </div>

                {issuesByProduct.labels.length > 0 ? (
                  <>
                    {/* Donut chart */}
                    <div style={{ position: 'relative', height: '160px', marginBottom: '16px' }}>
                      <Pie
                        data={{
                          labels: issuesByProduct.labels,
                          datasets: [{
                            data: issuesByProduct.counts,
                            backgroundColor: issuesByProduct.colors,
                            borderWidth: 3,
                            borderColor: 'white',
                            hoverBorderColor: 'white',
                            hoverOffset: 8,
                          }],
                        }}
                        options={{
                          responsive: true, maintainAspectRatio: false,
                          plugins: { legend: { display: false }, tooltip: { callbacks: {
                            label: (ctx: any) => ` ${ctx.label}: ${ctx.parsed} issues (${totalIssues > 0 ? Math.round((ctx.parsed / totalIssues) * 100) : 0}%)`
                          }}},
                          cutout: '62%',
                        }}
                        height={160}
                      />
                      {/* Center label */}
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: '22px', fontWeight: 700, color: '#1e293b', lineHeight: 1 }}>{totalIssues}</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '2px' }}>total</div>
                      </div>
                    </div>

                    {/* Product breakdown rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {issuesByProduct.labels.map((label, i) => {
                        const pct = totalIssues > 0 ? Math.round((issuesByProduct.counts[i] / totalIssues) * 100) : 0;
                        return (
                          <div key={label}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ width: '9px', height: '9px', borderRadius: '3px', background: issuesByProduct.colors[i], flexShrink: 0 }} />
                              <span style={{ fontSize: '12px', color: '#475569', flex: 1, fontWeight: 500 }}>{label}</span>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: issuesByProduct.colors[i] }}>{issuesByProduct.counts[i]}</span>
                              <span style={{ fontSize: '11px', color: '#94a3b8', minWidth: '30px', textAlign: 'right' }}>{pct}%</span>
                            </div>
                            <div className="progress-track" style={{ height: '3px' }}>
                              <div className="progress-fill" style={{ width: `${pct}%`, background: issuesByProduct.colors[i] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <EmptyState text="No product data yet" />
                )}
              </div>

              {/* Stacked milestone status */}
              <div className="card fade-up" style={{ padding: '22px', animationDelay: '300ms' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>Status over milestones</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {[4, 8].map(n => (
                      <button key={n} className="btn" onClick={() => setMilestoneCount(n)} style={{
                        fontSize: '11px', padding: '4px 10px', borderRadius: '6px', fontWeight: 600,
                        background: milestoneCount === n ? ACCENT + '15' : '#f8fafc',
                        color: milestoneCount === n ? ACCENT : '#94a3b8',
                        border: `1px solid ${milestoneCount === n ? ACCENT + '35' : '#e2e8f0'}`,
                      }}>Last {n}</button>
                    ))}
                  </div>
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '14px' }}>Stacked by issue status</div>
                <div style={{ position: 'relative', height: '220px' }}>
                  {milestoneStatusData ? (
                    <Bar
                      data={milestoneStatusData}
                      options={{
                        responsive: true, maintainAspectRatio: false,
                        plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
                        scales: {
                          x: { stacked: true, grid: { display: false }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                          y: { stacked: true, beginAtZero: true, grid: { color: '#f1f5f9' }, ticks: { color: '#94a3b8', font: { size: 10 } } },
                        },
                      }}
                      height={220}
                    />
                  ) : (
                    <EmptyState text="No milestone data available" />
                  )}
                </div>
                {milestoneStatusData && (
                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #f1f5f9' }}>
                    {milestoneStatusData.datasets.map((ds: any) => (
                      <span key={ds.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: ds.backgroundColor, display: 'inline-block' }} />
                        {ds.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ══ RELEASES TAB ══ */}
        {activeTab === 'releases' && (
          <div className="fade-up">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.03em' }}>Release tracker</div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>{filteredReleases.length} releases · progress by tickets closed</div>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['progress', 'open'] as const).map(s => (
                  <button key={s} className="btn" onClick={() => setSort(s)} style={{
                    fontSize: '11px', padding: '6px 12px', borderRadius: '8px', fontWeight: 600,
                    background: sort === s ? ACCENT + '15' : 'white',
                    color: sort === s ? ACCENT : '#64748b',
                    border: `1px solid ${sort === s ? ACCENT + '35' : '#e2e8f0'}`,
                  }}>
                    {s === 'progress' ? 'By progress' : 'By open issues'}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredReleases.length === 0 ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                  No releases found. Add them to your Google Sheet or run sync.
                </div>
              ) : filteredReleases.map((r: any, i: number) => {
                const prod = data.products?.find((p: any) => p.id === r.product_id);
                const isAtRisk = r.blocked > 0;
                const isShipped = r.status === 'shipped';
                const statusColor = isShipped ? ACCENT2 : isAtRisk ? DANGER : WARN;
                const statusLabel = isShipped ? 'Shipped' : isAtRisk ? 'At risk' : 'In progress';
                return (
                  <div key={r.id} className="card fade-up" style={{ padding: '18px 22px', animationDelay: `${i * 40}ms`, borderLeft: `3px solid ${prod?.color || ACCENT}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{r.name}</span>
                          <span className="pill" style={{ background: statusColor + '15', color: statusColor }}>{statusLabel}</span>
                          {r.type && <span className="pill" style={{ background: '#f1f5f9', color: '#64748b' }}>{r.type}</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="progress-track" style={{ flex: 1, height: '6px' }}>
                            <div className="progress-fill" style={{ width: `${r.progress ?? 0}%`, background: `linear-gradient(90deg, ${prod?.color || ACCENT}, ${prod?.color || ACCENT}88)` }} />
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: prod?.color || ACCENT, minWidth: '38px' }}>{r.progress ?? 0}%</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '20px', flexShrink: 0 }}>
                        {[
                          { label: 'Total', value: r.total ?? 0, color: '#1e293b' },
                          { label: 'Closed', value: r.closed ?? 0, color: ACCENT2 },
                          { label: 'Blocked', value: r.blocked ?? 0, color: r.blocked > 0 ? DANGER : '#94a3b8' },
                        ].map(stat => (
                          <div key={stat.label} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '18px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                            <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stat.label}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexShrink: 0 }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: prod?.color || ACCENT, display: 'inline-block' }} />
                        <span style={{ fontSize: '12px', color: '#64748b' }}>{prod?.name || '—'}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ TEAM TAB ══ */}
        {activeTab === 'team' && (
          <div className="fade-up">
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', letterSpacing: '-0.03em' }}>Team workload</div>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '3px' }}>Resource allocation across all products</div>
            </div>

            {data.workload?.length > 0 && (
              <div className="card" style={{ padding: '18px 22px', marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8', marginBottom: '10px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Team capacity overview
                </div>
                <div style={{ display: 'flex', height: '28px', borderRadius: '8px', overflow: 'hidden', gap: '2px' }}>
                  {data.workload.map((m: any, i: number) => {
                    const colors = [ACCENT, ACCENT2, WARN, DANGER, '#FF6B9D', '#A78BFA'];
                    const maxIssues = Math.max(...data.workload.map((w: any) => w.open_issues), 1);
                    const width = Math.max(4, Math.round((m.open_issues / maxIssues) * 100));
                    return (
                      <div key={m.id} title={`${m.name}: ${m.load_pct}% capacity`} style={{
                        flex: width, background: colors[i % colors.length],
                        opacity: m.load_pct >= 80 ? 1 : 0.45,
                        transition: 'flex 0.8s ease',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <span style={{ fontSize: '10px', color: 'white', fontWeight: 700 }}>
                          {m.name?.split(' ')[0]?.[0]}{m.name?.split(' ')[1]?.[0]}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                  {data.workload.map((m: any, i: number) => {
                    const colors = [ACCENT, ACCENT2, WARN, DANGER, '#FF6B9D', '#A78BFA'];
                    return (
                      <span key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#64748b' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: colors[i % colors.length], display: 'inline-block' }} />
                        {m.name} — {m.load_pct}%
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
              {(!data.workload || data.workload.length === 0) ? (
                <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: '13px', gridColumn: 'span 2' }}>
                  No team members yet. Add them to the team_members sheet.
                </div>
              ) : [...data.workload].sort((a: any, b: any) => b.load_pct - a.load_pct).map((m: any, i: number) => {
                const isOverloaded = m.load_pct >= 80;
                const memberIssues = data.issues?.filter(
                  (issue: any) => issue.assignee === m.github_username && issue.status !== 'closed'
                ) || [];
                const colors = [ACCENT, ACCENT2, WARN, DANGER, '#FF6B9D', '#A78BFA'];
                const memberColor = colors[i % colors.length];
                const initials = m.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '??';

                return (
                  <div key={m.id} className="card fade-up" style={{ padding: '20px', animationDelay: `${i * 60}ms`, borderTop: `2px solid ${isOverloaded ? DANGER : memberColor}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: memberColor + '15', color: memberColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 600, color: '#1e293b' }}>{m.name}</span>
                          {isOverloaded && <span className="pill" style={{ background: DANGER + '12', color: DANGER }}>Overloaded</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '1px' }}>{m.role}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: isOverloaded ? DANGER : memberColor }}>{m.load_pct}%</div>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>capacity</div>
                      </div>
                    </div>

                    <div className="progress-track" style={{ height: '5px', marginBottom: '14px' }}>
                      <div className="progress-fill" style={{ width: `${m.load_pct}%`, background: isOverloaded ? `linear-gradient(90deg, ${DANGER}, ${WARN})` : `linear-gradient(90deg, ${memberColor}, ${memberColor}70)` }} />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {memberIssues.length === 0 ? (
                        <div style={{ fontSize: '12px', color: ACCENT2, padding: '8px 12px', background: ACCENT2 + '08', borderRadius: '8px', textAlign: 'center', border: `1px solid ${ACCENT2}20` }}>
                          Available — no open issues
                        </div>
                      ) : memberIssues.slice(0, 3).map((issue: any) => {
                        const rel = data.releases?.find((r: any) => r.id === issue.release_id);
                        const sColor = statusColorMap[issue.status] || '#888';
                        return (
                          <div key={issue.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', borderRadius: '8px', padding: '8px 10px', border: '1px solid #f1f5f9' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sColor, flexShrink: 0 }} />
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: '#94a3b8' }}>#{issue.github_number}</span>
                            <span style={{ flex: 1, fontSize: '12px', color: '#475569', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.title}</span>
                            {rel && <span className="pill" style={{ background: ACCENT + '12', color: ACCENT, flexShrink: 0 }}>{rel.name}</span>}
                          </div>
                        );
                      })}
                      {memberIssues.length > 3 && (
                        <div style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', paddingTop: '2px' }}>+{memberIssues.length - 3} more issues</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '10px' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" rx="3" stroke="#cbd5e1" strokeWidth="1.3" />
          <path d="M5 8h6M8 5v6" stroke="#cbd5e1" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div style={{ fontSize: '12px', color: '#94a3b8' }}>{text}</div>
    </div>
  );
}