import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { uploadObject } from '@/lib/s3';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const userId = (formData.get('userId') as string || '').trim();
    const safeUserId = userId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'unknown-user';

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = file.name || 'image.jpg';
    const filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const relativeDir = `users/${safeUserId}/uploads`;

    if (process.env.STORAGE_MODE === 's3') {
      const key = `${relativeDir}/${filename}`;
      await uploadObject(key, buffer, file.type || 'application/octet-stream');
      return NextResponse.json({ url: `/api/files/${key}` });
    }

    console.warn('STORAGE_MODE is not "s3" — file uploaded to local disk, not S3. Set STORAGE_MODE=s3 to enable S3 uploads.');
    // Local filesystem fallback for dev environments without S3 configured
    const uploadDir = join(process.cwd(), 'public', relativeDir);
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Ignore if it already exists
    }

    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    return NextResponse.json({ url: `/${relativeDir}/${filename}` });
  } catch (error) {
    console.error('Error uploading file to S3:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
