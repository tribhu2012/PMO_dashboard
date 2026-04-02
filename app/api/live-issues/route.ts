import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

export async function GET() {
  const [products, issues] = await Promise.all([
    getSheet('products'),
    getSheet('issues'),
  ]);

  // Filter for live issues: issue_type = "Live" OR labels contains "Live" or "LIVE"
  const liveIssues = issues.filter((issue: any) => {
    const issueType = String(issue.issue_type || '').trim();
    const labels = String(issue.labels || '').split(',').map((l: any) => l.trim());
    
    const hasLiveType = issueType.toLowerCase() === 'live';
    const hasLiveLabel = labels.some((label: string) => label.toLowerCase() === 'live');
    
    return hasLiveType || hasLiveLabel;
  });

  // Calculate stats
  const stats = {
    total: liveIssues.length,
    open: liveIssues.filter((i: any) => i.status === 'open').length,
    closed: liveIssues.filter((i: any) => i.status === 'closed').length,
    blocked: liveIssues.filter((i: any) => i.status === 'blocked').length,
    byProduct: {} as Record<string, number>,
    byAssignee: {} as Record<string, number>,
  };

  // Count by product
  for (const product of products) {
    const count = liveIssues.filter((i: any) => i.product_id === product.id).length;
    if (count > 0) {
      stats.byProduct[product.name] = count;
    }
  }

  // Count by assignee
  for (const issue of liveIssues) {
    if (issue.assignee) {
      stats.byAssignee[issue.assignee] = (stats.byAssignee[issue.assignee] || 0) + 1;
    }
  }

  return NextResponse.json({ 
    issues: liveIssues,
    products,
    stats,
  });
}
