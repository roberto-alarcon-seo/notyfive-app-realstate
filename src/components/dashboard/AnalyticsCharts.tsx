import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";

interface DailyMetric {
  date: string;
  label: string;
  conversations: number;
  messagesSent: number;
  responses: number;
  delivered: number;
}

interface AnalyticsChartsProps {
  dailyMetrics: DailyMetric[];
  isLoading?: boolean;
}

const COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--chart-2))",
  tertiary: "hsl(var(--chart-3))",
  success: "#22c55e",
  warning: "#f59e0b",
};

export function ConversationsChart({ dailyMetrics, isLoading }: AnalyticsChartsProps) {
  const [metric, setMetric] = useState<"conversations" | "responses" | "messagesSent">("conversations");

  if (isLoading) {
    return (
      <Card className="col-span-2">
        <CardHeader>
          <CardTitle>Tendencia de Actividad</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const metricLabels = {
    conversations: "Conversaciones",
    responses: "Respuestas recibidas",
    messagesSent: "Mensajes enviados",
  };

  return (
    <Card className="col-span-2">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold">Tendencia de Actividad (30 días)</CardTitle>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
          <TabsList className="h-8">
            <TabsTrigger value="conversations" className="text-xs px-3 h-7">
              Conversaciones
            </TabsTrigger>
            <TabsTrigger value="responses" className="text-xs px-3 h-7">
              Respuestas
            </TabsTrigger>
            <TabsTrigger value="messagesSent" className="text-xs px-3 h-7">
              Enviados
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyMetrics}>
              <defs>
                <linearGradient id="colorMetric" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <YAxis 
                tick={{ fontSize: 11 }} 
                tickLine={false}
                axisLine={false}
                className="text-muted-foreground"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 600 }}
                itemStyle={{ color: "hsl(var(--muted-foreground))" }}
              />
              <Area
                type="monotone"
                dataKey={metric}
                name={metricLabels[metric]}
                stroke={COLORS.primary}
                strokeWidth={2}
                fill="url(#colorMetric)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface DeliveryFunnelProps {
  sent: number;
  delivered: number;
  responses: number;
  isLoading?: boolean;
}

export function DeliveryFunnel({ sent, delivered, responses, isLoading }: DeliveryFunnelProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funnel de Entrega</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px] animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const data = [
    { name: "Enviados", value: sent, fill: COLORS.primary },
    { name: "Entregados", value: delivered, fill: COLORS.success },
    { name: "Respuestas", value: responses, fill: COLORS.warning },
  ];

  const deliveryRate = sent > 0 ? Math.round((delivered / sent) * 100) : 0;
  const responseRate = delivered > 0 ? Math.round((responses / delivered) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Funnel de Entrega</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fontSize: 11 }} 
                axisLine={false} 
                tickLine={false}
                width={80}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t">
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-500">{deliveryRate}%</p>
            <p className="text-xs text-muted-foreground">Tasa de entrega</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-500">{responseRate}%</p>
            <p className="text-xs text-muted-foreground">Tasa de respuesta</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AIvsHumanChartProps {
  aiCount: number;
  humanCount: number;
  isLoading?: boolean;
}

export function AIvsHumanChart({ aiCount, humanCount, isLoading }: AIvsHumanChartProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">IA vs Humano</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[200px] animate-pulse bg-muted rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const total = aiCount + humanCount;
  const data = [
    { name: "IA", value: aiCount, fill: COLORS.primary },
    { name: "Humano", value: humanCount, fill: COLORS.secondary },
  ];

  const aiPercentage = total > 0 ? Math.round((aiCount / total) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Respuestas IA vs Humano</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="h-[200px] flex items-center justify-center text-muted-foreground">
            Sin datos este mes
          </div>
        ) : (
          <>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-6 mt-2">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.primary }} />
                <span className="text-sm">IA ({aiPercentage}%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.secondary }} />
                <span className="text-sm">Humano ({100 - aiPercentage}%)</span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
