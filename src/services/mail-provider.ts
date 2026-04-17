export interface InboxSubscriptionRequest {
  mailbox: string;
  notificationUrl: string;
  lifecycleNotificationUrl: string;
  clientState: string;
}

export interface InboxSubscription {
  id: string;
  expirationDateTime: string;
  resource: string;
}

export interface AttachmentRequest {
  mailbox: string;
  messageId?: string;
  attachmentId?: string;
  sharePointSiteId?: string;
  driveId?: string;
  itemId?: string;
}

export interface MailSendRequest {
  mailbox: string;
  to: string[];
  subject: string;
  htmlBody: string;
  conversationId?: string;
}

export interface VerifyWebhookSignatureInput {
  headers: Headers | Record<string, string | undefined>;
  clientState?: string;
  tlsClientCertificate?: string;
}

export interface MailProvider {
  subscribeInbox(input: InboxSubscriptionRequest): Promise<InboxSubscription>;
  fetchAttachment(input: AttachmentRequest): Promise<Buffer>;
  sendReply(input: MailSendRequest): Promise<void>;
  sendReport(input: MailSendRequest): Promise<void>;
  verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean;
}
