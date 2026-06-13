/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback } from "react"
import type { BpmnProcess } from "@/lib/bpmn-schema"
import { jsonToXml } from "@/lib/json-to-xml"

const EMPTY_PROCESS: BpmnProcess = {
  id: "Process_1",
  isExecutable: false,
  elements: [],
}

interface ProcessProviderState {
  process: BpmnProcess
  setProcess: (process: BpmnProcess) => void
  /** Convenience: get XML representation of current process */
  getXml: () => string
}

const ProcessProviderContext = createContext<ProcessProviderState | null>(null)

interface ProcessProviderProps {
  children: React.ReactNode
  defaultProcess?: BpmnProcess
}

export function ProcessProvider({ children, defaultProcess }: ProcessProviderProps) {
  const [process, setProcess] = useState<BpmnProcess>(defaultProcess ?? EMPTY_PROCESS)

  const getXml = useCallback(() => {
    try {
      console.log("[ProcessProvider] getXml called with process elements:", process.elements.length)
      return jsonToXml(process)
    } catch {
      // Fallback to empty diagram if conversion fails
      console.error("[ProcessProvider] jsonToXml failed, using empty process")
      return jsonToXml(EMPTY_PROCESS)
    }
  }, [process])

  return (
    <ProcessProviderContext.Provider value={{ process, setProcess, getXml }}>
      {children}
    </ProcessProviderContext.Provider>
  )
}

export function useProcess() {
  const context = useContext(ProcessProviderContext)
  if (!context) throw new Error("useProcess must be used within a ProcessProvider")
  return context
}
