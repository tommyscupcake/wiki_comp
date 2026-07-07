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
