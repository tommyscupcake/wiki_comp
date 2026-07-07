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

    const teamId = (formData.get('teamId') as string || 'workspace').trim();
    const teamName = (formData.get('teamName') as string || 'Workspace').trim();
    const wikiId = (formData.get('wikiId') as string || 'general').trim();
    const wikiTitle = (formData.get('wikiTitle') as string || 'General').trim();

    // Sanitize names for safety and VPS cross-platform directory names
    const safeTeamName = teamName.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || `team_${teamId}`;
    const safeWikiTitle = wikiTitle.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || `wiki_${wikiId}`;

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const originalName = file.name || 'image.jpg';
    const filename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const relativeDir = `uploads/teams/${safeTeamName}/${safeWikiTitle}`;

    if (process.env.STORAGE_MODE === 's3') {
      const key = `${relativeDir}/${filename}`;
      await uploadObject(key, buffer, file.type || 'application/octet-stream');
      return NextResponse.json({ url: `/api/files/${key}` });
    }

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
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
