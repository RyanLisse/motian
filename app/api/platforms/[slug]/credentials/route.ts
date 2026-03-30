import { tasks } from "@trigger.dev/sdk";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createConfig } from "@/src/services/scrapers";
import type { platformOnboardTask } from "@/trigger/platform-onboard";

const slugSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-z0-9-]+$/);
const credentialsSchema = z
  .record(z.string().min(1).max(1000))
  .refine((obj) => JSON.stringify(obj).length <= 4096, { message: "Payload te groot (max 4KB)" });

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: rawSlug } = await params;

  // Validate slug format
  const slugResult = slugSchema.safeParse(rawSlug);
  if (!slugResult.success) {
    return NextResponse.json({ error: "Ongeldig platform slug" }, { status: 400 });
  }
  const slug = slugResult.data;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ongeldige JSON" }, { status: 400 });
  }

  const parsed = credentialsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ongeldige inloggegevens" }, { status: 400 });
  }

  const config = await createConfig({
    platform: slug,
    authConfig: parsed.data,
    source: "ui",
  });

  const handle = await tasks.trigger<typeof platformOnboardTask>("platform-onboard", {
    platform: slug,
    source: "ui",
  });

  return NextResponse.json(
    {
      credentialId: config.id,
      platform: slug,
      resumed: true,
      runId: handle.id,
    },
    { status: 202 },
  );
}
