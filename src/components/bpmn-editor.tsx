import { useEffect, useRef } from "react"
import BpmnModeler from "bpmn-js/lib/Modeler"
import gridModule from "diagram-js-grid"
import { layoutProcess } from "bpmn-auto-layout"
import "bpmn-js/dist/assets/diagram-js.css"
import "bpmn-js/dist/assets/bpmn-js.css"
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css"
import "@/components/bpmn-custom.css"

import { BpmnPalette } from "@/components/bpmn-palette"
import NullPaletteModule from "@/components/providers/null-pallete-provider"
import { useProcess } from "@/components/process-provider"
import { xmlToJson } from "@/lib/xml-to-json"

export function BpmnEditor() {
  const { getXml, setProcess } = useProcess()
  const containerRef = useRef<HTMLDivElement>(null)
  const modelerRef = useRef<BpmnModeler | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isSyncingRef = useRef(false)
  const isImportingRef = useRef(false)
  const isManualSyncRef = useRef(false)

  useEffect(() => {
    if (!containerRef.current) return

    modelerRef.current = new BpmnModeler({
      container: containerRef.current,
      additionalModules: [NullPaletteModule, gridModule],
    })

    const performLayout = async () => {
      let xml = getXml()
      console.log("[BpmnEditor] Initial layout, XML:", xml.substring(0, 200))

      try {
        xml = await layoutProcess(xml)
        console.log("[BpmnEditor] Initial layout applied")
      } catch (layoutErr) {
        console.warn("[BpmnEditor] Initial layout failed, using unformatted XML:", layoutErr)
      }

      isImportingRef.current = true
      modelerRef.current?.importXML(xml).catch((err) => {
        console.error("[BpmnEditor] Failed to import initial XML:", err)
        console.error("[BpmnEditor] XML attempted:", xml)
      }).finally(() => {
        isImportingRef.current = false
      })
    }

    performLayout()

    return () => {
      modelerRef.current?.destroy()
      modelerRef.current = null
    }
  }, [])

  useEffect(() => {
    if (!modelerRef.current) return

    // Skip re-import if this change came from manual sync
    if (isManualSyncRef.current) {
      isManualSyncRef.current = false
      return
    }

    const performLayout = async () => {
      let xml = getXml()
      console.log("[BpmnEditor] New process loaded, applying layout to XML:", xml.substring(0, 200))

      try {
        xml = await layoutProcess(xml)
        console.log("[BpmnEditor] Layout applied, importing XML")
      } catch (layoutErr) {
        console.warn("[BpmnEditor] Layout failed, using unformatted XML:", layoutErr)
      }

      isImportingRef.current = true
      modelerRef.current?.importXML(xml).catch((err) => {
        console.error("[BpmnEditor] Failed to import XML:", err)
        console.error("[BpmnEditor] XML attempted:", xml)
      }).finally(() => {
        isImportingRef.current = false
      })
    }

    performLayout()
  }, [getXml])

  // Listen for diagram changes via commandStack and sync back to process state
  useEffect(() => {
    if (!modelerRef.current) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eventBus = modelerRef.current.get("eventBus") as any
    if (!eventBus) return

    const handleDiagramChange = () => {
      // Skip if we're currently importing XML from the context
      if (isImportingRef.current) {
        console.log("[BpmnEditor] Skipping sync during import")
        return
      }

      // Debounce to avoid updating on every single change
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

      saveTimeoutRef.current = setTimeout(async () => {
        if (isSyncingRef.current || isImportingRef.current) return
        isSyncingRef.current = true

        try {
          const result = await modelerRef.current!.saveXML({ format: true })
          const xml = typeof result === "string" ? result : (result as { xml: string }).xml
          console.log("[BpmnEditor] Diagram changed, exporting to JSON")
          const updatedProcess = xmlToJson(xml)
          isManualSyncRef.current = true
          setProcess(updatedProcess)
          console.log("[BpmnEditor] Process updated from manual edits:", updatedProcess)
        } catch (err) {
          console.error("[BpmnEditor] Failed to sync diagram changes:", err)
        } finally {
          isSyncingRef.current = false
        }
      }, 500) // Debounce 500ms
    }

    eventBus.on("commandStack.changed", handleDiagramChange)

    return () => {
      eventBus.off("commandStack.changed", handleDiagramChange)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    }
  }, [setProcess])

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <BpmnPalette modelerRef={modelerRef} />
    </div>
  )
}

