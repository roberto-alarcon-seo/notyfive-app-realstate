import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, ArrowUpRight, UserCheck, UserX, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { EventMetric } from "@/hooks/useRealEstateDashboard";
import { cn } from "@/lib/utils";

interface EventsCardProps {
  events: EventMetric;
  isLoading?: boolean;
}

export function EventsCard({ events, isLoading }: EventsCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-28 w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasTodayEvents = events.todayEvents > 0;

  return (
    <Card className={cn(
      hasTodayEvents && "ring-1 ring-primary/20"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-md",
              hasTodayEvents ? "bg-primary/10" : "bg-blue-500/10"
            )}>
              <Calendar className={cn(
                "h-4 w-4",
                hasTodayEvents ? "text-primary" : "text-blue-500"
              )} />
            </div>
            <CardTitle className="text-sm font-semibold">Visitas y Eventos</CardTitle>
            {hasTodayEvents && (
              <Badge className="text-xs bg-primary">
                {events.todayEvents} hoy
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => navigate("/events")}
          >
            Ver <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10 text-center">
            <div className="flex items-center justify-center gap-1">
              <UserCheck className="h-4 w-4 text-emerald-500" />
              <span className="text-xl font-bold text-emerald-500">{events.completedCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">Completadas</p>
          </div>
          <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10 text-center">
            <div className="flex items-center justify-center gap-1">
              <UserX className="h-4 w-4 text-destructive" />
              <span className="text-xl font-bold text-destructive">{events.noShowCount}</span>
            </div>
            <p className="text-xs text-muted-foreground">No Show</p>
          </div>
        </div>

        {/* Additional Stats */}
        <div className="pt-2 border-t space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Próximas
            </span>
            <span className="font-medium">{events.upcomingEvents}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tasa de asistencia</span>
            <Badge variant="outline" className={cn(
              events.showRate >= 80 
                ? "border-emerald-500/30 text-emerald-500" 
                : events.showRate >= 60 
                  ? "border-amber-500/30 text-amber-500"
                  : "border-destructive/30 text-destructive"
            )}>
              {events.showRate}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
