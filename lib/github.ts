import { Octokit } from '@octokit/rest';

const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

// GraphQL client for custom fields
async function graphqlQuery(query: string, variables: any = {}) {
  const response = await octokit.graphql(query, variables);
  return response;
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

export async function getRepoIssues(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'all') {
  const allIssues = await octokit.paginate(octokit.issues.listForRepo, {
    owner,
    repo,
    state,
    per_page: 100,
  });

  return allIssues.filter(i => !i.pull_request); // exclude PRs
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

export async function getRepoMilestones(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
  const { data } = await octokit.issues.listMilestones({ owner, repo, state, per_page: 100 });
  return data;
}