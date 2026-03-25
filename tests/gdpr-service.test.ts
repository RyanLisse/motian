import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockTx } = vi.hoisted(() => {
  const mockTx = {
    select: vi.fn(),
    delete: vi.fn(),
    insert: vi.fn(),
  };
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: test mock
    transaction: vi.fn((fn: any) => fn(mockTx)),
  };
  return { mockDb, mockTx };
});

vi.mock("../src/db", () => ({
  and: vi.fn((...args: unknown[]) => args),
  db: mockDb,
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  inArray: vi.fn((a: unknown, b: unknown) => ({ inArray: [a, b] })),
  isNotNull: vi.fn((a: unknown) => ({ isNotNull: a })),
  isNull: vi.fn((a: unknown) => ({ isNull: a })),
  or: vi.fn((...args: unknown[]) => args),
  sql: vi.fn(),
}));

vi.mock("../src/db/schema", () => ({
  applications: {
    id: "applications.id",
    candidateId: "applications.candidateId",
    jobId: "applications.jobId",
  },
  candidates: {
    id: "candidates.id",
    deletedAt: "candidates.deletedAt",
    name: "candidates.name",
    dataRetentionUntil: "candidates.dataRetentionUntil",
  },
  gdprAuditLog: {
    subjectId: "gdprAuditLog.subjectId",
    createdAt: "gdprAuditLog.createdAt",
  },
  interviews: {
    id: "interviews.id",
    applicationId: "interviews.applicationId",
    deletedAt: "interviews.deletedAt",
  },
  jobMatches: {
    id: "jobMatches.id",
    candidateId: "jobMatches.candidateId",
  },
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    agentContact: "jobs.agentContact",
    recruiterContact: "jobs.recruiterContact",
  },
  messages: {
    id: "messages.id",
    applicationId: "messages.applicationId",
    deletedAt: "messages.deletedAt",
  },
}));

vi.mock("../src/lib/helpers", () => ({
  escapeLike: vi.fn((s: string) => s),
}));

// ---------- helpers ----------

function makeSelectChain(resolvedValue: unknown[] = []) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(resolvedValue),
    orderBy: vi.fn().mockResolvedValue(resolvedValue),
  };
  return chain;
}

function makeInsertChain() {
  return { values: vi.fn().mockResolvedValue(undefined) };
}

function makeUpdateChain() {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    }),
  };
}

// ---------- tests ----------

