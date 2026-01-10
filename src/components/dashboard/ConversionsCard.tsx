import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, Clock, Award } from "lucide-react";
import { ConversionMetric } from "@/hooks/useRealEstateDashboard";
import { cn } from "@/lib/utils";

interface ConversionsCardProps {
  conversions: ConversionMetric;
  isLoading?: boolean;
}

export function ConversionsCard({ conversions, isLoading }: ConversionsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-md bg-emerald-500/10">
            <Target className="h-4 w-4 text-emerald-500" />
          </div>
          <CardTitle className="text-sm font-semibold">Conversiones</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <div className="flex items-center justify-center gap-1">
              <Award className="h-4 w-4 text-emerald-500" />
              <span className="text-2xl font-bold text-emerald-500">
                {conversions.convertedThisPeriod}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">En el período</p>
          </div>
          
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-2xl font-bold text-foreground">
                {Math.round(conversions.conversionRate)}%
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Tasa total</p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Días promedio
            </span>
            <Badge variant="outline" className={cn(
              conversions.avgDaysToConversion <= 14 
                ? "border-emerald-500/30 text-emerald-500" 
                : conversions.avgDaysToConversion <= 30 
                  ? "border-amber-500/30 text-amber-500"
                  : "border-destructive/30 text-destructive"
            )}>
              {conversions.avgDaysToConversion} días
            </Badge>
          </div>
          
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total histórico</span>
            <span className="font-medium">{conversions.totalConverted}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
