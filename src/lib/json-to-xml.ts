/**
 * Convert Hierarchical JSON Schema to BPMN XML
 * Two-step process: Transform (normalize) then Generate (serialize)
 * Adapted from bpmn-assistant's bpmn_process_transformer and bpmn_xml_generator
 */

import type {
  BpmnProcess,
  BpmnElement,
} from "@/lib/bpmn-schema"
import {
  isEvent,
  isGateway,
  isExclusiveGateway,
  isInclusiveGateway,
  isParallelGateway,
} from "@/lib/bpmn-schema"

// ============================================================================
// TRANSFORM STEP: Flatten nested structure to explicit elements + flows
// ============================================================================

interface TransformedElement {
  id: string
  type: string
  name?: string
  eventDefinition?: string
  incoming: string[]
  outgoing: string[]
}

interface TransformedFlow {
  id: string
  sourceRef: string
  targetRef: string
  name?: string
  condition?: string
}

interface TransformedProcess {
  elements: TransformedElement[]
  flows: TransformedFlow[]
}

/**
 * Transform step: Convert nested JSON to flat element/flow structure
 */
function transformProcess(process: BpmnProcess): TransformedProcess {
  console.log("[jsonToXml] transformProcess input elements:", process.elements.length)
  const elements: TransformedElement[] = []
  const flows: TransformedFlow[] = []
  let flowCounter = 0

  function generateFlowId(): string {
    return `Flow_${++flowCounter}`
  }

  function transformElements(els: BpmnElement[], previousId?: string, nextElementId?: string): string | null {
    let lastId: string | null = previousId || null

    for (let i = 0; i < els.length; i++) {
      const el = els[i]
      const nextEl = els[i + 1]
      // Skip creating a flow when lastId === el.id: this happens at gateway convergence
      // points where the gateway handler already created the correct merge flows.
      const needsFlow = !!lastId && lastId !== el.id
      const element: TransformedElement = {
        id: el.id,
        type: el.type,
        name: el.label,
        incoming: needsFlow ? [generateFlowId()] : [],
        outgoing: [],
      }

      if (needsFlow && element.incoming.length > 0) {
        flows.push({
          id: element.incoming[0],
          sourceRef: lastId!,
          targetRef: el.id,
        })
      }

      if (isEvent(el)) {
        element.eventDefinition = el.eventDefinition
      }

      elements.push(element)
      lastId = el.id

      // Handle gateways
      if (isGateway(el)) {
        if (isExclusiveGateway(el) || isInclusiveGateway(el)) {
          const branchFlowIds: string[] = []
          // Determine convergence point: use explicit next, or fall back to next element in sequence
          const convergenceId = el.branches[0]?.next || nextEl?.id || nextElementId

          for (const branch of el.branches) {
            const branchFlowId = generateFlowId()
            branchFlowIds.push(branchFlowId)

            // Find where this branch ends
            const branchEndId = transformElements(branch.path, undefined)

            flows.push({
              id: branchFlowId,
              sourceRef: el.id,
              targetRef: branch.path[0]?.id || "",
              name: branch.condition,
            })

            if (branchEndId && convergenceId) {
              const mergeFlowId = generateFlowId()
              flows.push({
                id: mergeFlowId,
                sourceRef: branchEndId,
                targetRef: convergenceId,
              })
            }
          }

          element.outgoing = branchFlowIds
          // Jump to convergence point
          if (convergenceId) {
            lastId = convergenceId
          }
        } else if (isParallelGateway(el)) {
          const branchFlowIds: string[] = []
          const convergenceId = el.branches[0]?.[el.branches[0].length - 1]?.id || nextEl?.id || nextElementId

          for (const branch of el.branches) {
            const branchFlowId = generateFlowId()
            branchFlowIds.push(branchFlowId)

            const branchStartId = branch[0]?.id || ""
            flows.push({
              id: branchFlowId,
              sourceRef: el.id,
              targetRef: branchStartId,
            })

            transformElements(branch, undefined)
          }

          element.outgoing = branchFlowIds
          if (convergenceId) {
            lastId = convergenceId
          }
        }
      }
    }

    return lastId
  }

  transformElements(process.elements)

  // Post-pass: rebuild incoming/outgoing on every element directly from flows[].
  // The transform populates flows[] correctly but can't update a source element's outgoing
  // until the following element is processed (by which point the source is already in elements[]).
  // Gateway merge flows also target convergence elements not yet in elements[] at creation time.
  for (const el of elements) {
    el.outgoing = flows.filter(f => f.sourceRef === el.id).map(f => f.id)
    el.incoming = flows.filter(f => f.targetRef === el.id).map(f => f.id)
  }

  console.log("[jsonToXml] transformProcess output - elements:", elements.length, "flows:", flows.length)
  return { elements, flows }
}

// ============================================================================
// GENERATE STEP: Create BPMN XML from transformed structure
// ============================================================================

function generateBpmnXml(transformed: TransformedProcess): string {
  const xmlns = "http://www.omg.org/spec/BPMN/20100524/MODEL"
  const xsi = "http://www.w3.org/2001/XMLSchema-instance"
  const bpmndi = "http://www.omg.org/spec/BPMN/20100524/DI"
  const dc = "http://www.omg.org/spec/DD/20100524/DC"

  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="${xmlns}" xmlns:xsi="${xsi}" xmlns:bpmndi="${bpmndi}" xmlns:dc="${dc}" targetNamespace="http://bpmn.io/schema/bpmn" id="Definitions_1">
  <bpmn:process id="Process_1" isExecutable="false">`

  // Add elements
  for (const el of transformed.elements) {
    const name = el.name ? ` name="${escapeXml(el.name)}"` : ""

    // Element opening tag
    xml += `\n    <bpmn:${el.type} id="${el.id}"${name}>`

    // Incoming flows
    for (const incoming of el.incoming) {
      xml += `\n      <bpmn:incoming>${incoming}</bpmn:incoming>`
    }

    // Event definitions
    if (el.eventDefinition) {
      xml += `\n      <bpmn:${el.eventDefinition} />`
    }

    // Outgoing flows
    for (const outgoing of el.outgoing) {
      xml += `\n      <bpmn:outgoing>${outgoing}</bpmn:outgoing>`
    }

    // Element closing tag
    xml += `\n    </bpmn:${el.type}>`
  }

  // Add sequence flows
  for (const flow of transformed.flows) {
    const name = flow.name ? ` name="${escapeXml(flow.name)}"` : ""
    const condition = flow.condition ? `\n      <bpmn:conditionExpression xsi:type="tFormalExpression">${escapeXml(flow.condition)}</bpmn:conditionExpression>` : ""

    xml += `\n    <bpmn:sequenceFlow id="${flow.id}" sourceRef="${flow.sourceRef}" targetRef="${flow.targetRef}"${name}>${condition}\n    </bpmn:sequenceFlow>`
  }

  xml += `\n  </bpmn:process>
</bpmn:definitions>`

  return xml
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Convert hierarchical JSON schema to BPMN XML string
 */
export function jsonToXml(process: BpmnProcess): string {
  const transformed = transformProcess(process)
  return generateBpmnXml(transformed)
}
