/* eslint-disable react-refresh/only-export-components */
import * as React from "react"
import { Engine, type EngineSettings } from "@litert-lm/core"
import { toast } from "sonner"
import { Toaster } from "@/components/ui/sonner"

const modelMapping: Record<string, string> = {
  "gemma-4-e2b":
    "https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm",
  "gemma-4-e4b":
    "https://huggingface.co/litert-community/gemma-4-E4B-it-litert-lm/resolve/main/gemma-4-E4B-it-web.litertlm",
}

export type Model = "gemma-4-e2b" | "gemma-4-e4b"
export const MODEL_VALUES: Model[] = ["gemma-4-e2b", "gemma-4-e4b"]

async function getOrFetchModel(model: Model, signal?: AbortSignal): Promise<File> {
  const filename = `${model}.litertlm`
  const root = await navigator.storage.getDirectory()

  try {
    const handle = await root.getFileHandle(filename)
    return handle.getFile()
  } catch {
    // not cached — fall through to fetch
  }

  const toastId = `download-${model}`
  toast.loading(`Downloading ${model}…`, { id: toastId })

  let handle: FileSystemFileHandle | null = null

  try {
    const response = await fetch(modelMapping[model], { signal })
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`)

    const contentLength = Number(response.headers.get("content-length")) || 0
    let received = 0

    handle = await root.getFileHandle(filename, { create: true })
    const writable = await handle.createWritable()

    const tracker = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        received += chunk.byteLength
        if (contentLength > 0) {
          const pct = Math.round((received / contentLength) * 100)
          toast.loading(`Downloading ${model} (${pct}%)`, { id: toastId })
        }
        controller.enqueue(chunk)
      },
    })

    await response.body.pipeThrough(tracker).pipeTo(writable)
    toast.dismiss(toastId)

    return handle.getFile()
  } catch (err) {
    toast.dismiss(toastId)
    if (handle) {
      try { await root.removeEntry(filename) } catch { /* ignore cleanup errors */ }
    }
    throw err
  }
}

type EngineStatus = "idle" | "loading" | "ready" | "error"

type ModelEngineProviderState = {
  model: Model
  setModel: (model: Model) => void
  engine: Engine | null
  status: EngineStatus
  error: Error | null
}

const ModelEngineContext = React.createContext<
  ModelEngineProviderState | undefined
>(undefined)

type ModelEngineProviderProps = {
  children: React.ReactNode
  defaultModel?: Model
  storageKey?: string
}

export function ModelEngineProvider({
  children,
  defaultModel = "gemma-4-e2b",
  storageKey = "model",
}: ModelEngineProviderProps) {
  const [model, setModelState] = React.useState<Model>(() => {
    const stored = localStorage.getItem(storageKey)
    if (stored && MODEL_VALUES.includes(stored as Model)) {
      return stored as Model
    }
    return defaultModel
  })

  const [engine, setEngine] = React.useState<Engine | null>(null)
  const [status, setStatus] = React.useState<EngineStatus>("idle")
  const [error, setError] = React.useState<Error | null>(null)

  const engineRef = React.useRef<Engine | null>(null)

  React.useEffect(() => {
    let cancelled = false
    const controller = new AbortController()

    async function loadEngine() {
      if (engineRef.current) {
        await engineRef.current.delete()
        engineRef.current = null
      }

      setStatus("loading")
      setEngine(null)
      setError(null)

      try {
        const modelFile = await getOrFetchModel(model, controller.signal)

        if (cancelled) return

        const enginePromise = Engine.create({
          model: modelFile.stream(),
          mainExecutorSettings: { maxNumTokens: 8192 },
        } satisfies EngineSettings)

        toast.promise(enginePromise, {
          loading: `Initializing ${model}…`,
          success: `${model} ready`,
          error: (err) =>
            err instanceof Error ? err.message : `Failed to load ${model}`,
        })

        const next = await enginePromise

        if (cancelled) {
          await next.delete()
          return
        }

        engineRef.current = next
        setEngine(next)
        setStatus("ready")
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)))
          setStatus("error")
        }
      }
    }

    loadEngine()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [model])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      engineRef.current?.delete()
    }
  }, [])

  const setModel = React.useCallback(
    (next: Model) => {
      localStorage.setItem(storageKey, next)
      setModelState(next)
    },
    [storageKey]
  )

  const value = React.useMemo(
    () => ({ model, setModel, engine, status, error }),
    [model, setModel, engine, status, error]
  )

  return (
    <ModelEngineContext.Provider value={value}>
      {children}
      <Toaster />
    </ModelEngineContext.Provider>
  )
}

export function useModelEngine() {
  const context = React.useContext(ModelEngineContext)
  if (context === undefined) {
    throw new Error("useModelEngine must be used within a ModelEngineProvider")
  }
  return context
}
