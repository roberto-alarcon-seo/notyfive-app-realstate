import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

interface ActivityChartProps {
  dailyTrends: DailyTrendMetric[];
  isLoading?: boolean;
}

export function ActivityChart({ dailyTrends, isLoading }: ActivityChartProps) {
  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Transform data for the chart - showing AI Messages, New Leads, and Followups (conversions as proxy)
  const chartData = dailyTrends.map(d => ({
    label: d.label,
    mensajesIA: d.messages,
    nuevosLeads: d.newLeads,
    seguimientos: d.conversions + d.visits, // Combined activity
  }));

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Actividad de los Últimos {dailyTrends.length} Días
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart 
              data={chartData} 
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorMensajes" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSeguimientos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="hsl(var(--border))" 
                vertical={false}
                opacity={0.5}
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
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="mensajesIA"
                name="Mensajes IA"
                stroke="hsl(var(--chart-1))"
                strokeWidth={2}
                fill="url(#colorMensajes)"
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--chart-1))' }}
              />
              <Area
                type="monotone"
                dataKey="nuevosLeads"
                name="Nuevos Leads"
                stroke="hsl(var(--chart-2))"
                strokeWidth={2}
                fill="url(#colorLeads)"
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--chart-2))' }}
              />
              <Area
                type="monotone"
                dataKey="seguimientos"
                name="Seguimientos"
                stroke="hsl(var(--chart-3))"
                strokeWidth={2}
                fill="url(#colorSeguimientos)"
                dot={false}
                activeDot={{ r: 4, fill: 'hsl(var(--chart-3))' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
