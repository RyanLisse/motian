import { task } from "@trigger.dev/sdk";

/**
 * Long-running Trigger.dev task that maintains the WhatsApp Baileys connection.
 * Starts the gateway, registers the CV handler, and keeps the process alive.
 * Uses AbortController for graceful shutdown.
 */
export const whatsappGatewayTask = task({
  id: "whatsapp-gateway",
  retry: { maxAttempts: 3 },
  run: async () => {
    // Dynamic import to avoid loading Baileys in non-WhatsApp contexts
    const { getWhatsAppGateway } = await import("@/src/services/whatsapp");
    const { handleWhatsAppCV, handleWhatsAppText } = await import(
      "@/src/services/whatsapp-cv-pipeline"
    );

    const enabled = process.env.WHATSAPP_ENABLED === "true";
    if (!enabled) {
      console.log("[WhatsApp Gateway] Disabled (WHATSAPP_ENABLED !== true)");
      return { status: "disabled" };
    }

    const gateway = getWhatsAppGateway();

    // Register handlers
    gateway.onDocument(handleWhatsAppCV);
    gateway.onText(handleWhatsAppText);

    // Connect to WhatsApp
    await gateway.connect();

    console.log("[WhatsApp Gateway] Running. Waiting for incoming CV documents...");

    // Graceful shutdown via AbortController
    await gateway.waitUntilAborted();

    console.log("[WhatsApp Gateway] Shutting down...");
    await gateway.disconnect();

    return { status: "stopped" };
  },
});
