import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, subDays, startOfMonth, startOfYear, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon, ChevronDown } from "lucide-react";
import { DateRange } from "react-day-picker";

export type DateRangePreset = {
  label: string;
  value: string;
  range: () => DateRange;
};

const presets: DateRangePreset[] = [
  {
    label: "Últimos 7 días",
    value: "7d",
    range: () => ({ from: subDays(new Date(), 7), to: new Date() }),
  },
  {
    label: "Últimos 14 días",
    value: "14d",
    range: () => ({ from: subDays(new Date(), 14), to: new Date() }),
  },
  {
    label: "Últimos 30 días",
    value: "30d",
    range: () => ({ from: subDays(new Date(), 30), to: new Date() }),
  },
  {
    label: "Últimos 90 días",
    value: "90d",
    range: () => ({ from: subDays(new Date(), 90), to: new Date() }),
  },
  {
    label: "Este mes",
    value: "this_month",
    range: () => ({ from: startOfMonth(new Date()), to: new Date() }),
  },
  {
    label: "Mes anterior",
    value: "last_month",
    range: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: subDays(startOfMonth(new Date()), 1) }),
  },
  {
    label: "Este año",
    value: "this_year",
    range: () => ({ from: startOfYear(new Date()), to: new Date() }),
  },
];

interface DateRangePickerProps {
  dateRange: DateRange | undefined;
  onDateRangeChange: (range: DateRange | undefined) => void;
  className?: string;
}

export function DateRangePicker({ dateRange, onDateRangeChange, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<string>("30d");

  const handlePresetClick = useCallback((preset: DateRangePreset) => {
    setSelectedPreset(preset.value);
    onDateRangeChange(preset.range());
    setOpen(false);
  }, [onDateRangeChange]);

  const handleRangeSelect = useCallback((range: DateRange | undefined) => {
    onDateRangeChange(range);
    if (range?.from && range?.to) {
      setSelectedPreset("custom");
    }
  }, [onDateRangeChange]);

  const displayLabel = useCallback(() => {
    if (!dateRange?.from) return "Seleccionar fechas";
    
    const preset = presets.find(p => p.value === selectedPreset);
    if (preset && selectedPreset !== "custom") return preset.label;
    
    if (dateRange.to) {
      return `${format(dateRange.from, "dd MMM", { locale: es })} - ${format(dateRange.to, "dd MMM yyyy", { locale: es })}`;
    }
    return format(dateRange.from, "dd MMM yyyy", { locale: es });
  }, [dateRange, selectedPreset]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "h-9 justify-between text-left font-normal gap-2",
            !dateRange && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className="hidden sm:inline">{displayLabel()}</span>
          <span className="sm:hidden">{dateRange?.from ? format(dateRange.from, "dd/MM") : "Fechas"}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r p-2 space-y-0.5 bg-muted/30 min-w-[120px]">
            {presets.map((preset) => (
              <Button
                key={preset.value}
                variant={selectedPreset === preset.value ? "secondary" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs h-7 px-2"
                onClick={() => handlePresetClick(preset)}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          
          {/* Calendar */}
          <div className="p-3">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleRangeSelect}
              numberOfMonths={2}
              locale={es}
              className="pointer-events-auto"
              disabled={(date) => date > new Date()}
            />
            <div className="flex items-center justify-between border-t pt-3 mt-2">
              <p className="text-xs text-muted-foreground">
                {dateRange?.from && dateRange?.to && (
                  <>
                    {Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24))} días seleccionados
                  </>
                )}
              </p>
              <Button size="sm" onClick={() => setOpen(false)}>
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
