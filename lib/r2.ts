import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3"

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const BUCKET = process.env.R2_BUCKET_NAME!
const PUBLIC_URL = process.env.R2_PUBLIC_URL!

function avatarKey(ownershipId: string): string {
  return `avatars/${ownershipId}.jpg`
}

export function avatarPublicUrl(ownershipId: string): string {
  return `${PUBLIC_URL}/${avatarKey(ownershipId)}`
}

export async function uploadAvatar(ownershipId: string, jpegBuffer: Buffer): Promise<string> {
  const key = avatarKey(ownershipId)
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: jpegBuffer,
      ContentType: "image/jpeg",
      CacheControl: "public, max-age=0, must-revalidate",
    })
  )
  return `${avatarPublicUrl(ownershipId)}?v=${Date.now()}`
}

export async function deleteAvatar(ownershipId: string): Promise<void> {
  await r2.send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: avatarKey(ownershipId),
    })
  )
}
