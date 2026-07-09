import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

// Explicit static credentials when AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY are
// set (current deployment: a static IAM user). If they're absent, no
// `credentials` field is passed at all, so the SDK falls back to its default
// provider chain (e.g. an EC2 instance IAM role) — switching auth modes later
// needs no code change.
export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
  ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
});

export function getBucketName(): string {
  const bucket = process.env.S3_BUCKET_NAME;
  if (!bucket) {
    throw new Error('S3_BUCKET_NAME is not set');
  }
  return bucket;
}

export async function uploadObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function getObject(key: string) {
  return s3Client.send(
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: key,
    })
  );
}

// Best-effort JSON backup of a document's content, written alongside (not
// instead of) the Postgres save. Callers must catch/log failures themselves —
// this never blocks or fails a document save.
export async function backupDocumentToS3(doc: { id: string; [key: string]: unknown }): Promise<void> {
  if (!doc?.id) return;
  const ownerId = typeof doc.ownerId === 'string' && doc.ownerId ? doc.ownerId : 'unknown-user';
  const key = `users/${ownerId}/documents/${doc.id}/${Date.now()}.json`;
  const body = Buffer.from(JSON.stringify(doc, null, 2), 'utf-8');
  await uploadObject(key, body, 'application/json');
}
