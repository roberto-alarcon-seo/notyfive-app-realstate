import { Campaign, useDeleteCampaign, useDuplicateCampaign, usePauseCampaign, useResumeCampaign } from '@/hooks/useCampaigns';
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
} from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface CampaignListRowProps {
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

export function CampaignListRow({ campaign }: CampaignListRowProps) {
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
      <div className="flex items-center gap-4 p-4 border border-border rounded-lg hover:border-primary/50 transition-colors bg-card">
        {/* Name & Description */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{campaign.name}</span>
            <Badge className={status.className}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          {campaign.description && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">
              {campaign.description}
            </p>
          )}
        </div>

        {/* Template */}
        <div className="hidden md:block w-40">
          {campaign.template && (
            <Badge variant="outline" className="text-xs truncate max-w-full">
              {campaign.template.name}
            </Badge>
          )}
        </div>

        {/* Segment */}
        <div className="hidden lg:block w-36 text-sm text-muted-foreground truncate">
          {campaign.segment?.name || '-'}
        </div>

        {/* Progress */}
        <div className="hidden sm:flex flex-col w-32 gap-1">
          <div className="flex justify-between text-xs">
            <span>{campaign.sent_count}</span>
            <span className="text-muted-foreground">/ {campaign.total_contacts}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Date */}
        <div className="hidden md:block w-28 text-xs text-muted-foreground">
          {format(new Date(campaign.created_at), 'd MMM yyyy', { locale: es })}
        </div>

        {/* Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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