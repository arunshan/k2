import {
  S3Client,
  PutObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const bucket =
  process.env.S3_DOCUMENTS_BUCKET ?? "k2-documents";
const region = process.env.AWS_REGION ?? "us-east-1";

const client = new S3Client({ region });

export async function uploadDocument(
  file: Buffer,
  fileName: string,
  contentType: string
): Promise<{ key: string; url: string }> {
  const key = `documents/${Date.now()}-${fileName}`;

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: file,
      ContentType: contentType,
    })
  );

  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 3600 }
  );

  return { key, url };
}

export async function listDocuments(): Promise<
  { key: string; name: string; size: number; lastModified: string }[]
> {
  const result = await client.send(
    new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: "documents/",
    })
  );

  const contents = result.Contents ?? [];

  return contents
    .filter((obj): obj is { Key: string; Size?: number; LastModified?: Date } => !!obj.Key)
    .map((obj) => ({
      key: obj.Key!,
      name: obj.Key!.replace(/^documents\/\d+-/, ""),
      size: obj.Size ?? 0,
      lastModified: (obj.LastModified ?? new Date()).toISOString(),
    }));
}

export async function deleteDocument(key: string): Promise<void> {
  await client.send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
}

export async function getPresignedUploadUrl(
  fileName: string,
  contentType: string
): Promise<{ key: string; uploadUrl: string }> {
  const key = `documents/${Date.now()}-${fileName}`;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 3600 }
  );

  return { key, uploadUrl };
}
