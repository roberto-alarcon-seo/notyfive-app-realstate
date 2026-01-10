import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowUpRight, Flame, Thermometer, Snowflake, CreditCard, DollarSign, Ghost } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { LeadQualityMetric } from "@/hooks/useRealEstateDashboard";
import { cn } from "@/lib/utils";

interface LeadQualityCardProps {
  leadQuality: LeadQualityMetric;
  isLoading?: boolean;
}

export function LeadQualityCard({ leadQuality, isLoading }: LeadQualityCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-36 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`;
    }
    return `$${(value / 1000).toFixed(0)}K`;
  };

  const qualificationRate = leadQuality.totalLeads > 0
    ? Math.round((leadQuality.qualifiedCount / leadQuality.totalLeads) * 100)
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-sm font-semibold">Calidad de Leads</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => navigate("/contacts")}
          >
            Ver <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Temperature Breakdown */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-destructive/5">
            <Flame className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-lg font-bold text-destructive">{leadQuality.temperatureBreakdown.hot}</p>
              <p className="text-[10px] text-muted-foreground">Calientes</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-amber-500/5">
            <Thermometer className="h-4 w-4 text-amber-500" />
            <div>
              <p className="text-lg font-bold text-amber-500">{leadQuality.temperatureBreakdown.warm}</p>
              <p className="text-[10px] text-muted-foreground">Tibios</p>
            </div>
          </div>
          <div className="flex-1 flex items-center gap-2 p-2 rounded-lg bg-blue-500/5">
            <Snowflake className="h-4 w-4 text-blue-500" />
            <div>
              <p className="text-lg font-bold text-blue-500">{leadQuality.temperatureBreakdown.cold}</p>
              <p className="text-[10px] text-muted-foreground">Fríos</p>
            </div>
          </div>
        </div>

        {/* Qualification Stats */}
        <div className="space-y-2 pt-2 border-t">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Con crédito
            </span>
            <Badge variant="outline" className="border-emerald-500/30 text-emerald-500">
              {leadQuality.withCredit}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" />
              Budget promedio
            </span>
            <span className="font-medium">{formatCurrency(leadQuality.avgBudget)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Ghost className="h-3.5 w-3.5" />
              Ghosting
            </span>
            <Badge variant="outline" className={cn(
              leadQuality.ghostingCount > 10 
                ? "border-destructive/30 text-destructive" 
                : "border-muted"
            )}>
              {leadQuality.ghostingCount}
            </Badge>
          </div>
        </div>

        {/* Qualification Rate */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Tasa de calificación</span>
            <span className="text-xs font-medium">{qualificationRate}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all"
              style={{ width: `${qualificationRate}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {leadQuality.qualifiedCount} de {leadQuality.totalLeads} leads calificados
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
