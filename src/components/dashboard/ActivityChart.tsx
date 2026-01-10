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

// Define colors explicitly for SVG compatibility
const CHART_COLORS = {
  mensajes: '#8b5cf6',    // Purple
  leads: '#22c55e',       // Green
  seguimientos: '#f59e0b', // Amber
};

export function ActivityChart({ dailyTrends, isLoading }: ActivityChartProps) {
  if (isLoading) {
    return (
      <Card className="col-span-1 bg-card border-border">
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
    <Card className="col-span-1 bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold text-foreground">
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
                  <stop offset="5%" stopColor={CHART_COLORS.mensajes} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={CHART_COLORS.mensajes} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.leads} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={CHART_COLORS.leads} stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorSeguimientos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_COLORS.seguimientos} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={CHART_COLORS.seguimientos} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(255,255,255,0.1)" 
                vertical={false}
              />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis 
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                tickLine={false}
                axisLine={false}
                width={30}
                allowDecimals={false}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                labelStyle={{ color: '#f9fafb', fontWeight: 600 }}
                itemStyle={{ color: '#e5e7eb' }}
              />
              <Legend 
                wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => <span style={{ color: '#e5e7eb' }}>{value}</span>}
              />
              <Area
                type="monotone"
                dataKey="mensajesIA"
                name="Mensajes IA"
                stroke={CHART_COLORS.mensajes}
                strokeWidth={2}
                fill="url(#colorMensajes)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.mensajes }}
              />
              <Area
                type="monotone"
                dataKey="nuevosLeads"
                name="Nuevos Leads"
                stroke={CHART_COLORS.leads}
                strokeWidth={2}
                fill="url(#colorLeads)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.leads }}
              />
              <Area
                type="monotone"
                dataKey="seguimientos"
                name="Seguimientos"
                stroke={CHART_COLORS.seguimientos}
                strokeWidth={2}
                fill="url(#colorSeguimientos)"
                dot={false}
                activeDot={{ r: 4, fill: CHART_COLORS.seguimientos }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
