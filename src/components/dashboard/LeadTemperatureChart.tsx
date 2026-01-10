import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { TrendingUp } from "lucide-react";

interface LeadTemperatureChartProps {
  hot: number;
  warm: number;
  cold: number;
  total: number;
  isLoading?: boolean;
}

export function LeadTemperatureChart({ hot, warm, cold, total, isLoading }: LeadTemperatureChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    );
  }

  // Calculate unclassified leads
  const classified = hot + warm + cold;
  const unclassified = Math.max(0, total - classified);

  const data = [
    { name: 'Caliente', value: hot, color: 'hsl(0, 84%, 60%)' },
    { name: 'Tibio', value: warm, color: 'hsl(45, 93%, 47%)' },
    { name: 'Frío', value: cold, color: 'hsl(207, 90%, 54%)' },
    { name: 'Sin Clasificar', value: unclassified, color: 'hsl(var(--muted-foreground))' },
  ].filter(d => d.value > 0);

  const totalLeads = data.reduce((sum, d) => sum + d.value, 0);

  const CustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    if (percent < 0.05) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor="middle" 
        dominantBaseline="central"
        style={{ fontSize: '11px', fontWeight: 600 }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Temperatura de Leads
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Distribución por nivel de interés
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={CustomLabel}
                outerRadius={85}
                innerRadius={40}
                dataKey="value"
                stroke="hsl(var(--background))"
                strokeWidth={2}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                formatter={(value: number, name: string) => [
                  `${value} leads (${totalLeads > 0 ? ((value / totalLeads) * 100).toFixed(1) : 0}%)`,
                  name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          {data.map((item) => (
            <div 
              key={item.name} 
              className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-sm text-muted-foreground">{item.name}</span>
              </div>
              <span className="text-sm font-semibold text-foreground">{item.value}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
