/**
 * BpmnPalette
 *
 * A shadcn-native replacement for the built-in bpmn-js palette.
 * Renders as a floating vertical toolbar overlaid on the canvas container.
 * Adapts to available height by reflowing into multiple columns — no scrollbar.
 *
 * Element morphing (task → user task, event → timer event, etc.) is handled
 * by the built-in bpmn-js context pad wrench icon — no custom code needed.
 *
 * Prerequisites:
 *   1. Pass NullPaletteModule to your BpmnModeler's additionalModules
 *   2. BpmnEditor renders this internally — no separate wiring needed
 */

import React from 'react'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useBpmnPalette } from '@/hooks/useBpmnPalette'
import type BpmnModeler from 'bpmn-js/lib/Modeler'

// ── Icons ──────────────────────────────────────────────────────────────────

function BpmnIcon({ className }: { className: string }) {
  return <span className={cn('text-[18px] leading-none', className)} />
}

// ── Types ──────────────────────────────────────────────────────────────────

interface PaletteEntry {
  id: string
  title: string
  icon: React.ReactNode
  action: (event: React.MouseEvent) => void
  separator?: never
}

interface PaletteSeparator {
  id: string
  separator: true
  title?: never
  icon?: never
  action?: never
}

type Entry = PaletteEntry | PaletteSeparator

interface BpmnPaletteProps {
  modelerRef: React.RefObject<BpmnModeler | null>
  className?: string
}

// ── Height estimation ──────────────────────────────────────────────────────
// Button: 32px + 2px gap = 34px
// Separator: 17px
// Padding: 24px

const BUTTON_H = 34
const SEPARATOR_H = 17
const PADDING_H = 24

function columnsNeeded(entries: Entry[], availableHeight: number): number {
  const buttonCount = entries.filter((e) => !e.separator).length
  const separatorCount = entries.filter((e) => e.separator).length
  const totalHeight = buttonCount * BUTTON_H + separatorCount * SEPARATOR_H + PADDING_H
  return Math.ceil(totalHeight / Math.max(availableHeight, 1))
}

// ── Component ──────────────────────────────────────────────────────────────

