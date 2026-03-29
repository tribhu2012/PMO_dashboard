import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

export async function GET() {
  const [products, milestones, issues, teamMembers, notificationsRaw] = await Promise.all([
    getSheet('products'),
    getSheet('milestones'),
    getSheet('issues'),
    getSheet('team_members'),
    getSheet('notifications'),
  ]);

  const normalizeNotification = (n: any) => {
    const rawType = n?.type ?? n?.event_type ?? n?.[0] ?? '';
    const rawTitle = n?.title ?? n?.summary ?? n?.[1] ?? '';
    let rawMessage = n?.message ?? n?.details ?? n?.[2] ?? '';
    const rawTimestamp = n?.timestamp ?? n?.time ?? n?.[3] ?? '';
    let rawRead = n?.read ?? n?.is_read ?? n?.[4] ?? '';
    const rawRefId = n?.ref_id ?? n?.reference_id ?? n?.[5] ?? '';

    // Handle cases where values may be shifted (legacy/partial rows) e.g. message=false gets read flag
    if ((rawRead === '' || rawRead == null) && typeof rawMessage === 'string' && ['false', 'true'].includes(rawMessage.toLowerCase())) {
      rawRead = rawMessage;
      rawMessage = '';
    }

    const typeLower = String(rawType).toLowerCase();
    const normalizedType =
      typeLower.includes('error') ? 'error' :
      typeLower.includes('warn') ? 'warning' :
      typeLower.includes('success') ? 'success' :
      typeLower.includes('issue_created') || typeLower.includes('issue created') ? 'success' :
      typeLower.includes('comment_added') || typeLower.includes('comment added') ? 'info' :
      typeLower.includes('issue_closed') || typeLower.includes('issue closed') ? 'success' :
      typeLower.includes('issue_blocked') || typeLower.includes('blocked') ? 'warning' :
      'info';

    const title = String(rawTitle || rawType || '').trim() || 'Notification';
    const message = String(rawMessage || '').trim() || ((typeLower.includes('issue_created') || typeLower.includes('issue created')) ? 'A new issue was created.' :
      (typeLower.includes('comment_added') || typeLower.includes('comment added')) ? 'A new comment was added.' :
      (typeLower.includes('issue_closed') || typeLower.includes('issue closed')) ? 'Issue closed.' :
      'You have a new notification.');

    const parsedRead = (rawRead === true || String(rawRead).toLowerCase() === 'true');

    return {
      type: normalizedType,
      title,
      message,
      timestamp: rawTimestamp || null,
      read: parsedRead,
      ref_id: String(rawRefId || ''),
    };
  };

  const notifications = Array.isArray(notificationsRaw)
    ? notificationsRaw.map(normalizeNotification)
    : [];

  // Compute milestone progress
  const milestonesWithProgress = milestones.map(m => {
    const milestoneIssues = issues.filter(i => i.milestone_id === m.id);
    const closed = milestoneIssues.filter(i => i.status === 'closed').length;
    const blocked = milestoneIssues.filter(i => i.status === 'blocked').length;
    const total = milestoneIssues.length;
    const progress = total > 0 ? Math.round((closed / total) * 100) : 0;
    return { ...m, progress, total, closed, blocked };
  });

  // Fallback: if no team member records exist, derive from issue assignees
  const effectiveTeam = (teamMembers && teamMembers.length > 0)
    ? teamMembers
    : Array.from(new Set(issues.map(i => i.assignee).filter(Boolean))).map((username, idx) => ({
        id: `team_${idx}`,
        name: username,
        role: 'Contributor',
        github_username: username,
      }));

  const workload = effectiveTeam.map(m => {
    const assigned = issues.filter(i => i.assignee === m.github_username && i.status !== 'closed');
    const load = Math.min(100, Math.round((assigned.length / 5) * 100)); // 5 tickets = 100%
    return { ...m, open_issues: assigned.length, load_pct: load };
  });

  // Summary metrics
  const metrics = {
    active_milestones: milestones.filter(m => m.status === 'active').length,
    open_tickets: issues.filter(i => i.status === 'open' || i.status === 'blocked').length,
    blocked_tickets: issues.filter(i => i.status === 'blocked').length,
    overloaded_members: workload.filter(m => m.load_pct >= 80).length,
    avg_progress: milestonesWithProgress.length > 0
      ? Math.round(milestonesWithProgress.reduce((s, m) => s + m.progress, 0) / milestonesWithProgress.length)
      : 0,
  };

  return NextResponse.json({ products, milestones: milestonesWithProgress, issues, workload, notifications, metrics });
}