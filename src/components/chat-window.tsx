import React from "react"
import { cn } from "@/lib/utils"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { AlertCircle, CircleStop, ArrowBigUp, Check, Copy } from "lucide-react"
import { useModelEngine } from "@/components/model-engine-provider.tsx"
import { ModelSelector } from "@/components/model-selector.tsx"
import { useProcess } from "@/components/process-provider"
import { UnderstandingAgent, GenerationAgent } from "@/lib/bpmn-agent"

interface Message {
  role: "user" | "assistant"
  content: string
}

type Phase = "idle" | "understanding" | "generating" | "error"

export function ChatWindow(): React.JSX.Element {
  const { error, engine } = useModelEngine()
  const { process, setProcess } = useProcess()
  const [currentMessage, setCurrentMessage] = React.useState("")
  const [messages, setMessages] = React.useState<Message[]>([])
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [generationError, setGenerationError] = React.useState<string | null>(null)

  const agentRef = React.useRef<{ understanding: UnderstandingAgent; generation: GenerationAgent } | null>(null)
  const abortRef = React.useRef<boolean>(false)
  // track whether we're in the middle of a follow-up loop
  const [awaitingFollowUp, setAwaitingFollowUp] = React.useState<boolean>(false)
  const bottomRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, phase])

  React.useEffect(() => {
    if (engine) {
      agentRef.current = {
        understanding: new UnderstandingAgent(engine),
        generation: new GenerationAgent(engine),
      }
    }
  }, [engine])

  const isGenerating = phase === "understanding" || phase === "generating"

  const addMessage = (role: Message["role"], content: string) => {
    setMessages((prev) => [...prev, { role, content }])
  }

  const handleStop = () => {
    abortRef.current = true
    setPhase("idle")
  }

  const handleSubmit = async (): Promise<void> => {
    const input = currentMessage.trim()
    if (!input || isGenerating || !agentRef.current) return

    setCurrentMessage("")
    setGenerationError(null)
    abortRef.current = false
    addMessage("user", input)
    console.debug("[ChatWindow] handleSubmit, agent:", !!agentRef.current, "phase:", phase)

    try {
      setPhase("understanding")

      // Pass current process directly to understanding agent (only on first message)
      const currentProcess = awaitingFollowUp ? undefined : process

      const understood = await agentRef.current.understanding.understand(input, currentProcess)

      if (abortRef.current) return

      if (understood.intent === "question") {
        addMessage("assistant", understood.reply ?? "I'm not sure — could you rephrase?")
        setAwaitingFollowUp(false)
        setPhase("idle")
        return
      }

      if (understood.followUpQuestion && understood.followUpQuestion !== "none") {
        addMessage("assistant", understood.followUpQuestion)
        setAwaitingFollowUp(true)
        setPhase("idle")
        return
      }

      setAwaitingFollowUp(false)
      setPhase("generating")
      addMessage("assistant", "Got it — generating your diagram now…")

      const { process: generatedProcess, xml: generatedXml } = await agentRef.current.generation.generate(understood)

      if (abortRef.current) return

      console.log("[ChatWindow] Generated process:", generatedProcess)
      console.log("[ChatWindow] Generated XML:", generatedXml)

      setProcess(generatedProcess)
      addMessage("assistant", "Done! Your diagram has been updated.")
      setPhase("idle")

      // Update understanding agent with the new process state
      agentRef.current.understanding.notifyDiagramUpdated(generatedProcess).catch(console.error)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setGenerationError(msg)
      addMessage("assistant", `Something went wrong: ${msg}`)
      setAwaitingFollowUp(false)
      setPhase("idle")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  if (error) {
    return (
      <Alert variant="destructive" className="max-w-md">
        <AlertCircle />
        <AlertTitle>Error loading LLM</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex h-full flex-col gap-4 rounded p-6">
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-2">
          {messages.length === 0 && (
            <p className="text-muted-foreground text-sm text-center mt-8">
              Describe a business process and I'll generate a BPMN diagram for you.
            </p>
          )}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "flex max-w-[75%] flex-col",
                  msg.role === "user" ? "items-end" : "items-start"
                )}
              >
                <div
                  className={cn(
                    "py-2 text-sm",
                    msg.role === "user"
                      ? "px-2 bg-primary dark:bg-secondary text-primary-foreground dark:text-secondary-foreground rounded-lg"
                      : "border-0"
                  )}
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
                {msg.role === "assistant" && (
                  <div className="flex-row justify-end items-center gap-2 mt-1">
                    <CopyButton text={msg.content} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {phase === "understanding" && (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Spinner />
            <span>Thinking...</span>
          </div>
        )}
        {phase === "generating" && (
          <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
            <Spinner />
            <span>Generating BPMN diagram…</span>
          </div>
        )}

        {generationError && (
          <Alert variant="destructive" className="mx-2 mt-2">
            <AlertCircle />
            <AlertTitle>Generation failed</AlertTitle>
            <AlertDescription>{generationError}</AlertDescription>
          </Alert>
        )}

        <div ref={bottomRef} />
      </ScrollArea>

      <InputGroup className="[--radius:2rem]">
        <InputGroupTextarea
          placeholder={
            awaitingFollowUp
              ? "Answer the follow-up question…"
              : "Describe a process to generate a BPMN diagram… (Enter to send)"
          }
          className="resize-none p-3"
          value={currentMessage}
          onChange={(e) => setCurrentMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating}
        />

        <InputGroupAddon
          align="block-end"
          className="flex-row items-center justify-end gap-2"
        >
          <ModelSelector />
          {isGenerating ? (
            <InputGroupButton size="sm" variant="ghost" onClick={handleStop}>
              <CircleStop className="size-4" />
            </InputGroupButton>
          ) : currentMessage.trim() !== "" ? (
            <InputGroupButton size="sm" variant="default" onClick={handleSubmit}>
              <ArrowBigUp className="size-4" />
            </InputGroupButton>
          ) : null}
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false)
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }
  return (
    <Button
      className="p-2"
      variant="ghost"
      size="xs"
      onClick={handleCopy}
      aria-label="Copy message"
    >
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
    </Button>
  )
}
