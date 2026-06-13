/**
 * Hierarchical BPMN JSON Schema
 * Adapted from bpmn-assistant (https://github.com/jtlicardo/bpmn-assistant)
 *
 * This schema represents BPMN processes as a nested, hierarchical structure
 * where gateways naturally contain branching logic instead of explicit flow objects.
 */

// ============================================================================
// ELEMENT TYPES
// ============================================================================

export type TaskType =
  | "task"
  | "userTask"
  | "serviceTask"
  | "sendTask"
  | "receiveTask"
  | "businessRuleTask"
  | "manualTask"
  | "scriptTask"

export type EventType =
  | "startEvent"
  | "endEvent"
  | "intermediateThrowEvent"
  | "intermediateCatchEvent"

export type EventDefinitionType =
  | "timerEventDefinition"
  | "messageEventDefinition"
  | "signalEventDefinition"

export type GatewayType = "exclusiveGateway" | "inclusiveGateway" | "parallelGateway"

export type ElementType = TaskType | EventType | GatewayType

// ============================================================================
// BRANCH STRUCTURES (for gateways)
// ============================================================================

/** Represents a branch in an exclusive or inclusive gateway */
export interface ConditionalBranch {
  /** Condition text for this branch (omitted for default branch) */
  condition?: string
  /** Elements within this branch */
  path: BpmnElement[]
  /** Optional: Jump to specific element ID instead of continuing sequence */
  next?: string
  /** For inclusive gateways: marks the default branch */
  isDefault?: boolean
}

/** Represents a branch in a parallel gateway (list of elements) */
export type ParallelBranch = BpmnElement[]

// ============================================================================
// ELEMENT DEFINITIONS
// ============================================================================

/** Task (user, service, etc.) */
export interface TaskElement {
  type: TaskType
  id: string
  label?: string
}

/** Event (start, end, intermediate) */
export interface EventElement {
  type: EventType
  id: string
  label?: string
  /** Event definition type (timer, message, etc.) */
  eventDefinition?: EventDefinitionType
}

/** Exclusive Gateway (XOR - one path executes) */
export interface ExclusiveGateway {
  type: "exclusiveGateway"
  id: string
  label?: string
  /** Whether this gateway also merges incoming paths (join gateway) */
  hasJoin?: boolean
  branches: ConditionalBranch[]
}

/** Inclusive Gateway (OR - any combination of paths can execute) */
export interface InclusiveGateway {
  type: "inclusiveGateway"
  id: string
  label?: string
  hasJoin?: boolean
  branches: ConditionalBranch[]
}

/** Parallel Gateway (AND - all paths execute in parallel) */
export interface ParallelGateway {
  type: "parallelGateway"
  id: string
  label?: string
  hasJoin?: boolean
  /** Each element in the array is a parallel branch */
  branches: ParallelBranch[]
}

/** Union of all element types */
export type BpmnElement =
  | TaskElement
  | EventElement
  | ExclusiveGateway
  | InclusiveGateway
  | ParallelGateway

// ============================================================================
// PROCESS STRUCTURE
// ============================================================================

/** Complete BPMN process */
export interface BpmnProcess {
  /** Process ID */
  id: string
  /** Process name */
  name?: string
  /** Whether the process is executable */
  isExecutable?: boolean
  /** Flat list of lanes (participants) */
  lanes?: string[]
  /** Root-level elements (linear sequence until first gateway) */
  elements: BpmnElement[]
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

export function isTask(el: BpmnElement): el is TaskElement {
  return (
    el.type === "task" ||
    el.type === "userTask" ||
    el.type === "serviceTask" ||
    el.type === "sendTask" ||
    el.type === "receiveTask" ||
    el.type === "businessRuleTask" ||
    el.type === "manualTask" ||
    el.type === "scriptTask"
  )
}

export function isEvent(el: BpmnElement): el is EventElement {
  return (
    el.type === "startEvent" ||
    el.type === "endEvent" ||
    el.type === "intermediateThrowEvent" ||
    el.type === "intermediateCatchEvent"
  )
}

export function isGateway(el: BpmnElement): el is ExclusiveGateway | InclusiveGateway | ParallelGateway {
  return (
    el.type === "exclusiveGateway" ||
    el.type === "inclusiveGateway" ||
    el.type === "parallelGateway"
  )
}

export function isExclusiveGateway(el: BpmnElement): el is ExclusiveGateway {
  return el.type === "exclusiveGateway"
}

export function isInclusiveGateway(el: BpmnElement): el is InclusiveGateway {
  return el.type === "inclusiveGateway"
}

export function isParallelGateway(el: BpmnElement): el is ParallelGateway {
  return el.type === "parallelGateway"
}

// ============================================================================
// UTILITIES
// ============================================================================

/** Get all element IDs from a process (flattened) */
export function getAllElementIds(process: BpmnProcess): string[] {
  const ids: string[] = []

  function collectIds(elements: BpmnElement[]) {
    for (const el of elements) {
      ids.push(el.id)
      if (isGateway(el)) {
        if (isParallelGateway(el)) {
          for (const branch of el.branches) {
            collectIds(branch)
          }
        } else {
          for (const branch of el.branches) {
            collectIds(branch.path)
          }
        }
      }
    }
  }

  collectIds(process.elements)
  return ids
}

/** Find an element by ID */
export function findElementById(process: BpmnProcess, id: string): BpmnElement | null {
  function search(elements: BpmnElement[]): BpmnElement | null {
    for (const el of elements) {
      if (el.id === id) return el
      if (isGateway(el)) {
        if (isParallelGateway(el)) {
          for (const branch of el.branches) {
            const found = search(branch)
            if (found) return found
          }
        } else {
          for (const branch of el.branches) {
            const found = search(branch.path)
            if (found) return found
          }
        }
      }
    }
    return null
  }

  return search(process.elements)
}
