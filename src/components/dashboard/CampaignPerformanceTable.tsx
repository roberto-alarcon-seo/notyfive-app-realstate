import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { 
  Flame, 
  AlertCircle, 
  CircleDot, 
  MoreVertical, 
  Eye, 
  Copy, 
  Sparkles,
  MessageSquare,
  ArrowUpRight
} from "lucide-react";
import { useCampaignPerformance, CampaignPerformance } from "@/hooks/useCampaignPerformance";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

const healthConfig = {
  excellent: {
    icon: Flame,
    label: "Excelente",
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  regular: {
    icon: CircleDot,
    label: "Regular",
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  risk: {
    icon: AlertCircle,
    label: "Riesgo",
    color: "text-destructive",
    bgColor: "bg-destructive/10",
  },
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Borrador", variant: "secondary" },
  scheduled: { label: "Programada", variant: "outline" },
  sending: { label: "Enviando", variant: "default" },
  completed: { label: "Completada", variant: "default" },
  paused: { label: "Pausada", variant: "secondary" },
  failed: { label: "Error", variant: "destructive" },
};

interface CampaignRowProps {
  campaign: CampaignPerformance;
  onViewDetail: (id: string) => void;
  onDuplicate: (id: string) => void;
}

function CampaignRow({ campaign, onViewDetail, onDuplicate }: CampaignRowProps) {
  const health = healthConfig[campaign.healthStatus];
  const HealthIcon = health.icon;
  const status = statusLabels[campaign.status] || statusLabels.draft;

  return (
    <TableRow className="hover:bg-muted/50">
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{campaign.name}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(campaign.createdAt), { 
              addSuffix: true, 
              locale: es 
            })}
          </span>
        </div>
      </TableCell>
      
      <TableCell>
        <Badge variant={status.variant}>{status.label}</Badge>
      </TableCell>
      
      <TableCell>
        <div className="flex items-center gap-1.5">
          <MessageSquare className="w-4 h-4 text-muted-foreground" />
          <span className="font-medium">{campaign.conversationsGenerated}</span>
        </div>
      </TableCell>
      
      <TableCell>
        <span className={cn(
          "font-medium",
          campaign.responseRate >= 20 ? "text-emerald-500" :
          campaign.responseRate >= 10 ? "text-amber-500" : "text-destructive"
        )}>
          {campaign.responseRate}%
        </span>
      </TableCell>
      
      <TableCell>
        <span className={cn(
          campaign.optOuts > 0 ? "text-amber-500" : "text-muted-foreground"
        )}>
          {campaign.optOuts}
        </span>
      </TableCell>
      
      <TableCell>
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full w-fit",
          health.bgColor
        )}>
          <HealthIcon className={cn("w-4 h-4", health.color)} />
          <span className={cn("text-sm font-medium", health.color)}>
            {health.label}
          </span>
        </div>
      </TableCell>
      
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onViewDetail(campaign.id)}>
              <Eye className="w-4 h-4 mr-2" />
              Ver detalle
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(campaign.id)}>
              <Copy className="w-4 h-4 mr-2" />
              Duplicar
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <Sparkles className="w-4 h-4 mr-2" />
              Optimizar con IA
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

function EmptyState() {
  const navigate = useNavigate();
  
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="p-4 rounded-full bg-muted mb-4">
        <MessageSquare className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="font-semibold text-lg mb-2">Sin campañas aún</h3>
      <p className="text-muted-foreground mb-4 max-w-sm">
        Crea tu primera campaña para comenzar a generar conversaciones con tus contactos.
      </p>
      <Button onClick={() => navigate("/campaigns/new")}>
        Crear campaña
        <ArrowUpRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

export function CampaignPerformanceTable() {
  const { data: campaigns, isLoading } = useCampaignPerformance();
  const navigate = useNavigate();

  const handleViewDetail = (id: string) => {
    navigate(`/campaigns/${id}`);
  };

  const handleDuplicate = (id: string) => {
    // TODO: Implement duplicate functionality
    console.log("Duplicate campaign:", id);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performance de Campañas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Performance de Campañas</CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/campaigns")}>
          Ver todas <ArrowUpRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {!campaigns || campaigns.length === 0 ? (
          <EmptyState />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaña</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Conversaciones</TableHead>
                <TableHead>% Respuesta</TableHead>
                <TableHead>Opt-outs</TableHead>
                <TableHead>Salud</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <CampaignRow
                  key={campaign.id}
                  campaign={campaign}
                  onViewDetail={handleViewDetail}
                  onDuplicate={handleDuplicate}
                />
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
