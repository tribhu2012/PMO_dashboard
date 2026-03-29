import { NextRequest, NextResponse } from 'next/server';
import { createIssue } from '@/lib/github';
import { appendRow, getSheet } from '@/lib/sheets';

export async function POST(req: NextRequest) {
  const { product_id, milestone_id, title, body, assignees, labels } = await req.json();

  const products = await getSheet('products');
  const product = products.find(p => p.id === product_id);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const repo = product.github_repos.split(',')[0].trim();
  const ghIssue = await createIssue(
    product.github_owner, repo, title, body, assignees, labels
  );

  const id = `iss_${ghIssue.id}`;
  const now = new Date().toISOString();
  await appendRow('issues', [
    id, milestone_id, product_id,
    String(ghIssue.id), String(ghIssue.number),
    title, 'open', assignees[0] || '', labels.join(','),
    now, now
  ]);

  return NextResponse.json({ id, github_number: ghIssue.number });
}