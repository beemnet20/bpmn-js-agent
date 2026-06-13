/**
 * useBpmnPalette
 *
 * Exposes bpmn-js services to React for the custom palette.
 * Covers element creation and tool activation.
 *
 * Element morphing (changing type after placement) is handled by the
 * built-in bpmn-js context pad — click any element and use the wrench icon.
 */

import type BpmnModeler from 'bpmn-js/lib/Modeler'

type ModelerRef = React.RefObject<BpmnModeler | null>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyService = any

function getServices(modelerRef: ModelerRef): {
  create: AnyService
  elementFactory: AnyService
  handTool: AnyService
  lassoTool: AnyService
  spaceTool: AnyService
  globalConnect: AnyService
} | null {
  const modeler = modelerRef.current
  if (!modeler) return null

  return {
    create: modeler.get('create'),
    elementFactory: modeler.get('elementFactory'),
    handTool: modeler.get('handTool'),
    lassoTool: modeler.get('lassoTool'),
    spaceTool: modeler.get('spaceTool'),
    globalConnect: modeler.get('globalConnect'),
  }
}

export function useBpmnPalette(modelerRef: ModelerRef) {

  // ── Shape creators ────────────────────────────────────────────────────────

  function createShape(type: string, options: Record<string, unknown> = {}) {
    return (event: React.MouseEvent | React.PointerEvent) => {
      const s = getServices(modelerRef)
      if (!s) return
      const shape = s.elementFactory.createShape({ type, ...options })
      s.create.start(event.nativeEvent, shape)
    }
  }

  const createTask = createShape('bpmn:Task')
  const createStartEvent = createShape('bpmn:StartEvent')
  const createEndEvent = createShape('bpmn:EndEvent')
  const createIntermediateEvent = createShape('bpmn:IntermediateThrowEvent')
  const createExclusiveGateway = createShape('bpmn:ExclusiveGateway')
  const createParallelGateway = createShape('bpmn:ParallelGateway')
  const createInclusiveGateway = createShape('bpmn:InclusiveGateway')
  const createDataObject = createShape('bpmn:DataObjectReference')
  const createDataStore = createShape('bpmn:DataStoreReference')
  const createGroup = createShape('bpmn:Group')

  function createSubProcess(event: React.MouseEvent | React.PointerEvent) {
    const s = getServices(modelerRef)
    if (!s) return
    const subProcess = s.elementFactory.createShape({
      type: 'bpmn:SubProcess',
      x: 0, y: 0,
      isExpanded: true,
    })
    const startEvent = s.elementFactory.createShape({
      type: 'bpmn:StartEvent',
      x: 40, y: 82,
      parent: subProcess,
    })
    s.create.start(event.nativeEvent, [subProcess, startEvent], {
      hints: { autoSelect: [subProcess] },
    })
  }

  function createParticipant(event: React.MouseEvent | React.PointerEvent) {
    const s = getServices(modelerRef)
    if (!s) return
    const shape = s.elementFactory.createParticipantShape()
    s.create.start(event.nativeEvent, shape)
  }

  // ── Tool activators ───────────────────────────────────────────────────────

  function activateHandTool(event: React.MouseEvent) {
    getServices(modelerRef)?.handTool.activateHand(event.nativeEvent)
  }

  function activateLassoTool(event: React.MouseEvent) {
    getServices(modelerRef)?.lassoTool.activateSelection(event.nativeEvent)
  }

  function activateSpaceTool(event: React.MouseEvent) {
    getServices(modelerRef)?.spaceTool.activateSelection(event.nativeEvent)
  }

  function activateGlobalConnect(event: React.MouseEvent) {
    getServices(modelerRef)?.globalConnect.start(event.nativeEvent)
  }

  return {
    createTask,
    createStartEvent,
    createEndEvent,
    createIntermediateEvent,
    createExclusiveGateway,
    createParallelGateway,
    createInclusiveGateway,
    createSubProcess,
    createParticipant,
    createDataObject,
    createDataStore,
    createGroup,
    activateHandTool,
    activateLassoTool,
    activateSpaceTool,
    activateGlobalConnect,
  }
}