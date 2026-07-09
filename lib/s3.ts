import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// No accessKeyId/secretAccessKey here on purpose: the SDK falls back to the
// default credential provider chain, which picks up the EC2 instance's IAM role.
export const s3Client = new S3Client({
  region: process.env.AWS_REGION,
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
  const key = `documents/${doc.id}/${Date.now()}.json`;
  const body = Buffer.from(JSON.stringify(doc, null, 2), 'utf-8');
  await uploadObject(key, body, 'application/json');
}
