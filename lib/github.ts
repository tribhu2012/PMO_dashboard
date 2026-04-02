import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// GraphQL client for custom fields with error handling
async function graphqlQuery(query: string, variables: any = {}) {
  try {
    const response = await octokit.graphql(query, variables);
    return response;
  } catch (error: any) {
    // Handle rate limit errors specifically
    if (error.errors && error.errors[0]?.type === 'RATE_LIMIT') {
      const resetTime = error.headers?.['x-ratelimit-reset'];
      const resetDate = resetTime ? new Date(parseInt(resetTime) * 1000) : null;
      const rateLimitError = new Error('GitHub API rate limit exceeded');
      (rateLimitError as any).rateLimitReset = resetDate;
      (rateLimitError as any).rateLimited = true;
      throw rateLimitError;
    }
    throw error;
  }
}

export function getRateLimitInfo(error: any) {
  if (error.rateLimitReset) {
    const now = new Date();
    const resetMs = error.rateLimitReset.getTime() - now.getTime();
    const resetMinutes = Math.ceil(resetMs / 60000);
    return {
      rateLimited: true,
      resetTime: error.rateLimitReset,
      resetInMinutes: resetMinutes,
    };
  }
  return { rateLimited: false };
}

// Fetch custom field values from a GitHub Project
export async function getProjectCustomFields(projectId: string): Promise<Map<number, string>> {
  const issueTypeMap = new Map<number, string>();
  
  try {
    const query = `
      query($projectId: ID!, $after: String) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 100, after: $after) {
              pageInfo { hasNextPage endCursor }
              nodes {
                content {
                  ... on Issue { number }
                }
                fieldValues(first: 20) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue {
                      field {
                        ... on ProjectV2SingleSelectField { name }
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

    let hasNextPage = true;
    let after: string | null = null;

    while (hasNextPage) {
      try {
        const response: any = await graphqlQuery(query, { projectId, after });
        const project = response.node;
        
        if (!project?.items) break;

        const items = project.items.nodes || [];
        
        for (const item of items) {
          const issue = item.content;
          if (!issue?.number) continue;

          const fieldValues = item.fieldValues?.nodes || [];
          const issueTypeField = fieldValues.find((fv: any) => 
            fv.field?.name?.toLowerCase() === 'issue_type'
          );

          if (issueTypeField?.name) {
            issueTypeMap.set(issue.number, issueTypeField.name);
          }
        }

        hasNextPage = project.items.pageInfo?.hasNextPage || false;
        after = project.items.pageInfo?.endCursor || null;
      } catch (error: any) {
        // If rate limited or error, stop but return what we have
        if (error.rateLimited) {
          console.warn(`Rate limit hit while fetching project ${projectId} custom fields`);
          break;
        }
        throw error;
      }
    }
  } catch (error) {
    console.error(`Error fetching custom fields for project ${projectId}:`, error);
  }

  return issueTypeMap;
}

export async function createIssue(
  owner: string, repo: string,
  title: string, body: string,
  assignees: string[], labels: string[],
  milestone?: number,
  projectId?: string
) {
  // Create issue with milestone if provided
  const { data } = await octokit.issues.create({
    owner, repo, title, body, assignees, labels,
    ...(milestone ? { milestone } : {})
  });

  // Assign to project if provided (GitHub GraphQL API)
  if (projectId) {
    // Get node_id for the issue
    const issueNodeId = data.node_id;
    // Add issue to project (v2 API)
    await graphqlQuery(
      `mutation AddIssueToProject($projectId:ID!, $contentId:ID!) {
        addProjectV2ItemById(input: {projectId: $projectId, contentId: $contentId}) {
          item { id }
        }
      }`,
      { projectId, contentId: issueNodeId }
    );
  }
  return data;
}

export async function getIssue(owner: string, repo: string, issue_number: number) {
  const { data } = await octokit.issues.get({ owner, repo, issue_number });
  return data;
}

export async function getIssueComments(owner: string, repo: string, issue_number: number) {
  const { data } = await octokit.issues.listComments({ owner, repo, issue_number });
  return data;
}

export async function addComment(
  owner: string, repo: string,
  issue_number: number, body: string
) {
  const { data } = await octokit.issues.createComment({ owner, repo, issue_number, body });
  return data;
}

export async function getRepoIssues(owner: string, repo: string, state: 'OPEN' | 'CLOSED' | 'ALL' = 'ALL') {
  // Lightweight query - no expensive projectItems lookup
  const query = `
    query($owner:String!, $repo:String!, $state:[IssueState!], $after:String) {
      repository(owner:$owner, name:$repo) {
        issues(first:100, states:$state, orderBy:{field:UPDATED_AT, direction:DESC}, after:$after) {
          pageInfo { hasNextPage endCursor }
          nodes {
            id number title state createdAt updatedAt
            assignees(first:1) { nodes { login } }
            labels(first:10) { nodes { name } }
            milestone { id number title state dueOn }
          }
        }
      }
    }
  `;

  const stateArg = state === 'ALL' ? ['OPEN', 'CLOSED'] : [state];
  let allIssues: any[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: any = await graphqlQuery(query, { owner, repo, state: stateArg, after });
    const issues = response.repository.issues.nodes || [];
    allIssues = allIssues.concat(issues);
    hasNextPage = response.repository.issues.pageInfo?.hasNextPage || false;
    after = response.repository.issues.pageInfo?.endCursor || null;
  }
  
  // Normalize to look like the rest of the application's issue objects
  // issue_type will be set from GitHub Project custom fields in the sync process
  return allIssues.map((issue: any) => {
    const labels = issue.labels?.nodes || [];
    
    return {
      id: issue.id,
      number: issue.number,
      title: issue.title,
      state: issue.state.toLowerCase(),
      created_at: issue.createdAt,
      updated_at: issue.updatedAt,
      assignee: issue.assignees.nodes[0],
      labels: labels,
      milestone: issue.milestone,
      project_title: '',
      project_id: '',
      issue_type: '', // Will be populated from project custom fields
    };
  });
}

export async function getRepoTags(owner: string, repo: string) {
  const { data } = await octokit.repos.listTags({ owner, repo });
  return data;
}

function normalizeDueDate(val?: string) {
  if (!val) return undefined;
  const dateOnly = val.split('T')[0];
  // GitHub requires full date-time in UTC, e.g. 2026-03-13T00:00:00Z
  const parsed = new Date(`${dateOnly}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export async function createMilestone(owner: string, repo: string, title: string, description?: string, due_on?: string) {
  const dueDate = normalizeDueDate(due_on);
  const { data } = await octokit.issues.createMilestone({
    owner,
    repo,
    title,
    ...(description ? { description } : {}),
    ...(dueDate ? { due_on: dueDate } : {}),
  });
  return data;
}

export async function getRepoMilestones(owner: string, repo: string, state: 'OPEN' | 'CLOSED' | 'ALL' = 'OPEN') {
  const query = `
    query($owner:String!, $repo:String!, $state:[MilestoneState!], $after:String) {
      repository(owner:$owner, name:$repo) {
        milestones(first:100, states:$state, orderBy:{field:DUE_DATE, direction:DESC}, after:$after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            number
            title
            state
            description
            dueOn
          }
        }
      }
    }
  `;

  const stateArg = state === 'ALL' ? ['OPEN', 'CLOSED'] : [state];
  let allMilestones: any[] = [];
  let after: string | null = null;
  let hasNextPage = true;

  while (hasNextPage) {
    const response: any = await graphqlQuery(query, { owner, repo, state: stateArg, after });
    const milestones = response.repository.milestones.nodes || [];
    
    allMilestones = allMilestones.concat(milestones);
    hasNextPage = response.repository.milestones.pageInfo?.hasNextPage || false;
    after = response.repository.milestones.pageInfo?.endCursor || null;
  }
  
  return allMilestones.map((m: any) => ({
    id: m.id,
    number: m.number,
    title: m.title,
    state: m.state.toLowerCase(),
    description: m.description,
    due_on: m.dueOn,
  }));
}