import { NextResponse } from 'next/server';
import { getSheet, appendRows, batchUpdateRows } from '@/lib/sheets';
import { getRepoIssues, getRepoMilestones, getRateLimitInfo, getProjectCustomFields } from '@/lib/github';
import { sendChatAlert } from '@/lib/chat';

export async function POST() {
  try {
    const products = await getSheet('products');
    let milestones = await getSheet('milestones');
    const existingIssues = await getSheet('issues');

    // First pass: fetch and sync milestones from all repos (deduped by github_id)
    const newMilestones: any[][] = [];
    const processedMilestoneIds = new Set<string>();
    
    for (const product of products) {
      const repos = product.github_repos.split(',');
      for (const repo of repos) {
        const ghMilestones = await getRepoMilestones(product.github_owner, repo.trim(), 'ALL');
        
        for (const milestone of ghMilestones) {
          const githubId = String(milestone.id);
          
          // Skip if we've already processed this milestone in this sync run
          if (processedMilestoneIds.has(githubId)) continue;
          processedMilestoneIds.add(githubId);
          
          const existingMilestone = milestones.find((m: any) => m.github_id === githubId);
          
          if (!existingMilestone) {
            // Create new milestone row (product_id is empty since milestones are not product-specific)
            const now = new Date().toISOString();
            const milestoneId = `milestone_${milestone.id}`;
            
            newMilestones.push([
              milestoneId,
              '',  // product_id - empty since milestones are shared across products
              milestone.title,
              githubId,
              milestone.state === 'closed' ? 'completed' : 'active',
              milestone.description || '',
              milestone.due_on || '',
              now,
            ]);
            
            milestones.push({
              id: milestoneId,
              product_id: '',
              name: milestone.title,
              github_id: githubId,
              status: milestone.state === 'closed' ? 'completed' : 'active',
              description: milestone.description || '',
              due_date: milestone.due_on || '',
              created_at: now,
            });
          }
        }
      }
    }

    if (newMilestones.length > 0) {
      await appendRows('milestones', newMilestones);
    }

    // Pre-fetch custom fields for all projects
    const projectCustomFields = new Map<string, Map<number, string>>();
    for (const product of products) {
      if (product.github_project_id) {
        try {
          const customFields = await getProjectCustomFields(product.github_project_id);
          projectCustomFields.set(product.github_project_id, customFields);
        } catch (error) {
          console.warn(`Failed to fetch custom fields for project ${product.github_project_id}`);
        }
      }
    }

    // Second pass: sync issues and link to milestones
    const newIssues: any[][] = [];
    const updatedIssuesData: { range: string; values: any[][] }[] = [];
    const alertPromises: Promise<any>[] = [];

    const processedGithubIds = new Set<string>();
    for (const product of products) {
      const repos = product.github_repos.split(',');
      for (const repo of repos) {
        const ghIssues = await getRepoIssues(product.github_owner, repo.trim(), 'ALL');

        for (const issue of ghIssues) {
          // Skip if already processed in this sync run or without milestone
          if (!issue.milestone || processedGithubIds.has(String(issue.id))) continue;
          processedGithubIds.add(String(issue.id));

          const existing = existingIssues.find((i: any) => i.github_id === String(issue.id));
          const status = issue.state === 'closed' ? 'closed' :
            issue.labels.some((l: any) => l.name === 'blocked') ? 'blocked' : 'open';
          const assignee = issue.assignee?.login || '';
          const labels = issue.labels.map((l: any) => l.name).join(',');
          const now = new Date().toISOString();

          // Robust product mapping for shared repos:
          // 1. If existing in sheet, preserve that product ID
          // 2. If Project match (GitHub Projects V2)
          // 3. Fallback: label match
          // 4. Last fallback: loop product
          let finalProductId = existing?.product_id;
          
          if (!finalProductId) {
            const projectTitle = String(issue.project_title || '').trim().toLowerCase();
            
            const matchByProject = products.find(p => 
              p.name.toLowerCase() === projectTitle ||
              p.github_project_id === issue.project_id
            );
            
            if (matchByProject) {
              finalProductId = matchByProject.id;
            } else {
              const matchByLabel = products.find(p => 
                issue.labels.some((l: any) => 
                  l.name.toLowerCase() === p.name.toLowerCase() ||
                  l.name.toLowerCase().includes(p.name.toLowerCase())
                )
              );
              finalProductId = matchByLabel?.id || product.id;
            }
          }

          // Link to milestone if issue has one
          let milestoneId = '';
          const issueMilestoneId = issue.milestone?.id;
          if (issueMilestoneId != null) {
            const linkedMilestone = milestones.find((m: any) => m.github_id === String(issueMilestoneId));
            milestoneId = linkedMilestone?.id || '';
          }

          // Get issue_type from project custom fields
          let issueType = '';
          const productForIssue = products.find((p: any) => p.id === finalProductId);
          if (productForIssue?.github_project_id) {
            const projectFields = projectCustomFields.get(productForIssue.github_project_id);
            if (projectFields) {
              issueType = projectFields.get(issue.number) || '';
            }
          }

          const values = [
            existing?.id || `iss_${issue.id}`,
            milestoneId,
            finalProductId,
            String(issue.id),
            String(issue.number),
            issue.title,
            status,
            assignee,
            labels,
            issue.created_at,
            now,
            '', // release column (empty)
            issueType,  // Custom field: issue_type from GitHub Project
          ];

          if (!existing) {
            newIssues.push(values);
            if (status === 'blocked') {
              alertPromises.push(sendChatAlert(
                `Issue #${issue.number} "${issue.title}" is blocked in ${product.name}`,
                'blocker'
              ).catch(e => console.error('Alert error:', e)));
            }
          } else {
            // update status if changed
            if (existing.status !== status) {
              const rowIndex = existingIssues.indexOf(existing) + 2;
              updatedIssuesData.push({
                range: `issues!A${rowIndex}`,
                values: [values]
              });
              if (status === 'blocked') {
                alertPromises.push(sendChatAlert(
                  `Issue #${issue.number} "${issue.title}" became blocked in ${product.name}`,
                  'blocker'
                ).catch(e => console.error('Alert error:', e)));
              }
            }
          }
        }
      }
    }

    if (newIssues.length > 0) {
      await appendRows('issues', newIssues);
    }
    if (updatedIssuesData.length > 0) {
      await batchUpdateRows(updatedIssuesData);
    }
    await Promise.all(alertPromises);

    // Update milestone statuses based on issue completion
    const updatedIssues = await getSheet('issues');
    const updatedMilestonesData: { range: string; values: any[][] }[] = [];
    
    for (let i = 0; i < milestones.length; i++) {
      const milestone = milestones[i];
      const milestoneIssues = updatedIssues.filter((iss: any) => iss.milestone_id === milestone.id);
      const allClosed = milestoneIssues.length > 0 && milestoneIssues.every((iss: any) => iss.status === 'closed');
      const newStatus = allClosed ? 'completed' : 'active';
      
      if (milestone.status !== newStatus) {
        const rowIndex = i + 2;
        const updatedMilestone = Object.values(milestone);
        updatedMilestone[4] = newStatus;
        updatedMilestonesData.push({
          range: `milestones!A${rowIndex}`,
          values: [updatedMilestone as string[]]
        });
      }
    }

    if (updatedMilestonesData.length > 0) {
      await batchUpdateRows(updatedMilestonesData);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // Handle GitHub rate limit errors
    const rateLimitInfo = getRateLimitInfo(error);
    if (rateLimitInfo.rateLimited) {
      return NextResponse.json(
        {
          error: 'GitHub API rate limit exceeded',
          resetAt: rateLimitInfo.resetTime,
          resetInMinutes: rateLimitInfo.resetInMinutes,
          message: `Please try again in ${rateLimitInfo.resetInMinutes} minutes`,
        },
        { status: 429 }
      );
    }

    // Handle other errors
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: error.message || 'Sync failed' },
      { status: 500 }
    );
  }
}