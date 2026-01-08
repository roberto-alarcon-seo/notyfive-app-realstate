import { useParams, useNavigate } from 'react-router-dom';
import { useCampaign, usePauseCampaign, useResumeCampaign, useStartCampaign } from '@/hooks/useCampaigns';
import { Button } from '@/components/ui/button';
import { GatedActionButton } from '@/components/ui/gated-action-button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useOperationStatus } from '@/hooks/useOperationStatus';
import { 
  ArrowLeft, 
  Play, 
  Pause, 
  Clock, 
  Send, 
  CheckCircle, 
  AlertCircle,
  FileText,
  Users,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  draft: { label: 'Borrador', icon: FileText, className: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Programada', icon: Clock, className: 'bg-blue-500/20 text-blue-400' },
  sending: { label: 'Enviando', icon: Send, className: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Completada', icon: CheckCircle, className: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Pausada', icon: Pause, className: 'bg-orange-500/20 text-orange-400' },
  paused_no_balance: { label: 'Sin saldo', icon: AlertCircle, className: 'bg-destructive/20 text-destructive' },
};

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: campaign, isLoading } = useCampaign(id || null);
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();
  const startCampaign = useStartCampaign();
  const { canOperate } = useOperationStatus();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="p-6">
        <p>Campaña no encontrada</p>
        <Button variant="outline" onClick={() => navigate('/campaigns')} className="mt-4">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver a campañas
        </Button>
      </div>
    );
  }

  const status = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const progress = campaign.total_contacts > 0 
    ? Math.round((campaign.sent_count / campaign.total_contacts) * 100) 
    : 0;
  const deliveryRate = campaign.sent_count > 0 
    ? Math.round((campaign.delivered_count / campaign.sent_count) * 100) 
    : 0;
  const failRate = campaign.sent_count > 0 
    ? Math.round((campaign.failed_count / campaign.sent_count) * 100) 
    : 0;

  const canStart = campaign.status === 'draft';
  const canPause = campaign.status === 'sending';
  const canResume = campaign.status === 'paused' || campaign.status === 'paused_no_balance';

  const handleStart = () => startCampaign.mutate(campaign.id);
  const handlePause = () => pauseCampaign.mutate(campaign.id);
  const handleResume = () => resumeCampaign.mutate(campaign.id);

  const isActionLoading = pauseCampaign.isPending || resumeCampaign.isPending || startCampaign.isPending;

  return (
    <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/campaigns')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{campaign.name}</h1>
              {campaign.description && (
                <p className="text-muted-foreground">{campaign.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={status.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            {canStart && (
              <GatedActionButton 
                onClick={handleStart} 
                disabled={isActionLoading}
                gatedTooltip="Necesitas créditos para iniciar la campaña"
              >
                {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Iniciar
              </GatedActionButton>
            )}
            {canPause && (
              <Button variant="outline" onClick={handlePause} disabled={isActionLoading}>
                {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                Pausar
              </Button>
            )}
            {canResume && (
              <GatedActionButton 
                onClick={handleResume} 
                disabled={isActionLoading}
                gatedTooltip="Necesitas créditos para reanudar la campaña"
              >
                {isActionLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Reanudar
              </GatedActionButton>
            )}
          </div>
        </div>

        {/* Gating alert when no credits */}
        {!canOperate && campaign.status === 'draft' && (
          <Alert className="bg-warning/10 border-warning/20">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning">
              Puedes preparar tu campaña, pero para enviarla necesitas activar un plan o recargar créditos.
            </AlertDescription>
          </Alert>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total contactos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{campaign.total_contacts}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Enviados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">{campaign.sent_count}</div>
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Entregados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{campaign.delivered_count}</div>
              <p className="text-sm text-muted-foreground">{deliveryRate}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Fallidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{campaign.failed_count}</div>
              <p className="text-sm text-muted-foreground">{failRate}%</p>
            </CardContent>
          </Card>
        </div>

        {/* Progress */}
        {(campaign.status === 'sending' || campaign.status === 'completed' || campaign.status === 'paused') && (
          <Card>
            <CardHeader>
              <CardTitle>Progreso de envío</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Progress value={progress} className="h-3" />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>{campaign.sent_count} de {campaign.total_contacts} enviados</span>
                <span>{progress}% completado</span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Información</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tipo</span>
                <span className="capitalize">{campaign.campaign_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Audiencia</span>
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {campaign.segment?.name || 'Todos los contactos'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Creada</span>
                <span>{format(new Date(campaign.created_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
              </div>
              {campaign.scheduled_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Programada para</span>
                  <span>{format(new Date(campaign.scheduled_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
                </div>
              )}
              {campaign.started_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Iniciada</span>
                  <span>{format(new Date(campaign.started_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
                </div>
              )}
              {campaign.completed_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Completada</span>
                  <span>{format(new Date(campaign.completed_at), "d 'de' MMMM yyyy, HH:mm", { locale: es })}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {campaign.template && (
            <Card>
              <CardHeader>
                <CardTitle>Plantilla</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-4 bg-muted rounded-lg text-sm">
                  <p className="font-medium">{(campaign.template as { name: string }).name}</p>
                  <p className="text-muted-foreground mt-1">{(campaign.template as { body: string }).body}</p>
                </div>
              </CardContent>
            </Card>
          )}
      </div>
    </div>
  );
}
