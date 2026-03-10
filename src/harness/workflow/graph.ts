import type { HarnessPlanDefinition } from "../contracts";

export interface HarnessGraphCycle {
  kind: "task" | "dispatch";
  nodes: string[];
}

export interface HarnessTaskGraphNode {
  kind: "task";
  id: string;
  title: string;
  dependsOn: string[];
  downstreamTaskIds: string[];
  dispatchIds: string[];
  indegree: number;
}

export interface HarnessDispatchGraphNode {
  kind: "dispatch";
  id: string;
  taskId: string;
  dispatch: string;
  dependsOnDispatchIds: string[];
  downstreamDispatchIds: string[];
  indegree: number;
  required: boolean;
}

export interface HarnessWorkflowGraph {
  planId: string;
  taskNodes: Record<string, HarnessTaskGraphNode>;
  dispatchNodes: Record<string, HarnessDispatchGraphNode>;
  taskOrder: string[];
  dispatchOrder: string[];
  cycles: HarnessGraphCycle[];
}

function topologicalOrder(nodes: string[], edges: Array<readonly [string, string]>): string[] {
  const indegree = new Map(nodes.map((node) => [node, 0]));
  const downstream = new Map(nodes.map((node) => [node, [] as string[]]));

  for (const [from, to] of edges) {
    downstream.get(from)?.push(to);
    indegree.set(to, (indegree.get(to) ?? 0) + 1);
  }

  const queue = nodes.filter((node) => (indegree.get(node) ?? 0) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    order.push(current);
    for (const next of downstream.get(current) ?? []) {
      indegree.set(next, (indegree.get(next) ?? 1) - 1);
      if ((indegree.get(next) ?? 0) === 0) queue.push(next);
    }
  }

  return order.length === nodes.length ? order : [];
}

function detectCycles(
  kind: HarnessGraphCycle["kind"],
  nodeIds: string[],
  adjacency: Map<string, string[]>,
): HarnessGraphCycle[] {
  const visited = new Set<string>();
  const stack = new Set<string>();
  const path: string[] = [];
  const cycles = new Map<string, HarnessGraphCycle>();

  const visit = (nodeId: string): void => {
    visited.add(nodeId);
    stack.add(nodeId);
    path.push(nodeId);

    for (const next of adjacency.get(nodeId) ?? []) {
      if (!visited.has(next)) {
        visit(next);
      } else if (stack.has(next)) {
        const startIndex = path.indexOf(next);
        const nodes = [...path.slice(startIndex), next];
        cycles.set(nodes.join("->"), { kind, nodes });
      }
    }

    stack.delete(nodeId);
    path.pop();
  };

  for (const nodeId of nodeIds) {
    if (!visited.has(nodeId)) visit(nodeId);
  }

  return Array.from(cycles.values());
}

export function buildHarnessWorkflowGraph(plan: HarnessPlanDefinition): HarnessWorkflowGraph {
  const taskNodes: HarnessWorkflowGraph["taskNodes"] = {};
  const dispatchNodes: HarnessWorkflowGraph["dispatchNodes"] = {};
  const taskEdges: Array<readonly [string, string]> = [];
  const dispatchEdges: Array<readonly [string, string]> = [];
  const taskAdjacency = new Map<string, string[]>();
  const dispatchAdjacency = new Map<string, string[]>();

  for (const task of plan.tasks) {
    taskNodes[task.id] = {
      kind: "task",
      id: task.id,
      title: task.title,
      dependsOn: [...task.dependsOn],
      downstreamTaskIds: [],
      dispatchIds: task.dispatches.map((dispatch) => dispatch.id),
      indegree: task.dependsOn.length,
    };
    taskAdjacency.set(task.id, []);

    for (const dispatch of task.dispatches) {
      dispatchNodes[dispatch.id] = {
        kind: "dispatch",
        id: dispatch.id,
        taskId: task.id,
        dispatch: dispatch.dispatch,
        dependsOnDispatchIds: [...dispatch.dependsOnDispatches],
        downstreamDispatchIds: [],
        indegree: dispatch.dependsOnDispatches.length,
        required: dispatch.required,
      };
      dispatchAdjacency.set(dispatch.id, []);
    }
  }

  for (const task of plan.tasks) {
    for (const dependency of task.dependsOn) {
      taskNodes[dependency]?.downstreamTaskIds.push(task.id);
      taskAdjacency.get(dependency)?.push(task.id);
      taskEdges.push([dependency, task.id]);
    }

    for (const dispatch of task.dispatches) {
      for (const dependency of dispatch.dependsOnDispatches) {
        dispatchNodes[dependency]?.downstreamDispatchIds.push(dispatch.id);
        dispatchAdjacency.get(dependency)?.push(dispatch.id);
        dispatchEdges.push([dependency, dispatch.id]);
      }
    }
  }

  return {
    planId: plan.id,
    taskNodes,
    dispatchNodes,
    taskOrder: topologicalOrder(Object.keys(taskNodes), taskEdges),
    dispatchOrder: topologicalOrder(Object.keys(dispatchNodes), dispatchEdges),
    cycles: [
      ...detectCycles("task", Object.keys(taskNodes), taskAdjacency),
      ...detectCycles("dispatch", Object.keys(dispatchNodes), dispatchAdjacency),
    ],
  };
}

export function getReadyTaskIds(
  graph: HarnessWorkflowGraph,
  completedTaskIds: Iterable<string>,
): string[] {
  const completed = new Set(completedTaskIds);
  return Object.values(graph.taskNodes)
    .filter(
      (task) =>
        !completed.has(task.id) && task.dependsOn.every((dependency) => completed.has(dependency)),
    )
    .map((task) => task.id)
    .sort();
}

export function getBlockedTaskIds(
  graph: HarnessWorkflowGraph,
  completedTaskIds: Iterable<string>,
): string[] {
  const ready = new Set(getReadyTaskIds(graph, completedTaskIds));
  const completed = new Set(completedTaskIds);
  return Object.keys(graph.taskNodes)
    .filter((taskId) => !completed.has(taskId) && !ready.has(taskId))
    .sort();
}

export function getReadyDispatchIds(
  graph: HarnessWorkflowGraph,
  completedTaskIds: Iterable<string>,
  completedDispatchIds: Iterable<string>,
): string[] {
  const completedTasks = new Set(completedTaskIds);
  const completedDispatches = new Set(completedDispatchIds);

  return Object.values(graph.dispatchNodes)
    .filter((dispatch) => {
      const task = graph.taskNodes[dispatch.taskId];
      if (!task || completedTasks.has(dispatch.taskId)) return false;
      if (completedDispatches.has(dispatch.id)) return false;
      if (!task.dependsOn.every((dependency) => completedTasks.has(dependency))) return false;
      return dispatch.dependsOnDispatchIds.every((dependency) =>
        completedDispatches.has(dependency),
      );
    })
    .map((dispatch) => dispatch.id)
    .sort();
}
