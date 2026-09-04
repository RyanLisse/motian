import { Buffer } from "node:buffer";
import { describe, expect, it } from "vitest";
import { validateCvUploadBuffer } from "@/src/lib/cv-upload";

function file(name: string, type: string, size: number) {
  return { name, type, size };
}

function localFileHeader(name: string, payload: Buffer, uncompressedSize = payload.length): Buffer {
  const nameBuffer = Buffer.from(name, "utf8");
  const header = Buffer.alloc(30);
  header.writeUInt32LE(0x04034b50, 0);
  header.writeUInt16LE(20, 4);
  header.writeUInt16LE(0, 6);
  header.writeUInt16LE(0, 8);
  header.writeUInt32LE(0, 10);
  header.writeUInt32LE(0, 14);
  header.writeUInt32LE(payload.length, 18);
  header.writeUInt32LE(uncompressedSize, 22);
  header.writeUInt16LE(nameBuffer.length, 26);
  header.writeUInt16LE(0, 28);
  return Buffer.concat([header, nameBuffer, payload]);
}

function centralDirectoryMarker(): Buffer {
  const marker = Buffer.alloc(4);
  marker.writeUInt32LE(0x02014b50, 0);
  return marker;
}

describe("CV upload content validation", () => {
  it("accepts a PDF whose bytes start with a PDF header", () => {
    const result = validateCvUploadBuffer(
      file("cv.pdf", "application/pdf", 16),
      Buffer.from("%PDF-1.7\nbody"),
    );

    expect(result).toEqual({ ok: true, mimeType: "application/pdf" });
  });

  it("rejects a PDF extension with non-PDF bytes", () => {
    const result = validateCvUploadBuffer(file("cv.pdf", "text/plain", 10), Buffer.from("hello"));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_content");
  });

  it("accepts a DOCX container with word/document.xml", () => {
    const buffer = Buffer.concat([
      localFileHeader("[Content_Types].xml", Buffer.from("types")),
      localFileHeader("word/document.xml", Buffer.from("doc")),
      centralDirectoryMarker(),
    ]);

    const result = validateCvUploadBuffer(
      file(
        "cv.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        buffer.length,
      ),
      buffer,
    );

    expect(result).toEqual({
      ok: true,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  });

  it("rejects DOCX containers missing word/document.xml", () => {
    const buffer = Buffer.concat([
      localFileHeader("[Content_Types].xml", Buffer.from("types")),
      centralDirectoryMarker(),
    ]);

    const result = validateCvUploadBuffer(file("cv.docx", "", buffer.length), buffer);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_content");
  });

  it("rejects DOCX containers with path traversal entries", () => {
    const buffer = Buffer.concat([
      localFileHeader("../evil.txt", Buffer.from("bad")),
      localFileHeader("word/document.xml", Buffer.from("doc")),
      centralDirectoryMarker(),
    ]);

    const result = validateCvUploadBuffer(file("cv.docx", "", buffer.length), buffer);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_content");
  });

  it("rejects DOCX containers with suspicious compression ratios", () => {
    const buffer = Buffer.concat([
      localFileHeader("word/document.xml", Buffer.from("x"), 10_000),
      centralDirectoryMarker(),
    ]);

    const result = validateCvUploadBuffer(file("cv.docx", "", buffer.length), buffer);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_content");
  });

  it("rejects DOCX containers exceeding the maximum entry count", () => {
    // MAX_DOCX_ENTRIES is 512. Put word/document.xml as entry 513 so that,
    // if the count guard were removed, the container would otherwise be
    // fully valid (has document.xml + a matching central directory marker)
    // and only the guard under test explains a rejection.
    const entries: Buffer[] = [];
    for (let i = 0; i < 512; i++) {
      entries.push(localFileHeader(`f${i}.bin`, Buffer.alloc(0)));
    }
    entries.push(localFileHeader("word/document.xml", Buffer.from("doc")));
    const buffer = Buffer.concat([...entries, centralDirectoryMarker()]);

    const result = validateCvUploadBuffer(file("cv.docx", "", buffer.length), buffer);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_content");
  });

  it("rejects DOCX containers with an entry name exceeding the maximum length", () => {
    // MAX_DOCX_ENTRY_NAME_LENGTH is 260; use 261 to trip the limit. A valid
    // word/document.xml entry follows so an otherwise-valid container is the
    // only thing standing between "passes" and "the guard under test fired".
    const longName = "a".repeat(261);
    const buffer = Buffer.concat([
      localFileHeader(longName, Buffer.from("x")),
      localFileHeader("word/document.xml", Buffer.from("doc")),
      centralDirectoryMarker(),
    ]);

    const result = validateCvUploadBuffer(file("cv.docx", "", buffer.length), buffer);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_content");
  });

  it("rejects DOCX containers exceeding the maximum uncompressed size", () => {
    // MAX_DOCX_UNCOMPRESSED_BYTES is 50MB; declare an uncompressed size above
    // that while keeping the compression ratio (~53x) under the 100x limit,
    // so the size guard trips rather than the ratio guard. A valid
    // word/document.xml entry follows so an otherwise-valid container is the
    // only thing standing between "passes" and "the guard under test fired".
    const payload = Buffer.alloc(1_000_000);
    const buffer = Buffer.concat([
      localFileHeader("large.bin", payload, 51 * 1024 * 1024),
      localFileHeader("word/document.xml", Buffer.from("doc")),
      centralDirectoryMarker(),
    ]);

    const result = validateCvUploadBuffer(file("cv.docx", "", buffer.length), buffer);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe("invalid_content");
  });
});
