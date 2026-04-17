import type {
  AttachmentRequest,
  InboxSubscription,
  InboxSubscriptionRequest,
  MailProvider,
  MailSendRequest,
  VerifyWebhookSignatureInput,
} from "./mail-provider";

const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const SUBSCRIPTION_WINDOW_MS = 1000 * 60 * 60 * 24 * 3;

interface GraphClientLike {
  api(path: string): {
    get: () => Promise<any>;
    post: (body: unknown) => Promise<any>;
  };
}

export interface Microsoft365ProviderOptions {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  expectedClientState: string;
  graphClient?: GraphClientLike;
  requireTlsCertificate?: boolean;
}

function getHeader(
  headers: Headers | Record<string, string | undefined>,
  key: string,
): string | undefined {
  if (headers instanceof Headers) {
    return headers.get(key) ?? undefined;
  }

  return headers[key] ?? headers[key.toLowerCase()];
}

function parseBase64(content: string): Buffer {
  return Buffer.from(content, "base64");
}

export function createMicrosoftGraphClient(options: {
  tenantId: string;
  clientId: string;
  clientSecret: string;
}): GraphClientLike {
  const tokenUrl = `https://login.microsoftonline.com/${options.tenantId}/oauth2/v2.0/token`;
  let cachedToken = "";
  let tokenExpiry = 0;

  async function getToken(): Promise<string> {
    if (cachedToken && tokenExpiry > Date.now() + 30_000) {
      return cachedToken;
    }

    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: options.clientId,
        client_secret: options.clientSecret,
        scope: GRAPH_SCOPE,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token ophalen mislukt (${response.status}).`);
    }

    const payload = (await response.json()) as { access_token: string; expires_in: number };
    cachedToken = payload.access_token;
    tokenExpiry = Date.now() + payload.expires_in * 1000;
    return cachedToken;
  }

  return {
    api(path: string) {
      return {
        get: async () => {
          const token = await getToken();
          const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!response.ok) {
            throw new Error(`Graph GET mislukt (${response.status}) op ${path}.`);
          }
          const contentType = response.headers.get("content-type") ?? "";
          if (contentType.includes("application/json")) {
            return response.json();
          }
          return response.arrayBuffer();
        },
        post: async (body: unknown) => {
          const token = await getToken();
          const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
          });
          if (!response.ok) {
            throw new Error(`Graph POST mislukt (${response.status}) op ${path}.`);
          }
          if (response.status === 204) {
            return {};
          }
          return response.json();
        },
      };
    },
  };
}

export class Microsoft365Provider implements MailProvider {
  private readonly graphClient: GraphClientLike;

  constructor(private readonly options: Microsoft365ProviderOptions) {
    this.graphClient =
      options.graphClient ??
      createMicrosoftGraphClient({
        tenantId: options.tenantId,
        clientId: options.clientId,
        clientSecret: options.clientSecret,
      });
  }

  async subscribeInbox(input: InboxSubscriptionRequest): Promise<InboxSubscription> {
    const payload = {
      changeType: "created,updated",
      notificationUrl: input.notificationUrl,
      lifecycleNotificationUrl: input.lifecycleNotificationUrl,
      resource: `/users/${input.mailbox}/messages`,
      clientState: input.clientState,
      expirationDateTime: new Date(Date.now() + SUBSCRIPTION_WINDOW_MS).toISOString(),
    };

    const response = await this.graphClient.api("/subscriptions").post(payload);

    return {
      id: response.id,
      expirationDateTime: response.expirationDateTime,
      resource: response.resource,
    };
  }

  async fetchAttachment(input: AttachmentRequest): Promise<Buffer> {
    if (input.messageId && input.attachmentId) {
      const attachment = await this.graphClient
        .api(`/users/${input.mailbox}/messages/${input.messageId}/attachments/${input.attachmentId}`)
        .get();

      if (!attachment.contentBytes) {
        throw new Error("Microsoft Graph attachment bevat geen inhoud.");
      }

      return parseBase64(attachment.contentBytes);
    }

    if (input.sharePointSiteId && input.driveId && input.itemId) {
      const file = await this.graphClient
        .api(`/sites/${input.sharePointSiteId}/drives/${input.driveId}/items/${input.itemId}/content`)
        .get();

      if (file instanceof ArrayBuffer) {
        return Buffer.from(file);
      }

      if (typeof file === "string") {
        return Buffer.from(file);
      }

      return Buffer.from(JSON.stringify(file));
    }

    throw new Error("Attachment-verzoek mist message/attachment IDs of SharePoint IDs.");
  }

  async sendReply(input: MailSendRequest): Promise<void> {
    await this.sendMail(input);
  }

  async sendReport(input: MailSendRequest): Promise<void> {
    await this.sendMail(input);
  }

  verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
    if (input.clientState !== this.options.expectedClientState) {
      return false;
    }

    if (this.options.requireTlsCertificate !== false) {
      const forwardedClientCert = getHeader(input.headers, "x-arr-clientcert");
      const tlsClientCertificate = input.tlsClientCertificate ?? forwardedClientCert;
      if (!tlsClientCertificate) {
        return false;
      }
    }

    return true;
  }

  private async sendMail(input: MailSendRequest): Promise<void> {
    const internetMessageHeaders = input.conversationId
      ? [
          {
            name: "x-ms-conversation-id",
            value: input.conversationId,
          },
        ]
      : undefined;

    await this.graphClient.api(`/users/${input.mailbox}/sendMail`).post({
      message: {
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.htmlBody,
        },
        toRecipients: input.to.map((address) => ({
          emailAddress: { address },
        })),
        internetMessageHeaders,
      },
      saveToSentItems: true,
    });
  }
}
