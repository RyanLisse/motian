import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/src/db";
import { scraperConfigs } from "@/src/db/schema";
import { encrypt } from "@/src/lib/crypto";

const credentialsSchema = z.record(z.string().min(1));

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

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
  const encrypted = encrypt(JSON.stringify(parsed.data));

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
