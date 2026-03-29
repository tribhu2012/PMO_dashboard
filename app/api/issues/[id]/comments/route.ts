import { NextRequest, NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';
import { getIssueComments, addComment } from '@/lib/github';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const issues = await getSheet('issues');
  const issue = issues.find(i => i.id === id);
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const products = await getSheet('products');
  const product = products.find(p => p.id === issue.product_id);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const repo = product.github_repos.split(',')[0].trim();
  const comments = await getIssueComments(
    product.github_owner,
    repo,
    Number(issue.github_number)
  );

  return NextResponse.json(comments);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { body } = await req.json();

  const issues = await getSheet('issues');
  const issue = issues.find(i => i.id === id);
  if (!issue) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const products = await getSheet('products');
  const product = products.find(p => p.id === issue.product_id);
  if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

  const repo = product.github_repos.split(',')[0].trim();
  const comment = await addComment(
    product.github_owner,
    repo,
    Number(issue.github_number),
    body
  );

  return NextResponse.json(comment);
}