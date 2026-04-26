import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, MapPin } from "lucide-react";
import { PropertyMetric } from "@/hooks/useRealEstateDashboard";

interface PropertiesOverviewCardProps {
  properties: PropertyMetric;
  isLoading?: boolean;
}

export function PropertiesOverviewCard({ properties, isLoading }: PropertiesOverviewCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const formatPrice = (price: number) => {
    if (price >= 1000000) {
      return `$${(price / 1000000).toFixed(1)}M`;
    }
    return `$${(price / 1000).toFixed(0)}K`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold">Propiedades</CardTitle>
          </div>
          <Badge variant="outline" className="text-[10px] font-normal">
            Sincronizado desde Core
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Status Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <p className="text-xl font-bold text-emerald-500">{properties.totalAvailable}</p>
            <p className="text-xs text-muted-foreground">Disponibles</p>
          </div>
          <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/10">
            <p className="text-xl font-bold text-amber-500">{properties.totalReserved}</p>
            <p className="text-xs text-muted-foreground">Reservadas</p>
          </div>
          <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <p className="text-xl font-bold text-blue-500">{properties.propertiesWithInterest}</p>
            <p className="text-xs text-muted-foreground">Con interés</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/50">
            <p className="text-xl font-bold text-muted-foreground">{properties.totalSold}</p>
            <p className="text-xs text-muted-foreground">Vendidas</p>
          </div>
        </div>

        {/* Price & Zones */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Precio promedio</span>
            <Badge variant="secondary">{formatPrice(properties.avgPrice)}</Badge>
          </div>
          
          {properties.topZones.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
              {properties.topZones.slice(0, 3).map(zone => (
                <Badge key={zone.zone} variant="outline" className="text-xs">
                  {zone.zone} ({zone.count})
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
