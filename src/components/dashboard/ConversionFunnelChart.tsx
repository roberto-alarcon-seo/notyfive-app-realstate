import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Target } from "lucide-react";
import { PipelineMetric } from "@/hooks/useRealEstateDashboard";

interface ConversionFunnelChartProps {
  pipeline: PipelineMetric[];
  pipelineTotal: number;
  isLoading?: boolean;
}

// Explicit hex colors for SVG compatibility
const STAGE_COLORS = [
  '#8b5cf6', // Purple - Nuevo Lead
  '#06b6d4', // Cyan - Interés Confirmado
  '#f59e0b', // Amber - Validación Financiera
  '#ec4899', // Pink - Búsqueda Activa
  '#3b82f6', // Blue - Visita Realizada
  '#a855f7', // Violet - Seguimiento
  '#10b981', // Emerald - Negociación
  '#22c55e', // Green - Ganado
  '#ef4444', // Red - Perdido
];

export function ConversionFunnelChart({ pipeline, pipelineTotal, isLoading }: ConversionFunnelChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Filter out stages with 0 count for cleaner display, but keep sold/lost
  const activeStages = pipeline.filter(p => 
    p.count > 0 || p.stage === 'closed_won' || p.stage === 'closed_lost'
  );

  const inProcessCount = pipeline
    .filter(p => !['closed_won', 'closed_lost'].includes(p.stage))
    .reduce((sum, p) => sum + p.count, 0);
  
  const soldCount = pipeline.find(p => p.stage === 'closed_won')?.count || 0;
  const conversionRate = inProcessCount > 0 ? ((soldCount / (inProcessCount + soldCount)) * 100).toFixed(1) : 0;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Embudo de Conversión
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Pipeline completo de leads por etapa
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={activeStages}
              margin={{ top: 5, right: 10, left: -20, bottom: 40 }}
            >
              <XAxis 
                dataKey="label" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
                angle={-35}
                textAnchor="end"
                interval={0}
                height={60}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
              />
              <YAxis 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                itemStyle={{ color: 'hsl(var(--foreground))' }}
                formatter={(value: number) => [`${value} leads`, 'Cantidad']}
              />
              <Bar 
                dataKey="count" 
                radius={[4, 4, 0, 0]}
              >
                {activeStages.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={STAGE_COLORS[index % STAGE_COLORS.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">En Proceso</p>
            <p className="text-xl font-bold text-foreground">{inProcessCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Vendidos</p>
            <p className="text-xl font-bold text-emerald-400">{soldCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Tasa</p>
            <p className="text-xl font-bold text-primary">{conversionRate}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
