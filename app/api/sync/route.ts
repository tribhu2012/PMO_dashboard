import { NextResponse } from 'next/server';
import { getSheet, appendRow, updateRow } from '@/lib/sheets';
import { getRepoIssues, getRepoMilestones } from '@/lib/github';
import { sendChatAlert } from '@/lib/chat';

export async function POST() {
  const products = await getSheet('products');
  let milestones = await getSheet('milestones');
  const existingIssues = await getSheet('issues');

  // First pass: fetch and sync milestones from all repos
  for (const product of products) {
    const repos = product.github_repos.split(',');
    for (const repo of repos) {
      const ghMilestones = await getRepoMilestones(product.github_owner, repo.trim(), 'all');
      
      for (const milestone of ghMilestones) {
        const existingMilestone = milestones.find(m => m.github_id === String(milestone.id) && m.product_id === product.id);
        
        if (!existingMilestone) {
          // Create new milestone row
          const now = new Date().toISOString();
          const milestoneId = `milestone_${milestone.id}`;
          
          await appendRow('milestones', [
            milestoneId,
            product.id,
            milestone.title,
            String(milestone.id),
            milestone.state === 'closed' ? 'completed' : 'active',
            milestone.description || '',
            milestone.due_on || '',
            now,
          ]);
          
          milestones.push({
            id: milestoneId,
            product_id: product.id,
            name: milestone.title,
            github_id: String(milestone.id),
            status: milestone.state === 'closed' ? 'completed' : 'active',
            description: milestone.description || '',
            due_date: milestone.due_on || '',
            created_at: now,
          });
        }
      }
    }
  }

  // Second pass: sync issues and link to milestones
  for (const product of products) {
    const repos = product.github_repos.split(',');
    for (const repo of repos) {
      const ghIssues = await getRepoIssues(product.github_owner, repo.trim());

      for (const issue of ghIssues) {
        const existing = existingIssues.find(i => i.github_id === String(issue.id));
        const status = issue.state === 'closed' ? 'closed' :
          issue.labels.some((l: any) => l.name === 'blocked') ? 'blocked' : 'open';
        const assignee = issue.assignee?.login || '';
        const labels = issue.labels.map((l: any) => l.name).join(',');
        const now = new Date().toISOString();

        // Link to milestone if issue has one
        let milestoneId = '';
        const issueMilestoneId = issue.milestone?.id;
        if (issueMilestoneId != null) {
          const linkedMilestone = milestones.find(m => m.github_id === String(issueMilestoneId));
          milestoneId = linkedMilestone?.id || '';
        }

        const values = [
          existing?.id || `iss_${issue.id}`,
          milestoneId,
          product.id,
          String(issue.id),
          String(issue.number),
          issue.title,
          status,
          assignee,
          labels,
          issue.created_at,
          now,
        ];

        if (!existing) {
          await appendRow('issues', values);
          if (status === 'blocked') {
            await sendChatAlert(
              `Issue #${issue.number} "${issue.title}" is blocked in ${product.name}`,
              'blocker'
            );
          }
        } else {
          // update status if changed
          if (existing.status !== status) {
            const rowIndex = existingIssues.indexOf(existing) + 2;
            await updateRow('issues', rowIndex, values);
            if (status === 'blocked') {
              await sendChatAlert(
                `Issue #${issue.number} "${issue.title}" became blocked in ${product.name}`,
                'blocker'
              );
            }
          }
        }
      }
    }
  }

  // Update milestone statuses based on issue completion
  const updatedIssues = await getSheet('issues');
  for (let i = 0; i < milestones.length; i++) {
    const milestone = milestones[i];
    const milestoneIssues = updatedIssues.filter(iss => iss.milestone_id === milestone.id);
    const allClosed = milestoneIssues.length > 0 && milestoneIssues.every(iss => iss.status === 'closed');
    const newStatus = allClosed ? 'completed' : 'active';
    
    if (milestone.status !== newStatus) {
      const rowIndex = i + 2;
      const updatedMilestone = Object.values(milestone);
      updatedMilestone[4] = newStatus;
      await updateRow('milestones', rowIndex, updatedMilestone as string[]);
    }
  }

  return NextResponse.json({ success: true });
}