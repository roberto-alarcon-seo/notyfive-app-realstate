import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { DateRange } from "@/hooks/useMetaAdsInsights";

const PRESETS = [
  { label: "Hoy", value: "today" as const },
  { label: "7 días", value: "last_7d" as const },
  { label: "30 días", value: "last_30d" as const },
] satisfies Array<{ label: string; value: NonNullable<DateRange["preset"]> }>;

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const isCustom = !!(value.start && value.end);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => {
        const selected = !isCustom && (value.preset ?? "last_7d") === p.value;
        return (
          <Button
            key={p.value}
            type="button"
            size="sm"
            variant={selected ? "default" : "outline"}
            className={cn("rounded-full h-8 px-3 text-xs")}
            onClick={() =>
              onChange({ preset: p.value, start: undefined, end: undefined })
            }
          >
            {p.label}
          </Button>
        );
      })}
      <Button
        type="button"
        size="sm"
        variant={isCustom ? "default" : "outline"}
        className="rounded-full h-8 px-3 text-xs"
        onClick={() => {
          if (!isCustom) {
            const today = new Date().toISOString().slice(0, 10);
            const weekAgo = new Date(Date.now() - 6 * 86400000)
              .toISOString()
              .slice(0, 10);
            onChange({ start: weekAgo, end: today, preset: undefined });
          }
        }}
      >
        Personalizado
      </Button>
      {isCustom && (
        <div className="flex items-center gap-1">
          <Input
            type="date"
            value={value.start ?? ""}
            onChange={(e) =>
              onChange({ ...value, start: e.target.value, preset: undefined })
            }
            className="h-8 text-xs w-[140px]"
          />
          <span className="text-xs text-muted-foreground">→</span>
          <Input
            type="date"
            value={value.end ?? ""}
            onChange={(e) =>
              onChange({ ...value, end: e.target.value, preset: undefined })
            }
            className="h-8 text-xs w-[140px]"
          />
        </div>
      )}
    </div>
  );
}