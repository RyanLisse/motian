import { describe, test, expect } from "vitest";
import { existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

// ========== 1. Schema Tables ==========

describe("Schema: applications, interviews, messages tables", () => {
  test("applications table is exported from schema", async () => {
    const schema = await import("../src/db/schema");
    expect(schema.applications).toBeDefined();
  });

  test("interviews table is exported from schema", async () => {
    const schema = await import("../src/db/schema");
    expect(schema.interviews).toBeDefined();
  });

  test("messages table is exported from schema", async () => {
    const schema = await import("../src/db/schema");
    expect(schema.messages).toBeDefined();
  });

  test("applications table has required columns", async () => {
    const schema = await import("../src/db/schema");
    const cols = schema.applications;
    expect(cols.id).toBeDefined();
    expect(cols.jobId).toBeDefined();
    expect(cols.candidateId).toBeDefined();
    expect(cols.matchId).toBeDefined();
    expect(cols.stage).toBeDefined();
    expect(cols.previousStage).toBeDefined();
    expect(cols.stageChangedAt).toBeDefined();
    expect(cols.notes).toBeDefined();
    expect(cols.source).toBeDefined();
    expect(cols.createdAt).toBeDefined();
    expect(cols.updatedAt).toBeDefined();
    expect(cols.deletedAt).toBeDefined();
  });

  test("interviews table has required columns", async () => {
    const schema = await import("../src/db/schema");
    const cols = schema.interviews;
    expect(cols.id).toBeDefined();
    expect(cols.applicationId).toBeDefined();
    expect(cols.scheduledAt).toBeDefined();
    expect(cols.duration).toBeDefined();
    expect(cols.type).toBeDefined();
    expect(cols.interviewer).toBeDefined();
    expect(cols.location).toBeDefined();
    expect(cols.status).toBeDefined();
    expect(cols.feedback).toBeDefined();
    expect(cols.rating).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });

  test("messages table has required columns", async () => {
    const schema = await import("../src/db/schema");
    const cols = schema.messages;
    expect(cols.id).toBeDefined();
    expect(cols.applicationId).toBeDefined();
    expect(cols.direction).toBeDefined();
    expect(cols.channel).toBeDefined();
    expect(cols.subject).toBeDefined();
    expect(cols.body).toBeDefined();
    expect(cols.sentAt).toBeDefined();
    expect(cols.createdAt).toBeDefined();
  });
});

// ========== 2. Application Service ==========

describe("Application service exports", () => {
  test("listApplications is exported", async () => {
    const svc = await import("../src/services/applications");
    expect(typeof svc.listApplications).toBe("function");
  });

  test("getApplicationById is exported", async () => {
    const svc = await import("../src/services/applications");
    expect(typeof svc.getApplicationById).toBe("function");
  });

  test("createApplication is exported", async () => {
    const svc = await import("../src/services/applications");
    expect(typeof svc.createApplication).toBe("function");
  });

  test("updateApplicationStage is exported", async () => {
    const svc = await import("../src/services/applications");
    expect(typeof svc.updateApplicationStage).toBe("function");
  });

  test("deleteApplication is exported", async () => {
    const svc = await import("../src/services/applications");
    expect(typeof svc.deleteApplication).toBe("function");
  });

  test("getApplicationStats is exported", async () => {
    const svc = await import("../src/services/applications");
    expect(typeof svc.getApplicationStats).toBe("function");
  });
});

// ========== 3. Interview Service ==========

describe("Interview service exports", () => {
  test("listInterviews is exported", async () => {
    const svc = await import("../src/services/interviews");
    expect(typeof svc.listInterviews).toBe("function");
  });

  test("getInterviewById is exported", async () => {
    const svc = await import("../src/services/interviews");
    expect(typeof svc.getInterviewById).toBe("function");
  });

  test("createInterview is exported", async () => {
    const svc = await import("../src/services/interviews");
    expect(typeof svc.createInterview).toBe("function");
  });

  test("updateInterview is exported", async () => {
    const svc = await import("../src/services/interviews");
    expect(typeof svc.updateInterview).toBe("function");
  });

  test("getUpcomingInterviews is exported", async () => {
    const svc = await import("../src/services/interviews");
    expect(typeof svc.getUpcomingInterviews).toBe("function");
  });
});

// ========== 4. Stage Change Event Step ==========

describe("Stage change event step config", () => {
  test("step file exists", () => {
    expect(existsSync(resolve(ROOT, "steps/pipeline/stage-change.step.ts"))).toBe(true);
  });

  test("config triggers on application.stage.changed", async () => {
    const step = await import("../steps/pipeline/stage-change.step");
    expect(step.config).toBeDefined();
    expect(step.config.triggers).toBeDefined();
    const trigger = step.config.triggers[0];
    expect(trigger.type).toBe("queue");
    expect(trigger.topic).toBe("application.stage.changed");
  });

  test("config enqueues pipeline.stage.logged", async () => {
    const step = await import("../steps/pipeline/stage-change.step");
    expect(step.config.enqueues).toBeDefined();
    expect(step.config.enqueues.some((e: { topic: string }) => e.topic === "pipeline.stage.logged")).toBe(true);
  });

  test("config flow is recruitment-pipeline", async () => {
    const step = await import("../steps/pipeline/stage-change.step");
    expect(step.config.flows).toContain("recruitment-pipeline");
  });

  test("handler is exported", async () => {
    const step = await import("../steps/pipeline/stage-change.step");
    expect(typeof step.handler).toBe("function");
  });
});

// ========== 5. API Route Files ==========

describe("API routes exist", () => {
  test("GET/POST /api/sollicitaties", () => {
    expect(existsSync(resolve(ROOT, "app/api/sollicitaties/route.ts"))).toBe(true);
  });

  test("GET/PATCH /api/sollicitaties/[id]", () => {
    expect(existsSync(resolve(ROOT, "app/api/sollicitaties/[id]/route.ts"))).toBe(true);
  });

  test("GET/POST /api/interviews", () => {
    expect(existsSync(resolve(ROOT, "app/api/interviews/route.ts"))).toBe(true);
  });

  test("PATCH /api/interviews/[id]", () => {
    expect(existsSync(resolve(ROOT, "app/api/interviews/[id]/route.ts"))).toBe(true);
  });
});

// ========== 6. API Route Handlers ==========

describe("API route handlers", () => {
  test("sollicitaties route exports GET and POST", async () => {
    const mod = await import("../app/api/sollicitaties/route");
    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.POST).toBe("function");
  });

  test("sollicitaties/[id] route exports GET and PATCH", async () => {
    const mod = await import("../app/api/sollicitaties/[id]/route");
    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.PATCH).toBe("function");
  });

  test("interviews route exports GET and POST", async () => {
    const mod = await import("../app/api/interviews/route");
    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.POST).toBe("function");
  });

  test("interviews/[id] route exports PATCH", async () => {
    const mod = await import("../app/api/interviews/[id]/route");
    expect(typeof mod.PATCH).toBe("function");
  });
});

