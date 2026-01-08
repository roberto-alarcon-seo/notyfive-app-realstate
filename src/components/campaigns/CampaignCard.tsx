import { Campaign, useDeleteCampaign, useDuplicateCampaign, usePauseCampaign, useResumeCampaign } from '@/hooks/useCampaigns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  MoreVertical, 
  Play, 
  Pause, 
  Copy, 
  Trash2, 
  Eye,
  Clock,
  Send,
  CheckCircle,
  AlertCircle,
  FileText,
  Users,
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CampaignCardProps {
  campaign: Campaign;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  draft: { label: 'Borrador', icon: FileText, className: 'bg-muted text-muted-foreground' },
  scheduled: { label: 'Programada', icon: Clock, className: 'bg-blue-500/20 text-blue-400' },
  sending: { label: 'Enviando', icon: Send, className: 'bg-amber-500/20 text-amber-400' },
  completed: { label: 'Completada', icon: CheckCircle, className: 'bg-green-500/20 text-green-400' },
  paused: { label: 'Pausada', icon: Pause, className: 'bg-orange-500/20 text-orange-400' },
  paused_no_balance: { label: 'Sin saldo', icon: AlertCircle, className: 'bg-destructive/20 text-destructive' },
};

export function CampaignCard({ campaign }: CampaignCardProps) {
  const navigate = useNavigate();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const deleteCampaign = useDeleteCampaign();
  const duplicateCampaign = useDuplicateCampaign();
  const pauseCampaign = usePauseCampaign();
  const resumeCampaign = useResumeCampaign();

  const status = statusConfig[campaign.status] || statusConfig.draft;
  const StatusIcon = status.icon;
  const progress = campaign.total_contacts > 0 
    ? Math.round((campaign.sent_count / campaign.total_contacts) * 100) 
    : 0;
  const deliveryRate = campaign.sent_count > 0 
    ? Math.round((campaign.delivered_count / campaign.sent_count) * 100) 
    : 0;

  const handleDelete = () => {
    deleteCampaign.mutate(campaign.id);
    setShowDeleteDialog(false);
  };

  const handleDuplicate = () => {
    duplicateCampaign.mutate(campaign);
  };

  const handlePause = () => {
    pauseCampaign.mutate(campaign.id);
  };

  const handleResume = () => {
    resumeCampaign.mutate(campaign.id);
  };

  const canDelete = campaign.status === 'draft';
  const canPause = campaign.status === 'sending';
  const canResume = campaign.status === 'paused' || campaign.status === 'paused_no_balance';

  return (
    <>
      <Card className="hover:border-primary/50 transition-colors">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg truncate">{campaign.name}</CardTitle>
              {campaign.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {campaign.description}
                </p>
              )}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => navigate(`/campaigns/${campaign.id}`)}>
                  <Eye className="h-4 w-4 mr-2" />
                  Ver detalle
                </DropdownMenuItem>
                {canPause && (
                  <DropdownMenuItem onClick={handlePause}>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </DropdownMenuItem>
                )}
                {canResume && (
                  <DropdownMenuItem onClick={handleResume}>
                    <Play className="h-4 w-4 mr-2" />
                    Reanudar
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleDuplicate}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicar
                </DropdownMenuItem>
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={() => setShowDeleteDialog(true)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Eliminar
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={status.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            {campaign.template && (
              <Badge variant="outline" className="text-xs">
                {campaign.template.name}
              </Badge>
            )}
          </div>

          {campaign.segment && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{campaign.segment.name}</span>
            </div>
          )}

          {(campaign.status === 'sending' || campaign.status === 'completed') && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Progreso</span>
                <span>{campaign.sent_count} / {campaign.total_contacts}</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{progress}% enviado</span>
                <span>{deliveryRate}% entregado</span>
              </div>
            </div>
          )}

          {campaign.status === 'scheduled' && campaign.scheduled_at && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {format(new Date(campaign.scheduled_at), "d 'de' MMMM, HH:mm", { locale: es })}
              </span>
            </div>
          )}

          <div className="flex justify-between text-xs text-muted-foreground pt-2 border-t">
            <span>
              Creada: {format(new Date(campaign.created_at), 'd MMM yyyy', { locale: es })}
            </span>
            {campaign.total_contacts > 0 && (
              <span>{campaign.total_contacts} contactos</span>
            )}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La campaña "{campaign.name}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
