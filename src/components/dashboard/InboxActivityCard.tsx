import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  Bot, 
  User,
  ArrowUpRight,
  Inbox
} from "lucide-react";
import { useInboxActivity } from "@/hooks/useInboxActivity";
import { useNavigate } from "react-router-dom";

interface ActivityStatProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  iconColor?: string;
}

function ActivityStat({ icon, label, value, subtext, iconColor = "text-primary" }: ActivityStatProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
      <div className={cn("p-2 rounded-lg bg-background", iconColor)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground truncate">{label}</p>
        <p className="text-xl font-bold text-foreground">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground">{subtext}</p>}
      </div>
    </div>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <Inbox className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold mb-2">Inbox vacío</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Las conversaciones aparecerán aquí cuando tus contactos respondan.
      </p>
      <Button variant="outline" size="sm" onClick={() => navigate("/inbox")}>
        Ir al inbox
      </Button>
    </div>
  );
}

export function InboxActivityCard() {
  const { data, isLoading } = useInboxActivity();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Actividad del Inbox</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-20 bg-muted rounded-lg" />
            <div className="h-20 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasActivity = data && (
    data.pendingConversations > 0 || 
    data.attendedToday > 0 || 
    data.aiPercentage > 0 || 
    data.humanPercentage > 0
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">Actividad del Inbox</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/inbox")}>
          Ir al inbox <ArrowUpRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {!hasActivity ? (
          <EmptyState />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <ActivityStat
                icon={<MessageCircle className="w-4 h-4" />}
                label="Pendientes"
                value={data?.pendingConversations || 0}
                iconColor={data?.pendingConversations && data.pendingConversations > 0 ? "text-amber-500" : "text-primary"}
              />
              <ActivityStat
                icon={<CheckCircle2 className="w-4 h-4" />}
                label="Atendidas hoy"
                value={data?.attendedToday || 0}
                iconColor="text-emerald-500"
              />
            </div>

            <ActivityStat
              icon={<Clock className="w-4 h-4" />}
              label="Tiempo promedio de respuesta"
              value={data?.avgFirstResponseTime ? `${data.avgFirstResponseTime} min` : "—"}
              iconColor="text-primary"
            />

            {/* AI vs Human breakdown */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Respuestas IA vs Humano</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Bot className="w-4 h-4 text-primary" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">IA</span>
                      <span className="text-sm font-medium">{data?.aiPercentage || 0}%</span>
                    </div>
                    <Progress value={data?.aiPercentage || 0} className="h-2" />
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm">Humano</span>
                      <span className="text-sm font-medium">{data?.humanPercentage || 0}%</span>
                    </div>
                    <Progress value={data?.humanPercentage || 0} className="h-2 [&>div]:bg-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
