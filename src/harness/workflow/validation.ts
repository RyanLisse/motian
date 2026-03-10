import { z } from "zod";
import type { HarnessPlanDefinition } from "../contracts";
import { harnessPlanDefinitionSchema } from "../contracts";
import { buildHarnessWorkflowGraph, type HarnessWorkflowGraph } from "./graph";

export interface HarnessWorkflowValidationIssue {
  code: string;
  message: string;
  path: string;
  severity: "error" | "warning";
}

export interface HarnessWorkflowValidationResult {
  ok: boolean;
  plan?: HarnessPlanDefinition;
  graph?: HarnessWorkflowGraph;
  issues: HarnessWorkflowValidationIssue[];
}

export interface HarnessPlanDocumentValidationResult {
  ok: boolean;
  issues: HarnessWorkflowValidationIssue[];
}

function pushIssue(
  issues: HarnessWorkflowValidationIssue[],
  issue: HarnessWorkflowValidationIssue,
): void {
  issues.push(issue);
}

function formatIssuePath(path: Array<string | number>): string {
  return path.length > 0 ? path.join(".") : "document";
}

function translateSchemaIssue(issue: z.ZodIssue): string {
  const issuePath = formatIssuePath(issue.path);

  switch (issue.code) {
    case z.ZodIssueCode.unrecognized_keys:
      return `Onbekende velden op '${issuePath}': ${issue.keys.join(", ")}.`;
    case z.ZodIssueCode.invalid_type:
      return `Ongeldig type op '${issuePath}': verwacht ${issue.expected}, ontvangen ${issue.received}.`;
    case z.ZodIssueCode.invalid_literal:
      return `Ongeldige letterlijke waarde op '${issuePath}': verwacht '${String(issue.expected)}'.`;
    case z.ZodIssueCode.invalid_enum_value:
      return `Ongeldige waarde op '${issuePath}': verwacht één van ${issue.options.join(", ")}.`;
    case z.ZodIssueCode.too_small:
      return `Waarde op '${issuePath}' is te klein of te kort.`;
    case z.ZodIssueCode.too_big:
      return `Waarde op '${issuePath}' is te groot of te lang.`;
    case z.ZodIssueCode.custom:
      return issue.message;
    default:
      return `Ongeldige planconfiguratie op '${issuePath}'.`;
  }
}

function hasManualOnlyCompletion(planTask: HarnessPlanDefinition["tasks"][number]): boolean {
  return planTask.evaluation.completion.requirements.some(
    (requirement) => requirement.kind === "manual_signal",
  );
}

