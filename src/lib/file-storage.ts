import { del, put } from "@vercel/blob";

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
): Promise<{ url: string; pathname: string }> {
  const blob = await put(filename, buffer, {
    access: "private",
    contentType,
  });
  return { url: blob.url, pathname: blob.pathname };
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
