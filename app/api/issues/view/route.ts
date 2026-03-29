import { NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';

export async function GET() {
  const [products, milestones, issues] = await Promise.all([
    getSheet('products'),
    getSheet('milestones'),
    getSheet('issues'),
  ]);

  const now = Date.now();
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  // Assuming standard headers 'created_at' and 'updated_at' or finding the timestamp keys
  const recently_created = issues.filter((issue: any) => {
    const createdDate = new Date(issue.created_at || issue.created || issue['Created At'] || 0).getTime();
    return (now - createdDate) <= threeDaysMs;
  });

  const recently_resolved = issues.filter((issue: any) => {
    if (issue.status !== 'closed' && issue.status !== 'completed') return false;
    
    // Check updated_at, or if not present try created_at as backup
    const updatedDateString = issue.updated_at || issue.updated || issue['Updated At'] || issue.created_at || issue.created || issue['Created At'];
    const updatedDate = new Date(updatedDateString).getTime();

    // If we have a valid parsed date, check if it's within 3 days. 
    return (now - updatedDate) <= threeDaysMs;
  });

  // Need milestone progress calculation too, as it was in dashboard/route.ts
  const milestonesWithProgress = milestones.map((m: any) => {
    const milestoneIssues = issues.filter((i: any) => i.milestone_id === m.id);
    const closed = milestoneIssues.filter((i: any) => i.status === 'closed').length;
    const blocked = milestoneIssues.filter((i: any) => i.status === 'blocked').length;
    const total = milestoneIssues.length;
    const progress = total > 0 ? Math.round((closed / total) * 100) : 0;
    return { ...m, progress, total, closed, blocked };
  });

  return NextResponse.json({
    products,
    milestones: milestonesWithProgress,
    recently_created,
    recently_resolved,
  });
}
