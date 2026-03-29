import { NextRequest, NextResponse } from 'next/server';
import { createIssue, getRepoMilestones } from '@/lib/github';
import { appendRow, getSheet } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  const { product_id, milestone_id, title, body, assignees, labels } = await req.json();

  const products = await getSheet('products');
  const product = products.find(p => p.id === product_id);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });


  const repo = product.github_repos.split(',')[0].trim();

  // Find milestone number for GitHub API if milestone_id is provided
  let milestoneNumber: number | undefined = undefined;
  if (milestone_id) {
    // Find the milestone in the sheet to get github_id
    const allMilestones = await getSheet('milestones');
    const ms = allMilestones.find((m: any) => m.id === milestone_id || String(m.id) === String(milestone_id));
    if (ms && ms.github_id) {
      // Fetch all milestones from GitHub and match by id
      const ghMilestones = await getRepoMilestones(product.github_owner, repo, 'open');
      const ghMs = ghMilestones.find((g: any) => String(g.id) === String(ms.github_id));
      if (ghMs) {
        milestoneNumber = ghMs.number;
      }
    }
  }

  // Find projectId for GitHub GraphQL if product has a project
  let projectId: string | undefined = undefined;
  if (product.github_project_id) {
    projectId = product.github_project_id;
  }

  const ghIssue = await createIssue(
    product.github_owner, repo, title, body, assignees, labels, milestoneNumber, projectId
  );

  const id = `iss_${ghIssue.id}`;
  const now = new Date().toISOString();
  await appendRow('issues', [
    id, milestone_id, product_id,
    String(ghIssue.id), String(ghIssue.number),
    title, 'open', assignees[0] || '', labels.join(','),
    now, now
  ]);

  // Add notification for issue creation
  await appendRow('notifications', [
    'issue_created',
    `Issue Created`,
    `Issue "${title}" was created by ${assignees[0] || 'unknown'}.`,
    now,
    'false', // unread
    id // reference to issue id
  ]);

  return NextResponse.json({ id, github_number: ghIssue.number });
}