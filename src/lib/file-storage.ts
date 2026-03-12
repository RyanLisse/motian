import { del, put } from "@vercel/blob";

export interface UploadFileOptions {
  cacheControlMaxAge?: number;
}

function isVercelBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.endsWith(".vercel-storage.com") ||
      parsed.hostname.endsWith(".blob.vercel-storage.com")
    );
  } catch {
    return false;
  }
}

/**
 * Upload a file to blob storage.
 * Returns the URL and pathname. Uses the store's configured access level.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
  options?: UploadFileOptions,
): Promise<{ url: string; pathname: string; downloadUrl: string }> {
  const blob = await put(filename, buffer, {
    access: "private",
    cacheControlMaxAge: options?.cacheControlMaxAge,
    contentType,
  });
  return { downloadUrl: blob.downloadUrl, pathname: blob.pathname, url: blob.url };
}

/**
 * Download a file from its URL.
 */
export async function downloadFile(url: string): Promise<Buffer> {
  const headers =
    isVercelBlobUrl(url) && process.env.BLOB_READ_WRITE_TOKEN
      ? { Authorization: `Bearer ${process.env.BLOB_READ_WRITE_TOKEN}` }
      : undefined;

  const response = await fetch(url, { headers });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * Delete a file from blob storage.
 */
export async function deleteFile(url: string): Promise<void> {
  await del(url);
}
