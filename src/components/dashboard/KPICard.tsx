import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

interface KPICardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  unit?: string;
  tooltip?: string;
  icon?: ReactNode;
  ctaLabel?: string;
  ctaAction?: () => void;
  status?: "positive" | "neutral" | "negative";
  loading?: boolean;
}

export function KPICard({
  title,
  value,
  previousValue,
  currentValue,
  unit = "",
  tooltip,
  icon,
  ctaLabel,
  ctaAction,
  status,
  loading,
}: KPICardProps) {
  // Calculate variation
  const variation =
    previousValue !== undefined && currentValue !== undefined && previousValue > 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : null;

  const getVariationColor = () => {
    if (variation === null) return "text-muted-foreground";
    if (status === "negative") {
      return variation > 0 ? "text-destructive" : "text-emerald-500";
    }
    return variation > 0 ? "text-emerald-500" : variation < 0 ? "text-destructive" : "text-muted-foreground";
  };

  const getVariationIcon = () => {
    if (variation === null) return null;
    if (variation > 0) return <TrendingUp className="w-4 h-4" />;
    if (variation < 0) return <TrendingDown className="w-4 h-4" />;
    return <Minus className="w-4 h-4" />;
  };

  const getStatusColor = () => {
    switch (status) {
      case "positive":
        return "border-l-emerald-500";
      case "negative":
        return "border-l-destructive";
      default:
        return "border-l-primary";
    }
  };

  if (loading) {
    return (
      <Card className={cn("border-l-4", getStatusColor())}>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-muted rounded w-24" />
            <div className="h-8 bg-muted rounded w-16" />
            <div className="h-3 bg-muted rounded w-20" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("border-l-4 transition-all hover:shadow-md", getStatusColor())}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-medium text-muted-foreground">{title}</span>
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-3.5 h-3.5 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <p className="text-sm">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold text-foreground">{value}</span>
              {unit && <span className="text-lg text-muted-foreground">{unit}</span>}
            </div>

            {variation !== null && (
              <div className={cn("flex items-center gap-1 mt-2 text-sm", getVariationColor())}>
                {getVariationIcon()}
                <span>
                  {variation > 0 ? "+" : ""}
                  {Math.round(variation)}% vs mes anterior
                </span>
              </div>
            )}

            {ctaLabel && ctaAction && (
              <Button
                variant="link"
                size="sm"
                onClick={ctaAction}
                className="mt-2 p-0 h-auto text-primary"
              >
                {ctaLabel} →
              </Button>
            )}
          </div>

          {icon && (
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
