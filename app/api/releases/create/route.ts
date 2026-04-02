import { NextRequest, NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';
import { createMilestone } from '@/lib/github';

export async function POST(req: NextRequest) {
  const { title, description, due_date } = await req.json();

  if (!title) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }

  // Get owner and repo from first product
  const products = await getSheet('products');
  if (!products.length) {
    return NextResponse.json({ error: 'No products configured' }, { status: 500 });
  }

  const product = products[0];
  const owner = product.github_owner;
  const repo = product.github_repos.split(',')[0].trim();

  if (!owner || !repo) {
    return NextResponse.json({ error: 'Product missing GitHub owner or repo configuration' }, { status: 500 });
  }

  const milestone = await createMilestone(owner, repo, title, description, due_date);

  return NextResponse.json({ success: true, milestone });
}
