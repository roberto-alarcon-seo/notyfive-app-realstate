import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  AlertTriangle, 
  Clock, 
  Users,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AlertItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  severity: 'error' | 'warning';
  action: () => void;
}

interface CriticalAlertsCardProps {
  overdueFollowups: number;
  ghostingLeads: number;
  leadsWithoutProperty: number;
  isLoading?: boolean;
}

export function CriticalAlertsCard({ 
  overdueFollowups, 
  ghostingLeads,
  leadsWithoutProperty,
  isLoading 
}: CriticalAlertsCardProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const allAlerts: AlertItem[] = [];
  
  if (overdueFollowups > 0) {
    allAlerts.push({
      id: 'overdue',
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      label: `${overdueFollowups} Seguimientos Vencidos`,
      severity: 'error' as const,
      action: () => navigate('/followups'),
    });
  }
  
  if (ghostingLeads > 0) {
    allAlerts.push({
      id: 'ghosting',
      icon: <Clock className="h-4 w-4 text-muted-foreground" />,
      label: `${ghostingLeads} Leads sin respuesta reciente`,
      severity: 'warning' as const,
      action: () => navigate('/contacts?status=GHOSTING'),
    });
  }
  
  if (leadsWithoutProperty > 0) {
    allAlerts.push({
      id: 'no-property',
      icon: <Users className="h-4 w-4 text-muted-foreground" />,
      label: `${leadsWithoutProperty} Leads sin Propiedad Asignada`,
      severity: 'warning' as const,
      action: () => navigate('/contacts'),
    });
  }

  const alerts = allAlerts;

  const hasAlerts = alerts.length > 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Alertas Críticas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {!hasAlerts ? (
          <div className="flex items-center gap-2 py-3 text-emerald-500">
            <CheckCircle2 className="h-4 w-4" />
            <span className="text-sm">Todo en orden — sin alertas pendientes</span>
          </div>
        ) : (
          alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                alert.severity === 'error' 
                  ? "bg-destructive/5 border-destructive/20 hover:border-destructive/40"
                  : "bg-card border-border/40 hover:border-border/60"
              )}
              onClick={alert.action}
            >
              <div className="flex items-center gap-3">
                {alert.icon}
                <span className={cn(
                  "text-sm font-medium",
                  alert.severity === 'error' && "text-destructive"
                )}>
                  {alert.label}
                </span>
              </div>
              <Button variant="link" size="sm" className="text-primary h-auto p-0">
                Ver detalles
              </Button>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