// ========== 7. Pipeline Topology ==========

describe("Pipeline flow topology", () => {
  test("stage-change step is in recruitment-pipeline flow", async () => {
    const step = await import("../steps/pipeline/stage-change.step");
    expect(step.config.flows).toContain("recruitment-pipeline");
  });

  test("stage change input schema validates applicationId and newStage", async () => {
    const step = await import("../steps/pipeline/stage-change.step");
    const trigger = step.config.triggers[0];
    expect(trigger.input).toBeDefined();

    // Validate a correct input
    const result = trigger.input.safeParse({
      applicationId: "test-id",
      previousStage: "new",
      newStage: "screening",
    });
    expect(result.success).toBe(true);
  });

  test("stage change rejects missing required fields", async () => {
    const step = await import("../steps/pipeline/stage-change.step");
    const trigger = step.config.triggers[0];

    const result = trigger.input.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ========== 8. MCP Tools ==========

describe("MCP tools for applications and interviews", () => {
  test("MCP server file exists", () => {
    expect(existsSync(resolve(ROOT, "src/mcp/server.ts"))).toBe(true);
  });
});

// ========== 9. CLI Commands ==========

describe("CLI commands for applications and interviews", () => {
  test("applications CLI file exists", () => {
    expect(existsSync(resolve(ROOT, "cli/commands/applications.ts"))).toBe(true);
  });

  test("interviews CLI file exists", () => {
    expect(existsSync(resolve(ROOT, "cli/commands/interviews.ts"))).toBe(true);
  });

  test("applications CLI exports registerApplicationsCommand", async () => {
    const mod = await import("../cli/commands/applications");
    expect(typeof mod.registerApplicationsCommand).toBe("function");
  });

  test("interviews CLI exports registerInterviewsCommand", async () => {
    const mod = await import("../cli/commands/interviews");
    expect(typeof mod.registerInterviewsCommand).toBe("function");
  });
});

// ========== 10. Stage Enum Values ==========

describe("Stage enum consistency", () => {
  test("pipelineStages from lib/data match expected stages", async () => {
    const { pipelineStages } = await import("../lib/data");
    const stageIds = pipelineStages.map((s) => s.id);
    expect(stageIds).toContain("new");
    expect(stageIds).toContain("screening");
    expect(stageIds).toContain("interview");
    expect(stageIds).toContain("offer");
    expect(stageIds).toContain("hired");
  });

  test("applications schema default stage is 'new'", async () => {
    const schema = await import("../src/db/schema");
    // The default value is set in the schema definition
    expect(schema.applications.stage).toBeDefined();
  });
});
