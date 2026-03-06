import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFile } from "@/src/lib/file-storage";

describe("downloadFile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.BLOB_READ_WRITE_TOKEN;
  });

  it("sends bearer auth for private vercel blob urls", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    const buffer = await downloadFile("https://store.blob.vercel-storage.com/cv/test.pdf");

    expect(buffer.equals(Buffer.from([1, 2, 3]))).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith("https://store.blob.vercel-storage.com/cv/test.pdf", {
      headers: { Authorization: "Bearer blob-token" },
    });
  });

  it("does not send blob auth headers for non-blob urls", async () => {
    process.env.BLOB_READ_WRITE_TOKEN = "blob-token";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new Uint8Array([4, 5]).buffer,
    });
    vi.stubGlobal("fetch", fetchMock);

    await downloadFile("https://example.com/file.pdf");

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/file.pdf", {
      headers: undefined,
    });
  });
});
