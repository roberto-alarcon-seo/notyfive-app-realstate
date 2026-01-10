import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, Tooltip, LabelList } from "recharts";
import { Building } from "lucide-react";
import { PropertyMetric } from "@/hooks/useRealEstateDashboard";

interface PropertyStatusChartProps {
  properties: PropertyMetric;
  isLoading?: boolean;
}

export function PropertyStatusChart({ properties, isLoading }: PropertyStatusChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const data = [
    { 
      name: 'Disponibles', 
      value: properties.totalAvailable, 
      color: 'hsl(142, 76%, 36%)',
      icon: '✓'
    },
    { 
      name: 'Reservadas', 
      value: properties.totalReserved, 
      color: 'hsl(45, 93%, 47%)',
      icon: '⏳'
    },
    { 
      name: 'Vendidas', 
      value: properties.totalSold, 
      color: 'hsl(var(--primary))',
      icon: '🎉'
    },
    { 
      name: 'Con Interés', 
      value: properties.propertiesWithInterest, 
      color: 'hsl(207, 90%, 54%)',
      icon: '👀'
    },
  ];

  const totalProperties = properties.totalActive;
  const avgPriceFormatted = properties.avgPrice > 0 
    ? `$${(properties.avgPrice / 1000000).toFixed(2)}M`
    : '—';

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Building className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg font-semibold text-foreground">
            Propiedades por Estatus
          </CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">
          Inventario actual: {totalProperties} propiedades activas
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-[180px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 40, left: 0, bottom: 5 }}
            >
              <XAxis 
                type="number" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                axisLine={{ stroke: 'hsl(var(--border))' }}
                tickLine={false}
                allowDecimals={false}
              />
              <YAxis 
                type="category" 
                dataKey="name" 
                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                axisLine={false}
                tickLine={false}
                width={90}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--popover))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                formatter={(value: number, name: string) => [
                  `${value} propiedades`,
                  ''
                ]}
              />
              <Bar 
                dataKey="value" 
                radius={[0, 4, 4, 0]}
                barSize={24}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
                <LabelList 
                  dataKey="value" 
                  position="right" 
                  fill="hsl(var(--foreground))"
                  fontSize={12}
                  fontWeight={600}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Zones & Avg Price */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Top Zonas</p>
            <div className="space-y-1">
              {properties.topZones.slice(0, 3).map((zone, idx) => (
                <div key={zone.zone} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground truncate max-w-[100px]">
                    {idx + 1}. {zone.zone}
                  </span>
                  <span className="font-medium text-foreground">{zone.count}</span>
                </div>
              ))}
              {properties.topZones.length === 0 && (
                <span className="text-xs text-muted-foreground">Sin datos</span>
              )}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-2">Precio Promedio</p>
            <p className="text-2xl font-bold text-primary">{avgPriceFormatted}</p>
            <p className="text-xs text-muted-foreground">MXN</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
