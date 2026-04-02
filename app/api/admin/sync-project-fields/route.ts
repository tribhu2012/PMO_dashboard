import { NextResponse, NextRequest } from 'next/server';
import { getSheet, updateRow, batchUpdateRows } from '@/lib/sheets';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
    }

    // Query the project to get all items with custom fields
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            id
            title
            items(first: 100, after: null) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                id
                content {
                  ... on Issue {
                    id
                    number
                    repository {
                      name
                      owner {
                        login
                      }
                    }
                  }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2SingleSelectField {
                          name
                        }
                      }
                      name
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    // Fetch all issues from the project
    let allItems = [];
    let hasNextPage = true;
    let after = null;

    while (hasNextPage) {
      const response = await octokit.graphql(query, { projectId, after });
      const projectNode = response.node;
      
      if (!projectNode) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 });
      }

      const items = projectNode.items?.nodes || [];
      allItems = allItems.concat(items);
      hasNextPage = projectNode.items?.pageInfo?.hasNextPage || false;
      after = projectNode.items?.pageInfo?.endCursor || null;
    }

    // Get existing issues from sheets
    const existingIssues = await getSheet('issues');

    // Create mappings: github_number -> issue_type
    const issueTypeMap = new Map();
    for (const item of allItems) {
      const issue = item.content;
      if (!issue) continue;

      const fieldValues = item.fieldValues?.nodes || [];
      const issueTypeField = fieldValues.find((fv: any) => fv.field?.name?.toLowerCase() === 'issue_type');

      if (issueTypeField) {
        issueTypeMap.set(String(issue.number), issueTypeField.name);
      }
    }

    // Update sheets with issue_type
    const updates: { range: string; values: any[][] }[] = [];
    let updatedCount = 0;

    for (let i = 0; i < existingIssues.length; i++) {
      const issue = existingIssues[i];
      const githubNumber = String(issue.github_number);
      const issueType = issueTypeMap.get(githubNumber);

      if (issueType && issue.issue_type !== issueType) {
        const rowIndex = i + 2; // +1 for header, +1 for 1-based indexing
        const issueRow = Object.values(issue);
        issueRow[12] = issueType; // Update issue_type column (index 12)
        
        updates.push({
          range: `issues!A${rowIndex}`,
          values: [issueRow],
        });
        updatedCount++;
      }
    }

    if (updates.length > 0) {
      await batchUpdateRows(updates);
    }

    return NextResponse.json({
      success: true,
      project: allItems[0]?.content?.repository?.name || 'Unknown',
      issuesProcessed: allItems.length,
      issuesWithType: issueTypeMap.size,
      sheetsUpdated: updatedCount,
    });
  } catch (error: any) {
    // Handle rate limit errors
    if (error.errors && error.errors[0]?.type === 'RATE_LIMIT') {
      const resetTime = error.headers?.['x-ratelimit-reset'];
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
      const now = new Date();
      const resetMs = resetDate ? resetDate.getTime() - now.getTime() : 0;
      const resetMinutes = Math.ceil(resetMs / 60000);

      return NextResponse.json(
        {
          error: 'GitHub API rate limit exceeded',
          resetAt: resetDate,
          resetInMinutes: resetMinutes,
          message: `Please try again in ${resetMinutes} minutes`,
        },
        { status: 429 }
      );
    }

    console.error('Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Request failed' },
      { status: 500 }
    );
  }
}
