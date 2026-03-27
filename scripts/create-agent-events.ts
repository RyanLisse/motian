import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

import { sql } from "drizzle-orm";
import { db } from "../src/db/index.js";

async function main() {
  // Create screening_calls first (referenced by agent_events)
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS screening_calls (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      application_id TEXT REFERENCES applications(id) ON DELETE SET NULL,
      candidate_id TEXT REFERENCES candidates(id) ON DELETE SET NULL,
      job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      room_name TEXT,
      scheduled_at TIMESTAMP,
      started_at TIMESTAMP,
      ended_at TIMESTAMP,
      duration_seconds INTEGER,
      transcript JSONB DEFAULT '[]',
      summary TEXT,
      recommendation TEXT,
      score INTEGER,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);
  console.log("screening_calls table created");

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS agent_events (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      source_agent TEXT NOT NULL,
      event_type TEXT NOT NULL,
      candidate_id TEXT REFERENCES candidates(id) ON DELETE SET NULL,
      job_id TEXT REFERENCES jobs(id) ON DELETE SET NULL,
      match_id TEXT REFERENCES job_matches(id) ON DELETE SET NULL,
      screening_call_id TEXT REFERENCES screening_calls(id) ON DELETE SET NULL,
      payload JSONB DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      processed_by TEXT,
      processed_at TIMESTAMP,
      error_message TEXT,
      trigger_run_id TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_events_source_agent ON agent_events(source_agent)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_events_event_type ON agent_events(event_type)`,
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_events_status ON agent_events(status)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_events_candidate_id ON agent_events(candidate_id)`,
  );
  await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_agent_events_job_id ON agent_events(job_id)`);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_events_created_at ON agent_events(created_at)`,
  );
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS idx_agent_events_pending_type ON agent_events(status, event_type)`,
  );

  console.log("agent_events table + 7 indexes created successfully");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
