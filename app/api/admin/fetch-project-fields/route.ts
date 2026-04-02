import { NextResponse, NextRequest } from 'next/server';
import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, repo } = body;

    if (!projectId || !repo) {
      return NextResponse.json({ error: 'Missing projectId or repo' }, { status: 400 });
    }

    // Query the project to get all items with their custom fields
    const query = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            id
            title
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue {
                    number
                    repository {
                      name
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

    const response = await octokit.graphql(query, { projectId });
    const projectNode = response.node;

    if (!projectNode || !projectNode.items) {
      return NextResponse.json({ error: 'Project not found or has no items' }, { status: 404 });
    }

    // Extract issue_type mappings
    const issueTypeMappings = new Map();
    for (const item of projectNode.items.nodes) {
      const issue = item.content;
      if (!issue || issue.repository.name !== repo) continue;

      const fieldValues = item.fieldValues?.nodes || [];
      const issueTypeField = fieldValues.find((fv: any) => fv.field?.name?.toLowerCase() === 'issue_type');

      if (issueTypeField) {
        issueTypeMappings.set(String(issue.number), issueTypeField.name);
      }
    }

    return NextResponse.json({
      success: true,
      project: projectNode.title,
      mappings: Object.fromEntries(issueTypeMappings),
      count: issueTypeMappings.size,
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