export function validateHarnessPlanDefinition(input: unknown): HarnessWorkflowValidationResult {
  const parsed = harnessPlanDefinitionSchema.safeParse(input);
  const issues: HarnessWorkflowValidationIssue[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      pushIssue(issues, {
        code: `schema_${issue.code}`,
        message: translateSchemaIssue(issue),
        path: formatIssuePath(issue.path),
        severity: "error",
      });
    }
    return { ok: false, issues };
  }

  const plan = parsed.data;
  const taskIds = new Set<string>();
  const dispatchIds = new Set<string>();

  for (const task of plan.tasks) {
    if (taskIds.has(task.id)) {
      pushIssue(issues, {
        code: "duplicate_task_id",
        message: `Taak-id '${task.id}' komt meer dan één keer voor.`,
        path: `tasks.${task.id}`,
        severity: "error",
      });
    }
    taskIds.add(task.id);

    if (task.dispatches.length === 0 && !hasManualOnlyCompletion(task)) {
      pushIssue(issues, {
        code: "task_has_no_dispatch_or_signal",
        message: `Taak '${task.id}' moet een dispatch of een expliciet handmatig voltooiingssignaal definiëren.`,
        path: `tasks.${task.id}.dispatches`,
        severity: "error",
      });
    }

    if (new Set(task.dependsOn).size !== task.dependsOn.length) {
      pushIssue(issues, {
        code: "duplicate_task_dependency",
        message: `Taak '${task.id}' bevat dubbele taakafhankelijkheden.`,
        path: `tasks.${task.id}.dependsOn`,
        severity: "error",
      });
    }

    if (new Set(task.acceptanceCriteria).size !== task.acceptanceCriteria.length) {
      pushIssue(issues, {
        code: "duplicate_acceptance_criteria",
        message: `Taak '${task.id}' bevat dubbele acceptatiecriteria.`,
        path: `tasks.${task.id}.acceptanceCriteria`,
        severity: "warning",
      });
    }

    for (const dispatch of task.dispatches) {
      if (dispatchIds.has(dispatch.id)) {
        pushIssue(issues, {
          code: "duplicate_dispatch_id",
          message: `Dispatch-id '${dispatch.id}' komt meer dan één keer voor in het plan.`,
          path: `tasks.${task.id}.dispatches.${dispatch.id}`,
          severity: "error",
        });
      }
      dispatchIds.add(dispatch.id);

      if (new Set(dispatch.dependsOnDispatches).size !== dispatch.dependsOnDispatches.length) {
        pushIssue(issues, {
          code: "duplicate_dispatch_dependency",
          message: `Dispatch '${dispatch.id}' bevat dubbele dispatch-afhankelijkheden.`,
          path: `tasks.${task.id}.dispatches.${dispatch.id}.dependsOnDispatches`,
          severity: "error",
        });
      }
    }
  }

  for (const task of plan.tasks) {
    if (task.dependsOn.includes(task.id)) {
      pushIssue(issues, {
        code: "self_task_dependency",
        message: `Taak '${task.id}' mag niet van zichzelf afhangen.`,
        path: `tasks.${task.id}.dependsOn`,
        severity: "error",
      });
    }

    for (const dependency of task.dependsOn) {
      if (!taskIds.has(dependency)) {
        pushIssue(issues, {
          code: "unknown_task_dependency",
          message: `Taak '${task.id}' hangt af van onbekende taak '${dependency}'.`,
          path: `tasks.${task.id}.dependsOn`,
          severity: "error",
        });
      }
    }

    for (const dispatch of task.dispatches) {
      if (dispatch.dependsOnDispatches.includes(dispatch.id)) {
        pushIssue(issues, {
          code: "self_dispatch_dependency",
          message: `Dispatch '${dispatch.id}' mag niet van zichzelf afhangen.`,
          path: `tasks.${task.id}.dispatches.${dispatch.id}.dependsOnDispatches`,
          severity: "error",
        });
      }

      for (const dependency of dispatch.dependsOnDispatches) {
        if (!dispatchIds.has(dependency)) {
          pushIssue(issues, {
            code: "unknown_dispatch_dependency",
            message: `Dispatch '${dispatch.id}' hangt af van onbekende dispatch '${dependency}'.`,
            path: `tasks.${task.id}.dispatches.${dispatch.id}.dependsOnDispatches`,
            severity: "error",
          });
        }
      }
    }

    for (const requirement of task.evaluation.completion.requirements) {
      if (
        "dispatchId" in requirement &&
        requirement.dispatchId &&
        !dispatchIds.has(requirement.dispatchId)
      ) {
        pushIssue(issues, {
          code: "unknown_completion_dispatch_reference",
          message: `Taak '${task.id}' verwijst in een voltooiingsvoorwaarde naar onbekende dispatch '${requirement.dispatchId}'.`,
          path: `tasks.${task.id}.evaluation.completion.requirements`,
          severity: "error",
        });
      }
    }
  }

  if (plan.tasks.every((task) => task.dependsOn.length > 0)) {
    pushIssue(issues, {
      code: "missing_root_task",
      message: "Een plan moet minstens één hoofdtaak zonder afhankelijkheden bevatten.",
      path: "tasks",
      severity: "error",
    });
  }

  const graph = buildHarnessWorkflowGraph(plan);
  for (const cycle of graph.cycles) {
    pushIssue(issues, {
      code: `${cycle.kind}_cycle`,
      message: `Cyclische ${cycle.kind === "task" ? "taak" : "dispatch"}-afhankelijkheid gedetecteerd: ${cycle.nodes.join(" -> ")}`,
      path: cycle.kind === "task" ? "tasks" : "tasks.dispatches",
      severity: "error",
    });
  }

  return { ok: !issues.some((issue) => issue.severity === "error"), plan, graph, issues };
}

function readSectionBody(markdown: string, heading: string): string {
  const normalizedMarkdown = markdown.replace(/\r\n/g, "\n");
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = normalizedMarkdown.match(
    new RegExp(`^## ${escaped}\\n([\\s\\S]*?)(?=^## |$)`, "m"),
  );
  return match?.[1]?.trim() ?? "";
}

export function validateHarnessPlanDocument(markdown: string): HarnessPlanDocumentValidationResult {
  const issues: HarnessWorkflowValidationIssue[] = [];

  if (!/^#\s+\S+/m.test(markdown)) {
    pushIssue(issues, {
      code: "missing_title",
      message: "Planningsdocument moet een titel op het hoogste niveau bevatten.",
      path: "document",
      severity: "error",
    });
  }

  for (const section of ["Proposed Changes", "Verification Plan"] as const) {
    const body = readSectionBody(markdown, section);
    if (!body) {
      pushIssue(issues, {
        code: "empty_required_section",
        message: `Sectie '${section}' moet inhoud bevatten en niet alleen een kop.`,
        path: section,
        severity: "error",
      });
      continue;
    }

    if (section === "Proposed Changes" && !/^(-|\*|\d+\.)\s+/m.test(body)) {
      pushIssue(issues, {
        code: "missing_change_items",
        message: "'Proposed Changes' moet concrete acties of taken opsommen.",
        path: section,
        severity: "error",
      });
    }

    if (
      section === "Verification Plan" &&
      !/^(-|\*|\d+\.)\s+/m.test(body) &&
      !/`[^`]+`/.test(body)
    ) {
      pushIssue(issues, {
        code: "missing_verification_steps",
        message:
          "'Verification Plan' moet expliciete opdrachten, controles of checklist-items bevatten.",
        path: section,
        severity: "error",
      });
    }
  }

  return { ok: !issues.some((issue) => issue.severity === "error"), issues };
}

export function assertValidHarnessPlanDefinition(input: unknown): HarnessPlanDefinition {
  const result = validateHarnessPlanDefinition(input);
  if (!result.ok || !result.plan) {
    throw new z.ZodError(
      result.issues.map((issue) => ({
        code: "custom",
        message: issue.message,
        path: [issue.path],
      })),
    );
  }

  return result.plan;
}
