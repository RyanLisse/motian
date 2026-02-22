/**
 * Eenmalig migratiescript: versleutel bestaande plaintext authConfigEncrypted waarden.
 *
 * Gebruik:
 *   ENCRYPTION_SECRET=... npx tsx scripts/encrypt-auth-configs.ts
 *   (of met dotenv via .env.local)
 */
import "dotenv/config";
import { db } from "../src/db";
import { scraperConfigs } from "../src/db/schema";
import { isNotNull } from "drizzle-orm";
import { encrypt, decrypt } from "../src/lib/crypto";

async function main() {
  console.log("=== Encrypt Auth Configs Migratie ===\n");

  if (!process.env.ENCRYPTION_SECRET) {
    console.error("FOUT: ENCRYPTION_SECRET env var is verplicht.");
    process.exit(1);
  }

  const configs = await db
    .select({
      id: scraperConfigs.id,
      platform: scraperConfigs.platform,
      authConfigEncrypted: scraperConfigs.authConfigEncrypted,
    })
    .from(scraperConfigs)
    .where(isNotNull(scraperConfigs.authConfigEncrypted));

  console.log(`${configs.length} configuratie(s) gevonden met authConfigEncrypted.\n`);

  let encrypted = 0;
  let skipped = 0;
  let errors = 0;

  for (const cfg of configs) {
    const value = cfg.authConfigEncrypted;
    if (!value) {
      skipped++;
      continue;
    }

    // Probeer eerst te decrypten — als dat lukt is het al versleuteld
    try {
      decrypt(value);
      console.log(`  [SKIP] ${cfg.platform} (${cfg.id}) — al versleuteld`);
      skipped++;
      continue;
    } catch {
      // Niet versleuteld — ga door met encryptie
    }

    // Controleer of het geldige JSON is (plaintext)
    try {
      JSON.parse(value);
    } catch {
      console.warn(`  [WARN] ${cfg.platform} (${cfg.id}) — geen geldige JSON, overslaan`);
      errors++;
      continue;
    }

    // Versleutel en update
    try {
      const encryptedValue = encrypt(value);

      const { eq } = await import("drizzle-orm");
      await db
        .update(scraperConfigs)
        .set({
          authConfigEncrypted: encryptedValue,
          updatedAt: new Date(),
        })
        .where(eq(scraperConfigs.id, cfg.id));

      console.log(`  [OK]   ${cfg.platform} (${cfg.id}) — versleuteld`);
      encrypted++;
    } catch (err) {
      console.error(`  [FOUT] ${cfg.platform} (${cfg.id}) —`, err);
      errors++;
    }
  }

  console.log(`\n=== Resultaat ===`);
  console.log(`  Versleuteld: ${encrypted}`);
  console.log(`  Overgeslagen: ${skipped}`);
  console.log(`  Fouten: ${errors}`);
  console.log(`  Totaal: ${configs.length}`);

  process.exit(errors > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("Onverwachte fout:", err);
  process.exit(1);
});
