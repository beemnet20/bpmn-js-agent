/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState } from "react"

const EMPTY_DIAGRAM = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`

interface XmlProviderState {
  xml: string
  setXml: (xml: string) => void
}

const XmlProviderContext = createContext<XmlProviderState | null>(null)

interface XmlProviderProps {
  children: React.ReactNode
  defaultXml?: string
}

export function XmlProvider({ children, defaultXml }: XmlProviderProps) {
  const [xml, setXml] = useState<string>(defaultXml ?? EMPTY_DIAGRAM)

  return (
    <XmlProviderContext.Provider value={{ xml, setXml }}>
      {children}
    </XmlProviderContext.Provider>
  )
}

export function useXml() {
  const context = useContext(XmlProviderContext)
  if (!context) throw new Error("useXml must be used within an XmlProvider")
  return context
}
