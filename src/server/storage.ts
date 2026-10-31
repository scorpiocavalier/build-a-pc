import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Product images live in Cloudflare R2 in production. Without R2 settings
// (local development) they are written to .uploads/ and served by
// /api/uploads/[...key].

const r2 = process.env.R2_BUCKET
  ? {
      bucket: process.env.R2_BUCKET,
      publicUrl: process.env.R2_PUBLIC_URL!.replace(/\/$/, ""),
      client: new S3Client({
        region: "auto",
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID!,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
        },
      }),
    }
  : null;

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export const usesLocalStorage = !r2;

export function publicUrl(key: string): string {
  return r2 ? `${r2.publicUrl}/${key}` : `/api/uploads/${key}`;
}

export async function putObject(key: string, body: Buffer, contentType: string) {
  if (r2) {
    await r2.client.send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return;
  }
  if (process.env.VERCEL) {
    throw new Error("R2 is not configured; set the R2_* environment variables.");
  }
  const file = localPath(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, body);
}

export async function readLocalObject(key: string): Promise<Buffer | null> {
  try {
    return await readFile(localPath(key));
  } catch {
    return null;
  }
}

function localPath(key: string): string {
  const file = path.resolve(LOCAL_DIR, key);
  if (!file.startsWith(LOCAL_DIR + path.sep)) throw new Error("Invalid storage key");
  return file;
}
