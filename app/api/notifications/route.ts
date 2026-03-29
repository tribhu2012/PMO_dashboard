import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

const EVENT_WINDOW_DAYS = 30;

function withinWindow(dateStr: string, days: number) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return d >= cutoff;
}

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const diff = Math.floor((Date.now() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export async function GET() {
  const [issues, products, notificationsRaw] = await Promise.all([
    getSheet('issues'),
    getSheet('products'),
    getSheet('notifications'),
  ]);

  const productMap: Record<string, any> = {};
  for (const p of products) {
    if (p.id) {
      productMap[String(p.id).trim()] = p;
    }
  }

  const derived: any[] = [];

  for (const issue of issues) {
    const pid = String(issue.product_id || '').trim();
    const product = productMap[pid] || {};
    const productName = product.name || 'Unknown Product';
    const issueLabel = `#${issue.github_number} ${issue.title}`;
    
    // GitHub URL construction
    let githubUrl = null;
    if (product.github_owner && product.github_repos && issue.github_number) {
      const repo = product.github_repos.split(',')[0].trim();
      githubUrl = `https://github.com/${product.github_owner}/${repo}/issues/${issue.github_number}`;
    }

    // Issue created (within window)
    if (withinWindow(issue.created_at, EVENT_WINDOW_DAYS)) {
      derived.push({
        id: `created_${issue.id}_${issue.created_at}`,
        event_type: 'issue_created',
        title: 'New issue created',
        message: `${issueLabel} was created in ${productName}.`,
        assignee: issue.assignee || null,
        issue_number: issue.github_number,
        product: productName,
        timestamp: issue.created_at,
        read: false,
        github_url: githubUrl,
      });
    }

    // Issue closed (updated_at within window and status=closed)
    if (issue.status === 'closed' && withinWindow(issue.updated_at, EVENT_WINDOW_DAYS)) {
      derived.push({
        id: `closed_${issue.id}_${issue.updated_at}`,
        event_type: 'issue_closed',
        title: 'Issue closed',
        message: `${issueLabel} was closed${issue.assignee ? ` by ${issue.assignee}` : ''} in ${productName}.`,
        assignee: issue.assignee || null,
        issue_number: issue.github_number,
        product: productName,
        timestamp: issue.updated_at,
        read: false,
        github_url: githubUrl,
      });
    }

    // Issue blocked (within window)
    if (issue.status === 'blocked' && withinWindow(issue.updated_at, EVENT_WINDOW_DAYS)) {
      derived.push({
        id: `blocked_${issue.id}_${issue.updated_at}`,
        event_type: 'issue_blocked',
        title: 'Issue blocked',
        message: `${issueLabel} is blocked in ${productName}.`,
        assignee: issue.assignee || null,
        issue_number: issue.github_number,
        product: productName,
        timestamp: issue.updated_at,
        read: false,
        github_url: githubUrl,
      });
    }

    // Issue Activity / Comment heuristic
    if (issue.updated_at && issue.created_at && issue.updated_at !== issue.created_at && 
        issue.status !== 'closed' && issue.status !== 'blocked' && 
        withinWindow(issue.updated_at, EVENT_WINDOW_DAYS)) {
      derived.push({
        id: `activity_${issue.id}_${issue.updated_at}`,
        event_type: 'comment_added',
        title: 'New activity on issue',
        message: `${issueLabel} was updated in ${productName}.`,
        assignee: issue.assignee || null,
        issue_number: issue.github_number,
        product: productName,
        timestamp: issue.updated_at,
        read: false,
        github_url: githubUrl,
      });
    }
  }

  // Parse sheet notifications
  const sheetNotifications = Array.isArray(notificationsRaw)
    ? notificationsRaw.map((n: any) => ({
        id: `sheet_${Math.random()}`,
        event_type: (n.type || n.event_type || 'info').toLowerCase(),
        title: n.title || n.summary || 'Notification',
        message: n.message || n.details || '',
        assignee: null,
        issue_number: n.ref_id || null,
        product: null,
        timestamp: n.timestamp || n.time || null,
        read: n.read === 'true' || n.read === true,
        github_url: n.url || null,
      }))
    : [];

  // Merge and sort newest-first
  const all = [...derived, ...sheetNotifications].sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta;
  });

  // Attach time-ago string
  const notifications = all.map(n => ({
    ...n,
    time_ago: n.timestamp ? timeAgo(n.timestamp) : null,
  }));

  return NextResponse.json({ notifications });
}
