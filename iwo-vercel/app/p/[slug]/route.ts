import { NextRequest } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const templatePath = path.join(process.cwd(), 'public', 'templates', 'product.html');

  try {
    let html = await readFile(templatePath, 'utf-8');

    // Injeta o slug como variável para o products.js usar
    html = html.replace(
      '</head>',
      `<script>window.__PRODUCT_SLUG__ = "${slug}";</script>\n</head>`
    );

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  } catch {
    return new Response('Página não encontrada', { status: 404 });
  }
}
