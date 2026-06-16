import type { Engine } from "@litert-lm/core"
import {
  UNDERSTANDING_SYSTEM_PROMPT,
  GENERATION_SYSTEM_PROMPT,
  EDIT_SYSTEM_PROMPT,
  QUERY_SYSTEM_PROMPT,
  type ProcessUnderstanding,
} from "@/lib/bpmn-prompts"
import type { BpmnProcess } from "@/lib/bpmn-schema"
import { jsonToXml } from "@/lib/json-to-xml"

type Conversation = Awaited<ReturnType<Engine["createConversation"]>>

function extractText(response: unknown): string {
  if (!response || typeof response !== "object") return ""
  const r = response as { content?: unknown }
  const first = Array.isArray(r.content) ? r.content[0] : r.content
  if (typeof first === "string") return first
  if (first && typeof first === "object") {
    const t = (first as { text?: unknown }).text
    return typeof t === "string" ? t : ""
  }
  return ""
}

function parseUnderstanding(text: string): ProcessUnderstanding {
  const cleaned = text
    .replace(/^```[a-z]*\n?/i, "")
    .replace(/```\s*$/i, "")
    .trim()
  try {
    const parsed = JSON.parse(cleaned) as ProcessUnderstanding

    // Detect language switch: if reply or labels contain non-ASCII, likely a language switch
    const hasNonEnglish = (str: string | null | undefined): boolean => {
      if (!str) return false
      // Allow common ASCII punctuation but flag extended Unicode (Thai, Korean, Chinese, etc.)
      return /[\u0E00-\u0E7F\uAC00-\uD7AF\u4E00-\u9FFF\u3040-\u309F]/.test(str)
    }

    if (parsed.reply && hasNonEnglish(parsed.reply)) {
      console.warn(
        "[BpmnAgent] Detected non-English in reply, returning error response"
      )
      return {
        intent: "question",
        reply: "I can only respond in English. Please ask again in English.",
        steps: [],
        flows: [],
        followUpQuestion: null,
      }
    }

    // Also check step labels for non-English
    if (parsed.steps?.some((s) => hasNonEnglish(s.label))) {
      console.warn("[BpmnAgent] Detected non-English in step labels")
      return {
        intent: "question",
        reply:
          "I can only generate process diagrams in English. Please describe the process in English.",
        steps: [],
        flows: [],
        followUpQuestion: null,
      }
    }

    return parsed
  } catch {
    return {
      intent: "question",
      reply: "I can only respond in English. Please ask again in English.",
      steps: [],
      flows: [],
      followUpQuestion: null,
    }
  }
}

export class UnderstandingAgent {
  private engine: Engine
  private conv: Conversation | null = null
  private convQueue: Promise<unknown> = Promise.resolve()

  constructor(engine: Engine) {
    this.engine = engine
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.convQueue.then(fn)
    this.convQueue = next.catch(() => {})
    return next
  }

  /**
   * Classify and structure user input. Persistent conversation keeps context.
   * Pass currentProcess on first call to seed the model with diagram state.
   */
  async understand(
    userInput: string,
    currentProcess?: BpmnProcess
  ): Promise<ProcessUnderstanding> {
    return this.enqueue(async () => {
      if (!this.conv) {
        let systemContent = UNDERSTANDING_SYSTEM_PROMPT
        if (currentProcess) {
          systemContent += `\n\nThe current diagram is:\n${JSON.stringify(currentProcess, null, 2)}`
        }
        this.conv = await this.engine.createConversation({
          preface: { messages: [{ role: "system", content: systemContent }] },
        })
      }
      const response = await this.conv.sendMessage({
        role: "user",
        content: userInput,
      })
      return parseUnderstanding(extractText(response))
    })
  }

  /**
   * Update the conversation context after a diagram is generated.
   * Enqueued so it serializes with understand() calls.
   */
  notifyDiagramUpdated(process: BpmnProcess): Promise<void> {
    return this.enqueue(async () => {
      if (!this.conv) return
      await this.conv.sendMessage({
        role: "user",
        content: `The diagram has been updated. The current process is now:\n${JSON.stringify(process, null, 2)}`,
      })
    })
  }

  reset(): void {
    this.conv = null
  }
}

export class GenerationAgent {
  private engine: Engine

  constructor(engine: Engine) {
    this.engine = engine
  }

  async generate(understood: ProcessUnderstanding): Promise<{ process: BpmnProcess; xml: string }> {
    const conv = await this.engine.createConversation({
      preface: {
        messages: [{ role: "system", content: GENERATION_SYSTEM_PROMPT }],
      },
    })
    const response = await conv.sendMessage({
      role: "user",
      content: `Generate BPMN process JSON for the following process. Follow all rules exactly.\n\nProcess definition:\n${JSON.stringify(understood, null, 2)}`,
    })
    const rawJson = extractText(response)
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    const process = JSON.parse(rawJson) as BpmnProcess
    console.log("[GenerationAgent] Generated process JSON:", process)

    const xml = jsonToXml(process)
    console.log("[GenerationAgent] Converted to XML:", xml)

    return { process, xml }
  }
}

export class EditAgent {
  private engine: Engine

  constructor(engine: Engine) {
    this.engine = engine
  }

  async edit(currentProcess: BpmnProcess, changeRequest: string): Promise<{ process: BpmnProcess; xml: string }> {
    const conv = await this.engine.createConversation({
      preface: {
        messages: [{ role: "system", content: EDIT_SYSTEM_PROMPT }],
      },
    })
    const response = await conv.sendMessage({
      role: "user",
      content: `Current process:\n${JSON.stringify(currentProcess, null, 2)}\n\nChange request: ${changeRequest}`,
    })
    const rawJson = extractText(response)
      .replace(/^```[a-z]*\n?/i, "")
      .replace(/```\s*$/i, "")
      .trim()

    const process = JSON.parse(rawJson) as BpmnProcess
    console.log("[EditAgent] Updated process JSON:", process)

    const xml = jsonToXml(process)
    return { process, xml }
  }
}

export class QueryAgent {
  private engine: Engine

  constructor(engine: Engine) {
    this.engine = engine
  }

  async answer(currentProcess: BpmnProcess, question: string): Promise<string> {
    const conv = await this.engine.createConversation({
      preface: {
        messages: [{
          role: "system",
          content: `${QUERY_SYSTEM_PROMPT}\n\nCurrent diagram:\n${JSON.stringify(currentProcess, null, 2)}`,
        }],
      },
    })
    const response = await conv.sendMessage({
      role: "user",
      content: question,
    })
    return extractText(response)
  }
}
