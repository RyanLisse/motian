import { describe, expect, it, vi } from "vitest";

import { Microsoft365Provider } from "../src/services/Microsoft365Provider";

function createGraphClientMock() {
  const routes = new Map<string, { get?: any; post?: any }>();

  return {
    routes,
    client: {
      api(path: string) {
        return {
          get: vi.fn(async () => routes.get(path)?.get),
          post: vi.fn(async (body: unknown) => {
            const route = routes.get(path);
            if (typeof route?.post === "function") {
              return route.post(body);
            }
            return route?.post;
          }),
        };
      },
    },
  };
}

describe("Microsoft365Provider", () => {
  it("maakt inbox-subscription met lifecycleNotificationUrl", async () => {
    const graph = createGraphClientMock();
    graph.routes.set("/subscriptions", {
      post: {
        id: "sub-123",
        expirationDateTime: "2026-04-20T00:00:00.000Z",
        resource: "/users/inbox@example.com/messages",
      },
    });

    const provider = new Microsoft365Provider({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      expectedClientState: "state-123",
      graphClient: graph.client,
      requireTlsCertificate: false,
    });

    const subscription = await provider.subscribeInbox({
      mailbox: "inbox@example.com",
      notificationUrl: "https://example.com/webhook",
      lifecycleNotificationUrl: "https://example.com/lifecycle",
      clientState: "state-123",
    });

    expect(subscription.id).toBe("sub-123");
    expect(subscription.resource).toBe("/users/inbox@example.com/messages");
  });

  it("haalt Outlook inline attachment op", async () => {
    const graph = createGraphClientMock();
    graph.routes.set("/users/mailbox/messages/msg-1/attachments/att-1", {
      get: {
        contentBytes: Buffer.from("hallo").toString("base64"),
      },
    });

    const provider = new Microsoft365Provider({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      expectedClientState: "state-123",
      graphClient: graph.client,
      requireTlsCertificate: false,
    });

    const file = await provider.fetchAttachment({
      mailbox: "mailbox",
      messageId: "msg-1",
      attachmentId: "att-1",
    });

    expect(file.toString()).toBe("hallo");
  });

  it("haalt SharePoint content op via drives endpoint", async () => {
    const graph = createGraphClientMock();
    graph.routes.set("/sites/site-1/drives/drive-1/items/item-1/content", {
      get: "sharepoint-bestand",
    });

    const provider = new Microsoft365Provider({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      expectedClientState: "state-123",
      graphClient: graph.client,
      requireTlsCertificate: false,
    });

    const file = await provider.fetchAttachment({
      mailbox: "mailbox",
      sharePointSiteId: "site-1",
      driveId: "drive-1",
      itemId: "item-1",
    });

    expect(file.toString()).toBe("sharepoint-bestand");
  });

  it("stuurt reply met conversationId header", async () => {
    const graph = createGraphClientMock();
    const posts: unknown[] = [];
    graph.routes.set("/users/inbox@example.com/sendMail", {
      post: (body: unknown) => {
        posts.push(body);
        return {};
      },
    });

    const provider = new Microsoft365Provider({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      expectedClientState: "state-123",
      graphClient: graph.client,
      requireTlsCertificate: false,
    });

    await provider.sendReply({
      mailbox: "inbox@example.com",
      to: ["to@example.com"],
      subject: "Onderwerp",
      htmlBody: "<p>Hoi</p>",
      conversationId: "conv-1",
    });

    expect(posts).toHaveLength(1);
    const payload = posts[0] as {
      message: { internetMessageHeaders?: Array<{ name: string; value: string }> };
    };
    expect(payload.message.internetMessageHeaders?.[0]).toEqual({
      name: "x-ms-conversation-id",
      value: "conv-1",
    });
  });

  it("verifieert clientState + TLS certificaat", () => {
    const provider = new Microsoft365Provider({
      tenantId: "tenant",
      clientId: "client",
      clientSecret: "secret",
      expectedClientState: "state-123",
      graphClient: createGraphClientMock().client,
    });

    const ok = provider.verifyWebhookSignature({
      headers: { "x-arr-clientcert": "cert" },
      clientState: "state-123",
    });
    const badState = provider.verifyWebhookSignature({
      headers: { "x-arr-clientcert": "cert" },
      clientState: "wrong",
    });

    expect(ok).toBe(true);
    expect(badState).toBe(false);
  });
});
