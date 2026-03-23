#!/usr/bin/env tsx
/**
 * Database Connection Health Check
 *
 * Verifies that Neon (DATABASE_URL) is correctly configured, with optional Turso fallback.
 * Checks:
 * - Primary environment variable is set (DATABASE_URL), or fallback Turso variables
 * - Primary connection string has valid format (when DATABASE_URL is set)
 * - Database connection can be established
 * - Basic query execution works
 *
 * Usage: tsx scripts/verify-db-connection.ts
 */

import { db, sql } from "../src/db";

async function verifyDatabaseConnection() {
  console.log("🔍 Verifying database connection...\n");

  // Check 1: Primary/fallback env is set
  const databaseUrl = process.env.DATABASE_URL;
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (!databaseUrl && !tursoUrl) {
    console.error("❌ DATABASE_URL and TURSO_DATABASE_URL are both missing");
    console.error(
      "   Set DATABASE_URL (Neon primary) and optionally TURSO_DATABASE_URL (fallback)",
    );
    process.exit(1);
  }
  console.log(
    `✓ Primary/fallback env present (${databaseUrl ? "Neon primary" : "Turso fallback"})`,
  );

  // Check 2: Primary connection string format (only when DATABASE_URL is set)
  if (databaseUrl) {
    try {
      const parsed = new URL(databaseUrl);
      const sslMode = parsed.searchParams.get("sslmode");

      console.log(`✓ Primary connection string format is valid`);
      console.log(`  Protocol: ${parsed.protocol}`);
      console.log(`  Host: ${parsed.hostname}`);
      console.log(`  Database: ${parsed.pathname.slice(1)}`);
      console.log(`  SSL Mode: ${sslMode || "(not specified)"}`);

      // Check 3: SSL configuration
      if (sslMode && sslMode !== "verify-full" && sslMode !== "disable" && sslMode !== "require") {
        console.warn(`⚠️  Unexpected sslmode "${sslMode}" in DATABASE_URL`);
      }
      if (!sslMode) {
        console.log(`  ℹ️  SSL mode not specified in DATABASE_URL`);
      }
    } catch (error) {
      console.error("❌ Invalid DATABASE_URL connection string format");
      console.error(`   ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }

  // Check 4: Database connection
  try {
    const startTime = Date.now();
    const result = await db.execute(sql`SELECT 1 as health_check`);
    const duration = Date.now() - startTime;

    if (result.rows && result.rows.length > 0) {
      console.log(`✓ Database connection successful (${duration}ms)`);
    } else {
      throw new Error("Query returned no rows");
    }
  } catch (error) {
    console.error("❌ Database connection failed");
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof Error && error.message.includes("ENOTFOUND")) {
      console.error("\n   Possible causes:");
      console.error("   - Database host is unreachable");
      console.error("   - DNS resolution failed");
      console.error("   - Firewall blocking connection");
    } else if (error instanceof Error && error.message.includes("authentication")) {
      console.error("\n   Possible causes:");
      console.error("   - Invalid database credentials");
      console.error("   - User does not have access to the database");
    } else if (error instanceof Error && error.message.includes("SSL")) {
      console.error("\n   Possible causes:");
      console.error("   - SSL certificate validation failed");
      console.error("   - SSL mode mismatch");
    }

    process.exit(1);
  }

  // Check 5: Query execution
  try {
    const result = await db.execute(sql`SELECT 1 as ok, CURRENT_TIMESTAMP as ts`);

    if (result.rows && result.rows.length > 0) {
      console.log(`✓ Query execution successful`);
    }
  } catch (error) {
    console.error("❌ Query execution failed");
    console.error(`   ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log("\n✅ All database connection checks passed!");
  process.exit(0);
}

verifyDatabaseConnection().catch((error) => {
  console.error("💥 Unexpected error:", error);
  process.exit(1);
});
