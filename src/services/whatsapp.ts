import fs from "node:fs";
import path from "node:path";
import type { Boom } from "@hapi/boom";
import makeWASocket, {
  DisconnectReason,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  getContentType,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";

const logger = pino({ level: "warn" });

// ========== Config ==========

const AUTH_DIR = process.env.WHATSAPP_AUTH_DIR ?? "data/whatsapp-auth";
const RATE_LIMIT_PER_HOUR = Number(process.env.WHATSAPP_RATE_LIMIT ?? "5");
const MAX_FILE_SIZE_MB = 20;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const CV_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

// ========== Types ==========

export type WhatsAppStatus = "disconnected" | "connecting" | "connected" | "error";

export type IncomingDocument = {
  messageId: string;
  senderJid: string;
  senderName: string | null;
  senderPhone: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  timestamp: Date;
};

type DocumentHandler = (doc: IncomingDocument) => Promise<void>;
type TextHandler = (phone: string, jid: string, text: string) => Promise<void>;

// ========== Phone Sanitization ==========

/** Extract and validate phone number from JID. */
function sanitizePhone(jid: string): string {
  const raw = jid.replace(/@.*$/, "");
  const cleaned = raw.replace(/[^\d]/g, "");
  if (cleaned.length < 10 || cleaned.length > 15) {
    throw new Error(`Invalid phone number format: ${cleaned.length} digits`);
  }
  return cleaned;
}

// ========== Rate Limiter ==========

class PhoneRateLimiter {
  private counts = new Map<string, { count: number; resetAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Clean up expired entries every hour
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [phone, entry] of this.counts.entries()) {
        if (now > entry.resetAt) {
          this.counts.delete(phone);
        }
      }
    }, 3600_000);
  }

  check(phone: string): boolean {
    const now = Date.now();
    const entry = this.counts.get(phone);
    if (!entry || now > entry.resetAt) {
      this.counts.set(phone, { count: 1, resetAt: now + 3600_000 });
      return true;
    }
    if (entry.count >= RATE_LIMIT_PER_HOUR) return false;
    entry.count++;
    return true;
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ========== Gateway ==========

/** Singleton WhatsApp connection manager using Baileys. */
class WhatsAppGateway {
  private sock: WASocket | null = null;
  private status: WhatsAppStatus = "disconnected";
  private onDocumentHandler: DocumentHandler | null = null;
  private onTextHandler: TextHandler | null = null;
  private rateLimiter = new PhoneRateLimiter();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private abortController: AbortController | null = null;

  /** Per-sender processing locks to prevent race conditions. */
  private processingLocks = new Map<string, Promise<void>>();

  getStatus(): WhatsAppStatus {
    return this.status;
  }

  /** Register a handler for incoming CV documents. */
  onDocument(handler: DocumentHandler): void {
    this.onDocumentHandler = handler;
  }

  /** Register a handler for incoming text messages. */
  onText(handler: TextHandler): void {
    this.onTextHandler = handler;
  }

  /** Connect to WhatsApp via Baileys. QR code printed to terminal on first auth. */
  async connect(): Promise<void> {
    if (this.status === "connected" || this.status === "connecting") return;
    this.status = "connecting";
    this.abortController = new AbortController();

    // Ensure auth directory exists
    const authPath = path.resolve(AUTH_DIR);
    if (!fs.existsSync(authPath)) {
      fs.mkdirSync(authPath, { recursive: true });
    }

    // biome-ignore lint/correctness/useHookAtTopLevel: Baileys function, not a React hook
    const { state, saveCreds } = await useMultiFileAuthState(authPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: true,
      auth: state,
      connectTimeoutMs: 60_000,
      keepAliveIntervalMs: 30_000,
      generateHighQualityLinkPreview: false,
    });

    this.sock = sock;

    // Save credentials on update
    sock.ev.on("creds.update", saveCreds);

    // Connection state management
    sock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        this.status = "connected";
        this.reconnectAttempts = 0;
        console.log("[WhatsApp] Connected");
      }

      if (connection === "close") {
        this.status = "disconnected";
        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          this.status = "error";
          console.error("[WhatsApp] Logged out. Delete auth folder and re-scan QR.");
          return;
        }

        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          this.status = "error";
          console.error("[WhatsApp] Max reconnect attempts reached. Manual intervention required.");
          return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(3000 * this.reconnectAttempts, 60_000);
        console.log(`[WhatsApp] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})...`);
        setTimeout(() => this.connect(), delay);
      }
    });

    // Handle incoming messages
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const senderJid = msg.key.remoteJid ?? "";
        let senderPhone: string;
        try {
          senderPhone = sanitizePhone(senderJid);
        } catch {
          continue; // Skip invalid phone numbers
        }

        const contentType = getContentType(msg.message);

        // Handle text messages (for GDPR deletion commands)
        if (contentType === "conversation" || contentType === "extendedTextMessage") {
          const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
          if (this.onTextHandler) {
            try {
              await this.onTextHandler(senderPhone, senderJid, text);
            } catch (err) {
              console.error("[WhatsApp] Text handler error:", err);
            }
          }
          continue;
        }

        // Only process document messages from here
        if (contentType !== "documentMessage") continue;

        const doc = msg.message.documentMessage;
        if (!doc?.mimetype || !CV_MIME_TYPES.has(doc.mimetype)) continue;

        // File size check before downloading
        const fileSize = Number(doc.fileLength ?? 0);
        if (fileSize > MAX_FILE_SIZE_BYTES) {
          await this.sendText(
            senderJid,
            `❌ Bestand te groot (${Math.round(fileSize / 1024 / 1024)}MB). Maximaal ${MAX_FILE_SIZE_MB}MB toegestaan.`,
          );
          continue;
        }

        // Rate limit per phone number
        if (!this.rateLimiter.check(senderPhone)) {
          await this.sendText(
            senderJid,
            "⚠️ Je hebt het maximum aantal CV-analyses per uur bereikt. Probeer het later opnieuw.",
          );
          continue;
        }

        // Per-sender lock to prevent race conditions on concurrent messages
        const existingLock = this.processingLocks.get(senderPhone);
        const processingPromise = (existingLock ?? Promise.resolve())
          .then(() => this.processDocument(sock, msg, doc, senderJid, senderPhone))
          .finally(() => {
            if (this.processingLocks.get(senderPhone) === processingPromise) {
              this.processingLocks.delete(senderPhone);
            }
          });

        this.processingLocks.set(senderPhone, processingPromise);
      }
    });
  }

  /** Process a single document message. Called within per-sender lock. */
  private async processDocument(
    sock: WASocket,
    msg: Parameters<typeof downloadMediaMessage>[0],
    doc: { fileName?: string | null; mimetype?: string | null },
    senderJid: string,
    senderPhone: string,
  ): Promise<void> {
    try {
      const buffer = (await downloadMediaMessage(
        msg,
        "buffer",
        {},
        { logger, reuploadRequest: sock.updateMediaMessage },
      )) as Buffer;

      const incoming: IncomingDocument = {
        messageId: (msg as { key: { id?: string } }).key.id ?? "",
        senderJid,
        senderName: (msg as { pushName?: string }).pushName ?? null,
        senderPhone,
        fileName: doc.fileName ?? `document_${Date.now()}`,
        mimeType: doc.mimetype ?? "application/octet-stream",
        fileBuffer: buffer,
        timestamp: new Date(
          ((msg as { messageTimestamp?: number }).messageTimestamp as number) * 1000,
        ),
      };

      console.log(`[WhatsApp] CV received from ${senderPhone}: ${incoming.fileName}`);

      if (this.onDocumentHandler) {
        await this.onDocumentHandler(incoming);
      }
    } catch (err) {
      console.error("[WhatsApp] Failed to process document:", {
        error: err instanceof Error ? err.message : String(err),
        sender: senderPhone,
      });
    }
  }

  /** Send a text message to a JID. */
  async sendText(jid: string, text: string): Promise<void> {
    if (!this.sock || this.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }
    await this.sock.sendMessage(jid, { text });
  }

  /** Send a file with optional caption. */
  async sendFile(
    jid: string,
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    caption?: string,
  ): Promise<void> {
    if (!this.sock || this.status !== "connected") {
      throw new Error("WhatsApp not connected");
    }
    await this.sock.sendMessage(jid, {
      document: buffer,
      fileName,
      mimetype: mimeType,
      caption,
    });
  }

  /** Disconnect gracefully. Clean up resources. */
  async disconnect(): Promise<void> {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
    }
    this.rateLimiter.destroy();
    this.processingLocks.clear();
    this.status = "disconnected";
    console.log("[WhatsApp] Disconnected");
  }

  /** Wait until the abort signal fires (for long-running tasks). */
  async waitUntilAborted(): Promise<void> {
    if (!this.abortController) return;
    return new Promise<void>((resolve) => {
      this.abortController?.signal.addEventListener("abort", () => resolve());
    });
  }
}

// ========== Singleton ==========

let instance: WhatsAppGateway | null = null;

export function getWhatsAppGateway(): WhatsAppGateway {
  if (!instance) {
    instance = new WhatsAppGateway();
  }
  return instance;
}

export { WhatsAppGateway };
