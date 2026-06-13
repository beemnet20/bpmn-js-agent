import { Navbar } from "@/components/navbar"
import { ChatWindow } from "./components/chat-window"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import { BpmnEditor } from "./components/bpmn-editor"

export function App() {
  return (
    <div className="flex min-h-svh flex-col">
      <Navbar />
      <main className="flex-1">
        <ResizablePanelGroup className="min-h-[calc(100vh-56px)]" orientation="vertical">
          <ResizablePanel defaultSize="50%" maxSize="75%"><BpmnEditor /></ResizablePanel>
          <ResizableHandle withHandle/>
          <ResizablePanel defaultSize="50%" maxSize="70%">
            <ChatWindow />
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>
    </div>
  )
}

export default App
