import { NextRequest, NextResponse } from 'next/server';
import { getSheet } from '@/lib/sheets';
import { createMilestone } from '@/lib/github';

export async function POST(req: NextRequest) {
  const { product_id, title, description, due_date } = await req.json();

  if (!product_id || !title) {
    return NextResponse.json({ error: 'product_id and title are required' }, { status: 400 });
  }

  const products = await getSheet('products');
  const product = products.find((p: any) => p.id === product_id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  const repo = product.github_repos.split(',')[0].trim();
  const owner = product.github_owner;

  const milestone = await createMilestone(owner, repo, title, description, due_date);

  return NextResponse.json({ success: true, milestone });
}
