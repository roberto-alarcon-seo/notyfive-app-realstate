import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface MetricCardProps {
  title: string;
  value: string | number;
  previousValue?: number;
  currentValue?: number;
  subtitle?: string;
  icon?: ReactNode;
  iconBg?: string;
  loading?: boolean;
  compact?: boolean;
  tooltip?: string;
}

export function MetricCard({
  title,
  value,
  previousValue,
  currentValue,
  subtitle,
  icon,
  iconBg = "bg-primary/10 text-primary",
  loading,
  compact,
  tooltip,
}: MetricCardProps) {
  const variation =
    previousValue !== undefined && currentValue !== undefined && previousValue > 0
      ? ((currentValue - previousValue) / previousValue) * 100
      : null;

  const getVariationColor = () => {
    if (variation === null) return "text-muted-foreground";
    return variation > 0 ? "text-emerald-500" : variation < 0 ? "text-destructive" : "text-muted-foreground";
  };

  const getVariationIcon = () => {
    if (variation === null) return null;
    if (variation > 0) return <TrendingUp className="w-3 h-3" />;
    if (variation < 0) return <TrendingDown className="w-3 h-3" />;
    return <Minus className="w-3 h-3" />;
  };

  if (loading) {
    return (
      <div className={cn(
        "rounded-xl border bg-card p-4 transition-all hover:shadow-md",
        compact && "p-3"
      )}>
        <div className="animate-pulse space-y-2">
          <div className="h-3 bg-muted rounded w-20" />
          <div className="h-7 bg-muted rounded w-14" />
        </div>
      </div>
    );
  }

  const content = (
    <div className={cn(
      "rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/20",
      compact && "p-3"
    )}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-muted-foreground font-medium truncate",
            compact ? "text-xs" : "text-sm"
          )}>
            {title}
          </p>
          <p className={cn(
            "font-bold text-foreground mt-1",
            compact ? "text-xl" : "text-2xl"
          )}>
            {value}
          </p>
          
          {variation !== null && (
            <div className={cn("flex items-center gap-1 mt-1", getVariationColor())}>
              {getVariationIcon()}
              <span className="text-xs">
                {variation > 0 ? "+" : ""}{Math.round(variation)}%
              </span>
            </div>
          )}
          
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
          )}
        </div>
        
        {icon && (
          <div className={cn("p-2 rounded-lg shrink-0", iconBg)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );

  if (tooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-sm">{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}

interface QuickStatProps {
  label: string;
  value: string | number;
  color?: "default" | "success" | "warning" | "danger";
}

export function QuickStat({ label, value, color = "default" }: QuickStatProps) {
  const colorClasses = {
    default: "text-foreground",
    success: "text-emerald-500",
    warning: "text-amber-500",
    danger: "text-destructive",
  };

  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={cn("font-semibold", colorClasses[color])}>{value}</span>
    </div>
  );
}
