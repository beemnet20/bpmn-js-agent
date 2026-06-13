import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import "./index.css"
import App from "./App.tsx"
import { ThemeProvider } from "@/components/providers/theme-provider.tsx"
import { ModelEngineProvider } from "@/components/model-engine-provider.tsx"
import { ProcessProvider } from "@/components/process-provider.tsx"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <ModelEngineProvider>
        <ProcessProvider>
          <App />
        </ProcessProvider>
      </ModelEngineProvider>
    </ThemeProvider>
  </StrictMode>
)
