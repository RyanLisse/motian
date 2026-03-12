import type { EvidenceKind } from "../types/evidence";

export function inferEvidenceContentType(kind: EvidenceKind): string {
  switch (kind) {
    case "screenshot":
      return "image/png";
    case "video":
      return "video/webm";
    case "har":
      return "application/json";
    case "trace":
      return "application/zip";
    case "console-log":
    case "network-log":
      return "text/plain; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}
