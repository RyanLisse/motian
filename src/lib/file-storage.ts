import { del, put } from "@vercel/blob";

/**
 * Upload a file to blob storage.
 * Returns the public URL and pathname.
 */
export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
): Promise<{ url: string; pathname: string }> {
  const blob = await put(filename, buffer, {
    access: "public",
    contentType,
  });
  return { url: blob.url, pathname: blob.pathname };
}

/**
 * Download a file from its URL.
 */
export async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
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
