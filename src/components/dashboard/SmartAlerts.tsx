import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  X,
  ChevronRight 
} from "lucide-react";
import { useSystemAlerts, SystemAlert } from "@/hooks/useSystemAlerts";
import { useNavigate } from "react-router-dom";

const alertConfig = {
  warning: {
    icon: AlertTriangle,
    bgColor: "bg-amber-500/10",
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-500",
  },
  error: {
    icon: AlertCircle,
    bgColor: "bg-destructive/10",
    borderColor: "border-l-destructive",
    iconColor: "text-destructive",
  },
  success: {
    icon: CheckCircle2,
    bgColor: "bg-emerald-500/10",
    borderColor: "border-l-emerald-500",
    iconColor: "text-emerald-500",
  },
  info: {
    icon: Info,
    bgColor: "bg-primary/10",
    borderColor: "border-l-primary",
    iconColor: "text-primary",
  },
};

interface AlertItemProps {
  alert: SystemAlert;
  onResolve: (id: string) => void;
  onNavigate: (alert: SystemAlert) => void;
}

function AlertItem({ alert, onResolve, onNavigate }: AlertItemProps) {
  const config = alertConfig[alert.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border-l-4 transition-all hover:shadow-sm",
        config.bgColor,
        config.borderColor
      )}
    >
      <Icon className={cn("w-5 h-5 flex-shrink-0 mt-0.5", config.iconColor)} />
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-foreground">{alert.title}</span>
          {alert.severity >= 3 && (
            <Badge variant="destructive" className="text-xs">
              Urgente
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {alert.message}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {alert.entity_type && alert.entity_id && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate(alert)}
            className="text-muted-foreground hover:text-foreground"
          >
            Ver <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onResolve(alert.id)}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function SmartAlerts() {
  const { alerts, isLoading, resolveAlert } = useSystemAlerts();
  const navigate = useNavigate();

  const handleNavigate = (alert: SystemAlert) => {
    switch (alert.entity_type) {
      case "campaign":
        navigate(`/campaigns/${alert.entity_id}`);
        break;
      case "template":
        navigate("/templates");
        break;
      case "credits":
        navigate("/settings/whatsapp");
        break;
      case "inbox":
        navigate("/inbox");
        break;
      default:
        break;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (alerts.length === 0) {
    return null; // Don't show the section if there are no alerts
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            Alertas Inteligentes
            <Badge variant="secondary" className="ml-2">
              {alerts.length}
            </Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {alerts.map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onResolve={resolveAlert}
            onNavigate={handleNavigate}
          />
        ))}
      </CardContent>
    </Card>
  );
}
