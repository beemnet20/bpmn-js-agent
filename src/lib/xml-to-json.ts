/**
 * Convert BPMN XML to Hierarchical JSON Schema
 * Adapted from bpmn-assistant's xml_to_json conversion logic
 */

import type {
  BpmnProcess,
  BpmnElement,
  TaskType,
  EventType,
  EventDefinitionType,
  ExclusiveGateway,
  InclusiveGateway,
  ParallelGateway,
  ConditionalBranch,
  ParallelBranch,
} from "@/lib/bpmn-schema"

interface RawElement {
  id: string
  type: ElementType
  name?: string
  eventDefinition?: EventDefinitionType
  incoming: string[] // flow IDs
  outgoing: string[] // flow IDs
}

interface RawFlow {
  id: string
  sourceRef: string
  targetRef: string
  name?: string // condition label
}

type ElementType = "task" | "userTask" | "serviceTask" | "startEvent" | "endEvent" | "exclusiveGateway" | "inclusiveGateway" | "parallelGateway" | "intermediateThrowEvent" | "intermediateCatchEvent"

/**
 * Extract elements and flows from BPMN XML
 */
function extractElementsAndFlows(xmlString: string): { elements: Map<string, RawElement>; flows: Map<string, RawFlow> } {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlString, "text/xml")

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("Failed to parse BPMN XML")
  }

  const ns = "http://www.omg.org/spec/BPMN/20100524/MODEL"
  const elements = new Map<string, RawElement>()
  const flows = new Map<string, RawFlow>()

  // Find the process element first
  const processElements = doc.getElementsByTagNameNS(ns, "process")
  if (processElements.length === 0) {
    throw new Error("No process element found in BPMN XML")
  }
  const processElement = processElements[0]

  // Extract only direct children of process (not nested elements)
  const taskElements: Element[] = []
  for (let i = 0; i < processElement.childNodes.length; i++) {
    const node = processElement.childNodes[i]
    if (node.nodeType === 1) { // Element node
      const el = node as Element
      const tagName = el.localName
      // Only include BPMN element types, not flow references
      if (tagName && [
        "task", "userTask", "serviceTask", "sendTask", "receiveTask",
        "businessRuleTask", "manualTask", "scriptTask",
        "startEvent", "endEvent", "intermediateThrowEvent", "intermediateCatchEvent",
        "exclusiveGateway", "inclusiveGateway", "parallelGateway",
        "sequenceFlow"
      ].includes(tagName)) {
        taskElements.push(el)
      }
    }
  }

  console.log("[xmlToJson] Found", taskElements.length, "BPMN elements in process")
  for (let i = 0; i < taskElements.length; i++) {
    const el = taskElements[i]
    const tagName = el.localName
    const id = el.getAttribute("id")

    console.log(`[xmlToJson] Element ${i}: tagName=${tagName}, id=${id}`)

    if (!id) continue

    // Determine element type
    let type: ElementType | null = null
    if (tagName === "task") type = "task"
    else if (tagName === "userTask") type = "userTask"
    else if (tagName === "serviceTask") type = "serviceTask"
    else if (tagName === "startEvent") type = "startEvent"
    else if (tagName === "endEvent") type = "endEvent"
    else if (tagName === "exclusiveGateway") type = "exclusiveGateway"
    else if (tagName === "inclusiveGateway") type = "inclusiveGateway"
    else if (tagName === "parallelGateway") type = "parallelGateway"
    else if (tagName === "intermediateThrowEvent") type = "intermediateThrowEvent"
    else if (tagName === "intermediateCatchEvent") type = "intermediateCatchEvent"
    else if (tagName === "sequenceFlow") continue // Handle flows separately

    if (!type) continue

    // Extract incoming/outgoing flows
    const incoming: string[] = []
    const outgoing: string[] = []
    const incomingEls = el.getElementsByTagNameNS(ns, "incoming")
    const outgoingEls = el.getElementsByTagNameNS(ns, "outgoing")

    for (let j = 0; j < incomingEls.length; j++) {
      const text = incomingEls[j].textContent
      if (text) incoming.push(text)
    }
    for (let j = 0; j < outgoingEls.length; j++) {
      const text = outgoingEls[j].textContent
      if (text) outgoing.push(text)
    }

    // Extract event definition if present
    let eventDefinition: EventDefinitionType | undefined
    const timerDef = el.getElementsByTagNameNS(ns, "timerEventDefinition")
    const messageDef = el.getElementsByTagNameNS(ns, "messageEventDefinition")
    const signalDef = el.getElementsByTagNameNS(ns, "signalEventDefinition")

    if (timerDef.length > 0) eventDefinition = "timerEventDefinition"
    else if (messageDef.length > 0) eventDefinition = "messageEventDefinition"
    else if (signalDef.length > 0) eventDefinition = "signalEventDefinition"

    elements.set(id, {
      id,
      type,
      name: el.getAttribute("name") || undefined,
      eventDefinition,
      incoming,
      outgoing,
    })
  }

  // Extract flows from direct children of process
  const flowElements: Element[] = []
  for (let i = 0; i < processElement.childNodes.length; i++) {
    const node = processElement.childNodes[i]
    if (node.nodeType === 1) { // Element node
      const el = node as Element
      if (el.localName === "sequenceFlow") {
        flowElements.push(el)
      }
    }
  }

  console.log("[xmlToJson] Found", flowElements.length, "sequenceFlow elements")
  for (let i = 0; i < flowElements.length; i++) {
    const flow = flowElements[i]
    const id = flow.getAttribute("id")
    const sourceRef = flow.getAttribute("sourceRef")
    const targetRef = flow.getAttribute("targetRef")

    if (!id || !sourceRef || !targetRef) continue

    flows.set(id, {
      id,
      sourceRef,
      targetRef,
      name: flow.getAttribute("name") || undefined,
    })

    // Update element outgoing/incoming based on flows
    const sourceEl = elements.get(sourceRef)
    if (sourceEl && !sourceEl.outgoing.includes(id)) {
      sourceEl.outgoing.push(id)
    }

    const targetEl = elements.get(targetRef)
    if (targetEl && !targetEl.incoming.includes(id)) {
      targetEl.incoming.push(id)
    }
  }

  console.log("[xmlToJson] Extracted", elements.size, "elements and", flows.size, "flows")
  return { elements, flows }
}