describe("GDPR Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========== exportCandidateData ==========

  describe("exportCandidateData", () => {
    it("returns null when candidate not found", async () => {
      const { exportCandidateData } = await import("../src/services/gdpr");

      const chain = makeSelectChain([]);
      mockDb.select.mockReturnValue(chain);

      const result = await exportCandidateData("nonexistent-id", "admin");
      expect(result).toBeNull();
    });

    it("returns full export with all related data", async () => {
      const { exportCandidateData } = await import("../src/services/gdpr");

      const candidate = { id: "cand-1", name: "Jan de Vries", deletedAt: null };
      const app = { id: "app-1", candidateId: "cand-1", jobId: "job-1" };
      const match = { id: "match-1", candidateId: "cand-1" };
      const interview = { id: "int-1", applicationId: "app-1" };
      const message = { id: "msg-1", applicationId: "app-1" };
      const contact = {
        jobId: "job-1",
        jobTitle: "Developer",
        agentContact: { email: "agent@test.nl" },
        recruiterContact: null,
      };

      // Call 1: candidate lookup (with .limit)
      const candidateChain = makeSelectChain([candidate]);
      // Calls 2-3: applications + matches (parallel, with .where terminal)
      const appChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([app]),
      };
      const matchChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([match]),
      };
      // Calls 4-6: interviews, messages, contacts (parallel, with .where terminal)
      const interviewChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([interview]),
      };
      const messageChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([message]),
      };
      const contactChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([contact]),
      };

      mockDb.select
        .mockReturnValueOnce(candidateChain) // candidate
        .mockReturnValueOnce(appChain) // applications
        .mockReturnValueOnce(matchChain) // matches
        .mockReturnValueOnce(interviewChain) // interviews
        .mockReturnValueOnce(messageChain) // messages
        .mockReturnValueOnce(contactChain); // contacts

      // Audit insert
      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await exportCandidateData("cand-1", "admin");

      expect(result).not.toBeNull();
      expect(result.candidate).toEqual(candidate);
      expect(result.applications).toEqual([app]);
      expect(result.interviews).toEqual([interview]);
      expect(result.messages).toEqual([message]);
      expect(result.matches).toEqual([match]);
      expect(result.relatedContacts).toEqual([contact]);
    });

    it("handles candidate with no applications (empty arrays)", async () => {
      const { exportCandidateData } = await import("../src/services/gdpr");

      const candidate = { id: "cand-2", name: "Piet Jansen", deletedAt: null };

      // candidate lookup
      const candidateChain = makeSelectChain([candidate]);
      // applications (empty) + matches (empty)
      const appChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      const matchChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select
        .mockReturnValueOnce(candidateChain)
        .mockReturnValueOnce(appChain)
        .mockReturnValueOnce(matchChain);

      // Audit insert
      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await exportCandidateData("cand-2", "admin");

      expect(result).not.toBeNull();
      expect(result.applications).toEqual([]);
      // When applicationIds is empty, interviews/messages/contacts resolve to []
      expect(result.interviews).toEqual([]);
      expect(result.messages).toEqual([]);
      expect(result.relatedContacts).toEqual([]);
    });

    it("logs audit trail entry", async () => {
      const { exportCandidateData } = await import("../src/services/gdpr");

      const candidate = { id: "cand-3", name: "Kees Bakker", deletedAt: null };

      const candidateChain = makeSelectChain([candidate]);
      const appChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      const matchChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };

      mockDb.select
        .mockReturnValueOnce(candidateChain)
        .mockReturnValueOnce(appChain)
        .mockReturnValueOnce(matchChain);

      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await exportCandidateData("cand-3", "admin");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "export_candidate",
          subjectType: "candidate",
          subjectId: "cand-3",
          requestedBy: "admin",
        }),
      );
    });
  });

  // ========== eraseCandidateData ==========

  describe("eraseCandidateData", () => {
    it("deletes messages, interviews, applications, matches, candidate in correct order", async () => {
      const { eraseCandidateData } = await import("../src/services/gdpr");

      const callOrder: string[] = [];

      // tx.select — get application IDs
      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "app-1" }, { id: "app-2" }]),
        }),
      });

      // tx.delete — messages, interviews, applications, matches, candidate
      mockTx.delete
        .mockImplementationOnce(() => {
          callOrder.push("messages");
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "msg-1" }, { id: "msg-2" }]),
            }),
          };
        })
        .mockImplementationOnce(() => {
          callOrder.push("interviews");
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "int-1" }]),
            }),
          };
        })
        .mockImplementationOnce(() => {
          callOrder.push("applications");
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "app-1" }, { id: "app-2" }]),
            }),
          };
        })
        .mockImplementationOnce(() => {
          callOrder.push("matches");
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "match-1" }]),
            }),
          };
        })
        .mockImplementationOnce(() => {
          callOrder.push("candidate");
          return {
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: "cand-1" }]),
            }),
          };
        });

      // Audit insert (after transaction)
      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await eraseCandidateData("cand-1", "admin");

      expect(callOrder).toEqual(["messages", "interviews", "applications", "matches", "candidate"]);
      expect(result.deletedMessages).toBe(2);
      expect(result.deletedInterviews).toBe(1);
      expect(result.deletedApplications).toBe(2);
      expect(result.deletedMatches).toBe(1);
      expect(result.deletedCandidate).toBe(true);
    });

    it("returns correct deletion counts", async () => {
      const { eraseCandidateData } = await import("../src/services/gdpr");

      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ id: "app-1" }]),
        }),
      });

      mockTx.delete
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi
              .fn()
              .mockResolvedValue([{ id: "msg-1" }, { id: "msg-2" }, { id: "msg-3" }]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "app-1" }]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "m-1" }, { id: "m-2" }]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "cand-1" }]),
          }),
        });

      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await eraseCandidateData("cand-1", "admin");

      expect(result).toEqual({
        deletedMessages: 3,
        deletedInterviews: 0,
        deletedApplications: 1,
        deletedMatches: 2,
        deletedCandidate: true,
      });
    });

    it("handles candidate with no applications", async () => {
      const { eraseCandidateData } = await import("../src/services/gdpr");

      // No applications found
      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      // Only applications, matches, candidate deletes (no messages/interviews since no appIds)
      mockTx.delete
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "cand-1" }]),
          }),
        });

      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await eraseCandidateData("cand-1", "admin");

      expect(result.deletedMessages).toBe(0);
      expect(result.deletedInterviews).toBe(0);
      expect(result.deletedApplications).toBe(0);
      expect(result.deletedMatches).toBe(0);
      expect(result.deletedCandidate).toBe(true);
    });

    it("logs audit trail after transaction", async () => {
      const { eraseCandidateData } = await import("../src/services/gdpr");

      mockTx.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      mockTx.delete
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        })
        .mockReturnValueOnce({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "cand-1" }]),
          }),
        });

      const insertChain = makeInsertChain();
      mockDb.insert.mockReturnValue(insertChain);

      await eraseCandidateData("cand-1", "dpo");

      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "erase_candidate",
          subjectType: "candidate",
          subjectId: "cand-1",
          requestedBy: "dpo",
        }),
      );
    });
  });

  // ========== scrubContactData ==========

  describe("scrubContactData", () => {
    it("scrubs matching agent contact", async () => {
      const { scrubContactData } = await import("../src/services/gdpr");

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: "job-1",
            agentContact: { email: "agent@example.nl", name: "Agent" },
            recruiterContact: null,
          },
        ]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const updateChain = makeUpdateChain();
      mockDb.update.mockReturnValue(updateChain);

      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await scrubContactData("agent@example.nl", "admin");

      expect(result.scrubbed).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("scrubs matching recruiter contact", async () => {
      const { scrubContactData } = await import("../src/services/gdpr");

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([
          {
            id: "job-2",
            agentContact: null,
            recruiterContact: { email: "recruiter@example.nl", name: "Recruiter" },
          },
        ]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const updateChain = makeUpdateChain();
      mockDb.update.mockReturnValue(updateChain);

      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await scrubContactData("recruiter@example.nl", "admin");

      expect(result.scrubbed).toBe(1);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it("returns 0 when no matches found", async () => {
      const { scrubContactData } = await import("../src/services/gdpr");

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);

      mockDb.insert.mockReturnValue(makeInsertChain());

      const result = await scrubContactData("nobody@example.nl", "admin");

      expect(result.scrubbed).toBe(0);
      expect(mockDb.update).not.toHaveBeenCalled();
    });
  });

  // ========== findExpiredRetentionCandidates ==========

  describe("findExpiredRetentionCandidates", () => {
    it("returns candidates past retention date", async () => {
      const { findExpiredRetentionCandidates } = await import("../src/services/gdpr");

      const expired = [
        { id: "cand-1", name: "Jan", dataRetentionUntil: new Date("2025-01-01") },
        { id: "cand-2", name: "Piet", dataRetentionUntil: new Date("2024-06-15") },
      ];

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(expired),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await findExpiredRetentionCandidates();

      expect(result).toEqual(expired);
      expect(result).toHaveLength(2);
    });
  });

  // ========== getAuditLog ==========

  describe("getAuditLog", () => {
    it("returns ordered audit entries for subject", async () => {
      const { getAuditLog } = await import("../src/services/gdpr");

      const entries = [
        {
          id: "log-1",
          action: "export_candidate",
          subjectId: "cand-1",
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "log-2",
          action: "erase_candidate",
          subjectId: "cand-1",
          createdAt: new Date("2025-02-01"),
        },
      ];

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(entries),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await getAuditLog("cand-1");

      expect(result).toEqual(entries);
      expect(result).toHaveLength(2);
      expect(selectChain.orderBy).toHaveBeenCalled();
    });
  });
});