export function BpmnPalette({ modelerRef, className }: BpmnPaletteProps) {
  const palette = useBpmnPalette(modelerRef)
  const [activeTool, setActiveTool] = React.useState<string | null>(null)
  const [columns, setColumns] = React.useState(1)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  function tool(id: string, action: (e: React.MouseEvent) => void) {
    return (e: React.MouseEvent) => {
      setActiveTool(id === activeTool ? null : id)
      action(e)
    }
  }

  const entries: Entry[] = [
    // ── Tools ──────────────────────────────────────────────────────────
    {
      id: 'hand-tool',
      title: 'Hand tool (H)',
      icon: <BpmnIcon className="bpmn-icon-hand-tool" />,
      action: tool('hand-tool', palette.activateHandTool),
    },
    {
      id: 'lasso-tool',
      title: 'Lasso select (L)',
      icon: <BpmnIcon className="bpmn-icon-lasso-tool" />,
      action: tool('lasso-tool', palette.activateLassoTool),
    },
    {
      id: 'space-tool',
      title: 'Space tool (S)',
      icon: <BpmnIcon className="bpmn-icon-space-tool" />,
      action: tool('space-tool', palette.activateSpaceTool),
    },
    {
      id: 'connect-tool',
      title: 'Global connect (C)',
      icon: <BpmnIcon className="bpmn-icon-connection-multi" />,
      action: tool('connect-tool', palette.activateGlobalConnect),
    },
    { id: 'sep-tools', separator: true },
    // ── Events ─────────────────────────────────────────────────────────
    {
      id: 'start-event',
      title: 'Start event',
      icon: <BpmnIcon className="bpmn-icon-start-event-none" />,
      action: palette.createStartEvent,
    },
    {
      id: 'intermediate-event',
      title: 'Intermediate event',
      icon: <BpmnIcon className="bpmn-icon-intermediate-event-none" />,
      action: palette.createIntermediateEvent,
    },
    {
      id: 'end-event',
      title: 'End event',
      icon: <BpmnIcon className="bpmn-icon-end-event-none" />,
      action: palette.createEndEvent,
    },
    { id: 'sep-events', separator: true },
    // ── Gateways ───────────────────────────────────────────────────────
    {
      id: 'exclusive-gateway',
      title: 'Exclusive gateway (XOR)',
      icon: <BpmnIcon className="bpmn-icon-gateway-xor" />,
      action: palette.createExclusiveGateway,
    },
    {
      id: 'parallel-gateway',
      title: 'Parallel gateway (AND)',
      icon: <BpmnIcon className="bpmn-icon-gateway-parallel" />,
      action: palette.createParallelGateway,
    },
    {
      id: 'inclusive-gateway',
      title: 'Inclusive gateway (OR)',
      icon: <BpmnIcon className="bpmn-icon-gateway-or" />,
      action: palette.createInclusiveGateway,
    },
    { id: 'sep-gateways', separator: true },
    // ── Activities ─────────────────────────────────────────────────────
    // Drag a generic task then use the wrench in the context pad to morph
    // it into UserTask, ServiceTask, ScriptTask, etc.
    {
      id: 'task',
      title: 'Task (morph via wrench)',
      icon: <BpmnIcon className="bpmn-icon-task" />,
      action: palette.createTask,
    },
    {
      id: 'subprocess',
      title: 'Sub-process',
      icon: <BpmnIcon className="bpmn-icon-subprocess-expanded" />,
      action: palette.createSubProcess,
    },
    {
      id: 'participant',
      title: 'Pool / Participant',
      icon: <BpmnIcon className="bpmn-icon-participant" />,
      action: palette.createParticipant,
    },
    { id: 'sep-activities', separator: true },
    // ── Artifacts ──────────────────────────────────────────────────────
    {
      id: 'data-object',
      title: 'Data object',
      icon: <BpmnIcon className="bpmn-icon-data-object" />,
      action: palette.createDataObject,
    },
    {
      id: 'data-store',
      title: 'Data store',
      icon: <BpmnIcon className="bpmn-icon-data-store" />,
      action: palette.createDataStore,
    },
    {
      id: 'group',
      title: 'Group',
      icon: <BpmnIcon className="bpmn-icon-group" />,
      action: palette.createGroup,
    },
  ]

  // Watch parent height and reflow columns
  React.useEffect(() => {
    const parent = wrapperRef.current?.parentElement
    if (!parent) return

    const observer = new ResizeObserver(([entry]) => {
      setColumns(columnsNeeded(entries, entry.contentRect.height))
    })

    observer.observe(parent)
    return () => observer.disconnect()
  }, [])

  // In multi-column mode separators don't translate well across a grid
  const visibleEntries = columns === 1
    ? entries
    : entries.filter((e) => !e.separator)

  const tooltipSide = columns === 1 ? 'right' : 'bottom'

  return (
    <TooltipProvider delayDuration={400}>
      <div
        ref={wrapperRef}
        className={cn(
          'absolute left-4 top-4 z-10',
          'rounded-md border p-1.5',
          'bg-background/90 backdrop-blur-sm',
          'border-border shadow-md',
          className
        )}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${columns}, 2rem)`,
          gap: '2px',
          alignContent: 'start',
        }}
      >
        {visibleEntries.map((entry) => {
          if (entry.separator) {
            return (
              <Separator
                key={entry.id}
                className="col-span-full my-1 w-6 justify-self-center"
              />
            )
          }

          const isActive = activeTool === entry.id

          return (
            <Tooltip key={entry.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onMouseDown={entry.action}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded',
                    'text-muted-foreground transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    isActive && 'bg-accent text-accent-foreground'
                  )}
                >
                  {entry.icon}
                </button>
              </TooltipTrigger>
              <TooltipContent side={tooltipSide} className="text-xs">
                {entry.title}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}