/**
 * Find all elements reachable from a starting element via outgoing flows
 */
function tracePathsFromElement(
  startId: string,
  elements: Map<string, RawElement>,
  flows: Map<string, RawFlow>,
  visited: Set<string> = new Set()
): string[] {
  if (visited.has(startId)) return []
  visited.add(startId)

  const element = elements.get(startId)
  if (!element) return []

  const reachable: string[] = [startId]

  for (const flowId of element.outgoing) {
    const flow = flows.get(flowId)
    if (!flow) continue

    const paths = tracePathsFromElement(flow.targetRef, elements, flows, visited)
    reachable.push(...paths)
  }

  return reachable
}

/**
 * Find the common endpoint where all branches of a gateway converge
 */
function findCommonBranchEndpoint(
  gatewayId: string,
  elements: Map<string, RawElement>,
  flows: Map<string, RawFlow>
): string | undefined {
  const gateway = elements.get(gatewayId)
  if (!gateway) return undefined

  // Get all paths from each outgoing flow
  const allReachable: string[][] = []
  for (const flowId of gateway.outgoing) {
    const flow = flows.get(flowId)
    if (!flow) continue
    const paths = tracePathsFromElement(flow.targetRef, elements, flows, new Set([gatewayId]))
    allReachable.push(paths)
  }

  if (allReachable.length === 0) return undefined

  // Find common elements in all paths
  const firstPath = new Set(allReachable[0])
  const common = Array.from(firstPath).filter(id =>
    allReachable.every(path => path.includes(id))
  )

  // Return the first common element (closest to gateway)
  return common.length > 0 ? common[0] : undefined
}

/**
 * Recursively build the nested structure starting from an element
 * Uses visited set to prevent infinite recursion
 */
