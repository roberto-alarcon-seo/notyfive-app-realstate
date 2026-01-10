import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ClipboardCheck, ArrowUpRight, AlertCircle, Clock, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { FollowupMetric } from "@/hooks/useRealEstateDashboard";
import { cn } from "@/lib/utils";

interface FollowupsCardProps {
  followups: FollowupMetric;
  isLoading?: boolean;
}

export function FollowupsCard({ followups, isLoading }: FollowupsCardProps) {
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

  const hasOverdue = followups.overdueCount > 0;
  const hasDueToday = followups.dueTodayCount > 0;

  return (
    <Card className={cn(
      hasOverdue && "ring-1 ring-destructive/20"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={cn(
              "p-1.5 rounded-md",
              hasOverdue ? "bg-destructive/10" : "bg-amber-500/10"
            )}>
              <ClipboardCheck className={cn(
                "h-4 w-4",
                hasOverdue ? "text-destructive" : "text-amber-500"
              )} />
            </div>
            <CardTitle className="text-sm font-semibold">Seguimientos</CardTitle>
            {hasOverdue && (
              <Badge variant="destructive" className="text-xs">
                {followups.overdueCount} vencidos
              </Badge>
            )}
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => navigate("/followups")}
          >
            Ver <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Urgency Indicators */}
        <div className="grid grid-cols-3 gap-2">
          <div className={cn(
            "p-2 rounded-lg text-center",
            hasOverdue ? "bg-destructive/10" : "bg-muted/30"
          )}>
            <div className="flex items-center justify-center gap-1">
              <AlertCircle className={cn(
                "h-3.5 w-3.5",
                hasOverdue ? "text-destructive" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-lg font-bold",
                hasOverdue ? "text-destructive" : "text-muted-foreground"
              )}>
                {followups.overdueCount}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Vencidos</p>
          </div>
          
          <div className={cn(
            "p-2 rounded-lg text-center",
            hasDueToday ? "bg-amber-500/10" : "bg-muted/30"
          )}>
            <div className="flex items-center justify-center gap-1">
              <Clock className={cn(
                "h-3.5 w-3.5",
                hasDueToday ? "text-amber-500" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-lg font-bold",
                hasDueToday ? "text-amber-500" : "text-muted-foreground"
              )}>
                {followups.dueTodayCount}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Hoy</p>
          </div>
          
          <div className="p-2 rounded-lg text-center bg-muted/30">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-lg font-bold text-muted-foreground">
                {followups.dueTomorrowCount}
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground">Mañana</p>
          </div>
        </div>

        {/* Stats */}
        <div className="pt-2 border-t space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Completados
            </span>
            <span className="font-medium text-emerald-500">+{followups.completedThisPeriod}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Tasa cumplimiento</span>
            <Badge variant="outline" className={cn(
              followups.completionRate >= 80 
                ? "border-emerald-500/30 text-emerald-500" 
                : followups.completionRate >= 50 
                  ? "border-amber-500/30 text-amber-500"
                  : "border-destructive/30 text-destructive"
            )}>
              {followups.completionRate}%
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
