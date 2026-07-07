import { NextRequest, NextResponse } from 'next/server';
import { getObject } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string[] }> }) {
  const { key } = await params;
  const objectKey = key.join('/');

  try {
    const result = await getObject(objectKey);
    if (!result.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const webStream = result.Body.transformToWebStream();
    return new NextResponse(webStream as any, {
      headers: {
        'Content-Type': result.ContentType || 'application/octet-stream',
        ...(result.ContentLength ? { 'Content-Length': String(result.ContentLength) } : {}),
      },
    });
  } catch (error) {
    console.error('Error fetching S3 object:', error instanceof Error ? error.message : 'unknown error');
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }
}
