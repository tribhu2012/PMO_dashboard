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
  assignees: string[], labels: string[]
) {
  const { data } = await octokit.issues.create({
    owner, repo, title, body, assignees, labels
  });
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

export async function getRepoMilestones(owner: string, repo: string, state: 'open' | 'closed' | 'all' = 'open') {
  const { data } = await octokit.issues.listMilestones({ owner, repo, state, per_page: 100 });
  return data;
}