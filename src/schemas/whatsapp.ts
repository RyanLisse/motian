import { z } from "zod";

/** Allowed MIME types for CV documents */
export const CV_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type CVMimeType = (typeof CV_MIME_TYPES)[number];

/** Incoming WhatsApp document message */
export const whatsappIncomingDocSchema = z.object({
  messageId: z.string(),
  senderJid: z.string(),
  senderName: z.string().nullable(),
  senderPhone: z.string(),
  fileName: z.string(),
  mimeType: z.enum(CV_MIME_TYPES),
  timestamp: z.date(),
});

export type WhatsappIncomingDoc = z.infer<typeof whatsappIncomingDocSchema>;

/** Tracking record for processed WhatsApp CV messages */
export const whatsappProcessedSchema = z.object({
  messageId: z.string(),
  senderPhone: z.string(),
  processedAt: z.date(),
  candidateId: z.string().nullable(),
  matchCount: z.number(),
  success: z.boolean(),
  error: z.string().nullable(),
});

export type WhatsappProcessed = z.infer<typeof whatsappProcessedSchema>;
