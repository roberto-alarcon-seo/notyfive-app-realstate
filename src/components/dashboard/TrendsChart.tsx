import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend
} from "recharts";
import { DailyTrendMetric } from "@/hooks/useRealEstateDashboard";

interface TrendsChartProps {
  dailyTrends: DailyTrendMetric[];
  isLoading?: boolean;
}

type MetricKey = 'newLeads' | 'conversions' | 'visits' | 'messages';

const METRICS: { key: MetricKey; label: string; color: string }[] = [
  { key: 'newLeads', label: 'Leads', color: 'hsl(var(--chart-1))' },
  { key: 'conversions', label: 'Conversiones', color: 'hsl(var(--chart-2))' },
  { key: 'visits', label: 'Visitas', color: 'hsl(var(--chart-3))' },
  { key: 'messages', label: 'Mensajes', color: 'hsl(var(--chart-4))' },
];

export function TrendsChart({ dailyTrends, isLoading }: TrendsChartProps) {
  const [activeMetric, setActiveMetric] = useState<MetricKey>('newLeads');

  if (isLoading) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const currentMetric = METRICS.find(m => m.key === activeMetric)!;

  // Calculate totals for the period
  const total = dailyTrends.reduce((sum, d) => sum + d[activeMetric], 0);

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">
              Tendencia de Actividad
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              ({dailyTrends.length} días)
            </span>
          </div>
          <Tabs value={activeMetric} onValueChange={(v) => setActiveMetric(v as MetricKey)}>
            <TabsList className="h-8">
              {METRICS.map(metric => (
                <TabsTrigger 
                  key={metric.key} 
                  value={metric.key}
                  className="text-xs px-2.5"
                >
                  {metric.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <p className="text-xs text-muted-foreground">
          Total en período: <span className="font-medium text-foreground">{total}</span> {currentMetric.label.toLowerCase()}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={dailyTrends} 
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentMetric.color} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={currentMetric.color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
              />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={30}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 500 }}
              />
              <Area
                type="monotone"
                dataKey={activeMetric}
                name={currentMetric.label}
                stroke={currentMetric.color}
                strokeWidth={2}
                fill="url(#colorGradient)"
                dot={false}
                activeDot={{ r: 4, fill: currentMetric.color }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