function buildStructureRecursive(
  elementId: string,
  elements: Map<string, RawElement>,
  flows: Map<string, RawFlow>,
  stopAtId?: string,
  visited: Set<string> = new Set()
): BpmnElement | null {
  // Prevent revisiting elements and stop at designated point
  if (visited.has(elementId) || (stopAtId && elementId === stopAtId)) return null
  visited.add(elementId)

  const element = elements.get(elementId)
  if (!element) return null

  // Handle tasks and events
  if (element.type === "task" || element.type === "userTask" || element.type === "serviceTask" || element.type.endsWith("Task")) {
    return {
      type: element.type as TaskType,
      id: element.id,
      label: element.name,
    }
  }

  if (element.type === "startEvent" || element.type === "endEvent" || element.type.includes("Event")) {
    return {
      type: element.type as EventType,
      id: element.id,
      label: element.name,
      eventDefinition: element.eventDefinition,
    }
  }

  // Handle exclusive gateway
  if (element.type === "exclusiveGateway") {
    const branches: ConditionalBranch[] = []

    for (const flowId of element.outgoing) {
      const flow = flows.get(flowId)
      if (!flow) continue

      const joinId = findCommonBranchEndpoint(elementId, elements, flows)
      const path: BpmnElement[] = []
      const branchVisited = new Set(visited)

      let currentId = flow.targetRef
      while (currentId && currentId !== joinId && !branchVisited.has(currentId)) {
        const el = buildStructureRecursive(currentId, elements, flows, joinId, branchVisited)
        if (el) path.push(el)

        const current = elements.get(currentId)
        if (!current || current.outgoing.length === 0) break

        const nextFlowId = current.outgoing[0]
        const nextFlow = flows.get(nextFlowId)
        if (!nextFlow) break

        currentId = nextFlow.targetRef
      }

      branches.push({
        condition: flow.name || undefined,
        path,
        next: joinId || undefined,
      })
    }

    return {
      type: "exclusiveGateway",
      id: element.id,
      label: element.name,
      branches,
    } as ExclusiveGateway
  }

  // Handle inclusive gateway (similar to exclusive)
  if (element.type === "inclusiveGateway") {
    const branches: ConditionalBranch[] = []
    let defaultSet = false

    for (const flowId of element.outgoing) {
      const flow = flows.get(flowId)
      if (!flow) continue

      const joinId = findCommonBranchEndpoint(elementId, elements, flows)
      const path: BpmnElement[] = []
      const branchVisited = new Set(visited)

      let currentId = flow.targetRef
      while (currentId && currentId !== joinId && !branchVisited.has(currentId)) {
        const el = buildStructureRecursive(currentId, elements, flows, joinId, branchVisited)
        if (el) path.push(el)

        const current = elements.get(currentId)
        if (!current || current.outgoing.length === 0) break

        const nextFlowId = current.outgoing[0]
        const nextFlow = flows.get(nextFlowId)
        if (!nextFlow) break

        currentId = nextFlow.targetRef
      }

      const isDefault = !defaultSet && !flow.name
      if (isDefault) defaultSet = true

      branches.push({
        condition: flow.name || undefined,
        path,
        next: joinId || undefined,
        isDefault,
      })
    }

    return {
      type: "inclusiveGateway",
      id: element.id,
      label: element.name,
      branches,
    } as InclusiveGateway
  }

  // Handle parallel gateway
  if (element.type === "parallelGateway") {
    const branches: ParallelBranch[] = []

    for (const flowId of element.outgoing) {
      const flow = flows.get(flowId)
      if (!flow) continue

      const joinId = findCommonBranchEndpoint(elementId, elements, flows)
      const branch: BpmnElement[] = []
      const branchVisited = new Set(visited)

      let currentId = flow.targetRef
      while (currentId && currentId !== joinId && !branchVisited.has(currentId)) {
        const el = buildStructureRecursive(currentId, elements, flows, joinId, branchVisited)
        if (el) branch.push(el)

        const current = elements.get(currentId)
        if (!current || current.outgoing.length === 0) break

        const nextFlowId = current.outgoing[0]
        const nextFlow = flows.get(nextFlowId)
        if (!nextFlow) break

        currentId = nextFlow.targetRef
      }

      branches.push(branch)
    }

    return {
      type: "parallelGateway",
      id: element.id,
      label: element.name,
      branches,
    } as ParallelGateway
  }

  return null
}

/**
 * Convert BPMN XML string to hierarchical JSON schema
 */
export function xmlToJson(xmlString: string): BpmnProcess {
  console.log("[xmlToJson] Starting conversion, XML length:", xmlString.length)
  const { elements, flows } = extractElementsAndFlows(xmlString)

  // Find start event
  let startEventId: string | null = null
  for (const [id, el] of elements) {
    if (el.type === "startEvent") {
      startEventId = id
      break
    }
  }

  if (!startEventId) {
    throw new Error("No start event found in BPMN diagram")
  }

  // Build structure recursively from start event
  const processElements: BpmnElement[] = []
  const processedIds = new Set<string>()
  let currentId = startEventId
  let loopCount = 0
  const MAX_ITERATIONS = Math.max(100, elements.size * 2)

  while (currentId && loopCount < MAX_ITERATIONS) {
    loopCount++
    console.log(`[xmlToJson] Loop ${loopCount}: processing ${currentId}`)

    // Prevent processing the same element twice
    if (processedIds.has(currentId)) {
      console.log(`[xmlToJson] Already processed ${currentId}, breaking`)
      break
    }
    processedIds.add(currentId)

    const el = buildStructureRecursive(currentId, elements, flows)
    if (el) {
      console.log(`[xmlToJson] Added element:`, el.id, "type:", el.type)
      processElements.push(el)
    }

    const current = elements.get(currentId)
    if (!current || current.outgoing.length === 0) {
      console.log(`[xmlToJson] No more outgoing flows from ${currentId}, breaking`)
      break
    }

    // If element is a gateway with branches, jump to convergence point
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((el as any).branches) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const gateway = el as any
      if (gateway.branches && gateway.branches.length > 0) {
        const firstBranch = gateway.branches[0]
        if (firstBranch.next) {
          console.log(`[xmlToJson] Gateway with convergence, jumping to ${firstBranch.next}`)
          currentId = firstBranch.next
          continue
        }
      }
    }

    const nextFlowId = current.outgoing[0]
    const nextFlow = flows.get(nextFlowId)
    if (!nextFlow) {
      console.log(`[xmlToJson] Flow ${nextFlowId} not found, breaking`)
      break
    }

    currentId = nextFlow.targetRef
    console.log(`[xmlToJson] Following to ${currentId}`)
  }

  if (loopCount >= MAX_ITERATIONS) {
    console.warn(`[xmlToJson] Hit maximum iterations (${MAX_ITERATIONS}), stopping conversion`)
  }

  console.log(`[xmlToJson] Final processElements:`, processElements.length)

  return {
    id: "Process_1",
    isExecutable: false,
    elements: processElements,
  }
}
