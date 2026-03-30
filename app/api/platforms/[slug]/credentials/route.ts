import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { encrypt } from "@/src/lib/crypto";

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

  // Encrypt credentials
  let encrypted: string;
  try {
    encrypted = encrypt(JSON.stringify(parsed.data));
  } catch {
    return NextResponse.json(
      { error: "Versleuteling mislukt — controleer ENCRYPTION_SECRET" },
      { status: 500 },
    );
  }

  // Update the scraper config
  const [updated] = await db
    .update(scraperConfigs)
    .set({
      authConfigEncrypted: encrypted,
      updatedAt: new Date(),
    })
    .where(eq(scraperConfigs.platform, slug))
    .returning({ id: scraperConfigs.id });

  if (!updated) {
    return NextResponse.json(
      { error: `Geen configuratie gevonden voor platform "${slug}"` },
      { status: 404 },
    );
  }

  return NextResponse.json({ credentialId: updated.id, platform: slug });
}
