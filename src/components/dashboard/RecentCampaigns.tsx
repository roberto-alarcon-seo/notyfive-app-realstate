import { Send, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const campaigns = [
  {
    id: 1,
    name: "Promoción Black Friday",
    segment: "Clientes VIP",
    status: "completed",
    sent: 1250,
    delivered: 1180,
    date: "Hace 2 horas",
  },
  {
    id: 2,
    name: "Recordatorio de pago",
    segment: "Morosos 30 días",
    status: "sending",
    sent: 450,
    delivered: 320,
    date: "En progreso",
  },
  {
    id: 3,
    name: "Newsletter Diciembre",
    segment: "Todos los contactos",
    status: "scheduled",
    sent: 0,
    delivered: 0,
    date: "Programada: 10 Dic",
  },
  {
    id: 4,
    name: "Oferta especial",
    segment: "Leads nuevos",
    status: "draft",
    sent: 0,
    delivered: 0,
    date: "Borrador",
  },
];

const statusConfig = {
  completed: {
    icon: CheckCircle,
    label: "Completada",
    color: "text-success",
    bg: "bg-success/10",
  },
  sending: {
    icon: Send,
    label: "Enviando",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  scheduled: {
    icon: Clock,
    label: "Programada",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  draft: {
    icon: AlertCircle,
    label: "Borrador",
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
};

export function RecentCampaigns() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="p-6 border-b border-border">
        <h3 className="text-lg font-semibold text-foreground">Campañas recientes</h3>
        <p className="text-sm text-muted-foreground mt-1">Últimas 4 campañas</p>
      </div>
      <div className="divide-y divide-border">
        {campaigns.map((campaign) => {
          const status = statusConfig[campaign.status as keyof typeof statusConfig];
          const StatusIcon = status.icon;
          
          return (
            <div
              key={campaign.id}
              className="p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", status.bg)}>
                    <StatusIcon className={cn("w-5 h-5", status.color)} />
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{campaign.name}</h4>
                    <p className="text-sm text-muted-foreground">{campaign.segment}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-foreground">
                    {campaign.sent > 0 ? `${campaign.delivered}/${campaign.sent}` : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">{campaign.date}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
