import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Building2 } from "lucide-react";

interface PropertyInterest {
  id: string;
  title: string;
  zone: string;
  interestedCount: number;
}

interface TopPropertiesCardProps {
  properties: PropertyInterest[];
  maxInterest: number;
  isLoading?: boolean;
}

export function TopPropertiesCard({ properties, maxInterest, isLoading }: TopPropertiesCardProps) {
  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (properties.length === 0) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Top 10 Propiedades por Interés</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Building2 className="h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Aún no hay propiedades con leads interesados
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Top 10 Propiedades por Interés</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {properties.slice(0, 10).map((property, index) => {
          const percentage = maxInterest > 0 ? (property.interestedCount / maxInterest) * 100 : 0;
          
          return (
            <div
              key={property.id}
              className="group"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-muted-foreground w-5">{index + 1}</span>
                <Building2 className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {property.title.toUpperCase()}
                  </p>
                </div>
                <span className="text-sm font-bold text-primary shrink-0">
                  {property.interestedCount} leads
                </span>
              </div>
              <div className="mt-1.5 ml-8">
                <Progress 
                  value={percentage} 
                  className="h-1.5" 
                />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
