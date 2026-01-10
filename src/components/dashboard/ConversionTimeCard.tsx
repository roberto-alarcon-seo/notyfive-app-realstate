import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, TrendingUp, Target, Award } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface ConversionTimeCardProps {
  avgDaysToConversion: number;
  totalConverted: number;
  conversionRate: number;
  convertedThisPeriod: number;
  isLoading?: boolean;
}

export function ConversionTimeCard({ 
  avgDaysToConversion, 
  totalConverted, 
  conversionRate, 
  convertedThisPeriod,
  isLoading 
}: ConversionTimeCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Benchmark: Real estate typically takes 30-90 days
  const benchmarkDays = 60;
  const performanceVsBenchmark = avgDaysToConversion > 0 
    ? ((benchmarkDays / avgDaysToConversion) * 100).toFixed(0)
    : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Métricas de Conversión
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tiempo promedio - destacado */}
        <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">
                Tiempo promedio de conversión
              </p>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-bold text-primary">
                  {avgDaysToConversion || '—'}
                </span>
                <span className="text-lg text-muted-foreground">días</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Clock className="w-8 h-8 text-primary" />
            </div>
          </div>
          {avgDaysToConversion > 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              {Number(performanceVsBenchmark) >= 100 
                ? `🚀 ${performanceVsBenchmark}% más rápido que el benchmark (${benchmarkDays} días)`
                : `Benchmark industria: ${benchmarkDays} días`
              }
            </p>
          )}
        </div>

        {/* Grid de métricas secundarias */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Target className="w-4 h-4 mx-auto text-emerald-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{totalConverted}</p>
            <p className="text-xs text-muted-foreground">Total convertidos</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <TrendingUp className="w-4 h-4 mx-auto text-amber-400 mb-1" />
            <p className="text-2xl font-bold text-foreground">{conversionRate.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Tasa conversión</p>
          </div>
          <div className="bg-muted/30 rounded-lg p-3 text-center">
            <Award className="w-4 h-4 mx-auto text-primary mb-1" />
            <p className="text-2xl font-bold text-foreground">{convertedThisPeriod}</p>
            <p className="text-xs text-muted-foreground">Este periodo</p>
          </div>
        </div>

        {/* Progress hacia meta */}
        {convertedThisPeriod > 0 && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso del periodo</span>
              <span>{convertedThisPeriod} conversiones</span>
            </div>
            <Progress 
              value={Math.min((convertedThisPeriod / Math.max(totalConverted, 1)) * 100, 100)} 
              className="h-2"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
