import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  MODEL_VALUES,
  type Model,
  useModelEngine,
} from "@/components/model-engine-provider"

export function ModelSelector() {
  const { model, setModel } = useModelEngine()

  return (
    <Select  value={model} onValueChange={(v) => setModel(v as Model)}>
      <SelectTrigger className="border-0">
        <SelectValue placeholder="Select a model" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Models</SelectLabel>
          {MODEL_VALUES.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}
