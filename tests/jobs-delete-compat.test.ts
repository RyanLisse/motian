import { beforeEach, describe, expect, it, vi } from "vitest";

const { jobs, mockReturning, mockSet, mockUpdate, mockWhere } = vi.hoisted(() => {
  const mockReturning = vi.fn().mockResolvedValue([{ id: "job-123" }]);
  const mockWhere = vi.fn(() => ({ returning: mockReturning }));
  const mockSet = vi.fn(() => ({ where: mockWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockSet }));
  const baseJobs = {
    id: "jobs.id",
    status: "jobs.status",
    deletedAt: "jobs.deletedAt",
  };

  const jobs = new Proxy(baseJobs, {
    get(target, prop, receiver) {
      if (prop === "archivedAt") {
        throw new Error("deleteJob should not access jobs.archivedAt on legacy schemas");
      }
      return Reflect.get(target, prop, receiver);
    },
  });

  return { jobs, mockReturning, mockSet, mockUpdate, mockWhere };
});

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: {
    update: mockUpdate,
  },
}));

vi.mock("../src/db/schema", () => ({ jobs }));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  eq: (column: unknown, value: unknown) => ({ type: "eq", column, value }),
  getTableColumns: (table: Record<string, unknown>) => table,
  isNotNull: (column: unknown) => ({ type: "isNotNull", column }),
  ne: (column: unknown, value: unknown) => ({ type: "ne", column, value }),
  or: (...args: unknown[]) => ({ type: "or", args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values }),
}));

import { deleteJob } from "../src/services/jobs/repository";

function containsNode(node: unknown, predicate: (value: unknown) => boolean): boolean {
  if (predicate(node)) return true;
  if (Array.isArray(node)) return node.some((item) => containsNode(item, predicate));
  if (node && typeof node === "object") {
    return Object.values(node).some((value) => containsNode(value, predicate));
  }
  return false;
}

describe("deleteJob compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{ id: "job-123" }]);
  });

  it("archives through status/deletedAt only without referencing jobs.archivedAt", async () => {
    await expect(deleteJob("job-123")).resolves.toBe(true);

    expect(mockSet).toHaveBeenCalledWith({
      deletedAt: null,
      status: "archived",
    });

    const whereClause = mockWhere.mock.calls[0]?.[0];
    expect(
      containsNode(
        whereClause,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "column" in value &&
          (value as { column: string }).column === "jobs.archivedAt",
      ),
    ).toBe(false);
    expect(
      containsNode(
        whereClause,
        (value) =>
          typeof value === "object" &&
          value !== null &&
          "type" in value &&
          (value as { type: string }).type === "isNotNull" &&
          (value as { column: string }).column === "jobs.deletedAt",
      ),
    ).toBe(true);
    expect(mockReturning).toHaveBeenCalledWith({ id: "jobs.id" });
  });
});
