import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest) {
  const enabled = process.env.WHATSAPP_ENABLED === "true";

  if (!enabled) {
    return NextResponse.json({
      enabled: false,
      status: "disabled",
      message: "WhatsApp integratie is uitgeschakeld",
    });
  }

  try {
    const { getWhatsAppGateway } = await import("@/src/services/whatsapp");
    const gateway = getWhatsAppGateway();
    const status = gateway.getStatus();

    return NextResponse.json({
      enabled: true,
      status,
      message:
        status === "connected"
          ? "WhatsApp verbonden"
          : status === "connecting"
            ? "Bezig met verbinden..."
            : "Niet verbonden",
    });
  } catch (_err) {
    return NextResponse.json(
      {
        enabled: true,
        status: "error",
        message: "Kon WhatsApp status niet ophalen",
      },
      { status: 500 },
    );
  }
}
