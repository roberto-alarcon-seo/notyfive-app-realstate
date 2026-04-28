import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  Clock, 
  Wallet, 
  Calendar, 
  MessageSquare, 
  Ghost,
  ArrowRight,
  CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface AlertsPanelProps {
  alerts: {
    overdueFollowups: number;
    lowCredits: boolean;
    pendingVisits: number;
    unreadMessages: number;
    ghostingLeads: number;
  };
  isLoading?: boolean;
}

export function AlertsPanel({ alerts, isLoading }: AlertsPanelProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return null;
  }

  const alertItems = [
    {
      condition: alerts.overdueFollowups > 0,
      icon: Clock,
      label: `${alerts.overdueFollowups} seguimientos vencidos`,
      severity: 'destructive' as const,
      action: () => navigate('/followups'),
    },
    {
      condition: alerts.lowCredits,
      icon: Wallet,
      label: 'Créditos bajos - recarga pronto',
      severity: 'warning' as const,
      action: () => navigate('/settings/whatsapp'),
    },
    {
      condition: alerts.unreadMessages > 5,
      icon: MessageSquare,
      label: `${alerts.unreadMessages} mensajes sin leer`,
      severity: 'warning' as const,
      action: () => navigate('/inbox'),
    },
    {
      condition: alerts.pendingVisits > 0,
      icon: Calendar,
      label: `${alerts.pendingVisits} visitas pendientes`,
      severity: 'info' as const,
      action: () => navigate('/events'),
    },
    {
      condition: alerts.ghostingLeads > 5,
      icon: Ghost,
      label: `${alerts.ghostingLeads} leads en ghosting`,
      severity: 'warning' as const,
      action: () => navigate('/contacts?status=GHOSTING'),
    },
  ].filter(item => item.condition);

  if (alertItems.length === 0) {
    return (
      <Card className="bg-emerald-500/5 border-emerald-500/20">
        <CardContent className="py-3 px-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            <span className="text-sm text-emerald-700 dark:text-emerald-400">
              Todo en orden — no hay alertas pendientes
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-2">
      {alertItems.map((alert, index) => {
        const Icon = alert.icon;
        return (
          <Card 
            key={index}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              alert.severity === 'destructive' && "bg-destructive/5 border-destructive/20 hover:border-destructive/40",
              alert.severity === 'warning' && "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40",
              alert.severity === 'info' && "bg-blue-500/5 border-blue-500/20 hover:border-blue-500/40"
            )}
            onClick={alert.action}
          >
            <CardContent className="py-2.5 px-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn(
                    "h-4 w-4 shrink-0",
                    alert.severity === 'destructive' && "text-destructive",
                    alert.severity === 'warning' && "text-amber-500",
                    alert.severity === 'info' && "text-blue-500"
                  )} />
                  <span className={cn(
                    "text-sm truncate",
                    alert.severity === 'destructive' && "text-destructive",
                    alert.severity === 'warning' && "text-amber-600 dark:text-amber-400",
                    alert.severity === 'info' && "text-blue-600 dark:text-blue-400"
                  )}>
                    {alert.label}
                  </span>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
