import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Zap, Play, Pause, Copy, Trash2, History, MoreHorizontal, Search, Filter, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
  useAutomations,
  useDeleteAutomation,
  useDuplicateAutomation,
  useToggleAutomationStatus,
  useAutomationStats,
  type Automation,
  type AutomationStatus,
} from '@/hooks/useAutomations';
import { useOperationStatus, automationHasSendActions } from '@/hooks/useOperationStatus';

const TRIGGER_LABELS: Record<string, string> = {
  inbound_message: 'Mensaje entrante',
  window_expiring: 'Ventana por expirar',
  window_expired: 'Ventana expirada',
  campaign_touched: 'Campaña enviada',
  campaign_replied: 'Campaña respondida',
  field_changed: 'Campo modificado',
  tag_changed: 'Tag modificado',
  scheduled: 'Programado',
  'event.created': 'Evento creado',
  'event.upcoming': 'Evento próximo',
  'event.canceled': 'Evento cancelado',
  'event.completed': 'Evento completado',
  'event.no_show': 'No asistió',
  'event.confirmed': 'Evento confirmado',
};

const STATUS_CONFIG: Record<AutomationStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Activa', variant: 'default' },
  paused: { label: 'Pausada', variant: 'secondary' },
  draft: { label: 'Borrador', variant: 'outline' },
};

export default function Automations() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<AutomationStatus | undefined>();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showCreditsDialog, setShowCreditsDialog] = useState(false);

  const { data: automations, isLoading } = useAutomations(statusFilter);
  const { data: stats } = useAutomationStats();
  const deleteAutomation = useDeleteAutomation();
  const duplicateAutomation = useDuplicateAutomation();
  const toggleStatus = useToggleAutomationStatus();
  const { canOperate } = useOperationStatus();

  const filteredAutomations = automations?.filter(a =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.description?.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  const handleDelete = () => {
    if (deleteId) {
      deleteAutomation.mutate(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Automatizaciones</h1>
          <p className="text-sm text-muted-foreground">
            Configura flujos automáticos para tus conversaciones
          </p>
        </div>
        <Button onClick={() => navigate('/automations/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva automatización
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-secondary/30 border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-foreground">
              {automations?.filter(a => a.status === 'active').length || 0}
            </div>
            <p className="text-sm text-muted-foreground">Activas</p>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30 border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-success">
              {stats?.success || 0}
            </div>
            <p className="text-sm text-muted-foreground">Éxitos (24h)</p>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30 border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-destructive">
              {stats?.failed || 0}
            </div>
            <p className="text-sm text-muted-foreground">Fallidos (24h)</p>
          </CardContent>
        </Card>
        <Card className="bg-secondary/30 border-border">
          <CardContent className="p-4">
            <div className="text-2xl font-semibold text-warning">
              {stats?.blocked || 0}
            </div>
            <p className="text-sm text-muted-foreground">Bloqueados (24h)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar automatizaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Badge
            variant={!statusFilter ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter(undefined)}
          >
            Todas
          </Badge>
          <Badge
            variant={statusFilter === 'active' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('active')}
          >
            Activas
          </Badge>
          <Badge
            variant={statusFilter === 'paused' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('paused')}
          >
            Pausadas
          </Badge>
          <Badge
            variant={statusFilter === 'draft' ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setStatusFilter('draft')}
          >
            Borradores
          </Badge>
        </div>
      </div>

      {/* Automations List */}
      {filteredAutomations.length === 0 ? (
        <Card className="bg-secondary/30 border-border">
          <CardContent className="p-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery || statusFilter ? 'No hay resultados' : 'Sin automatizaciones'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || statusFilter
                ? 'Intenta con otros filtros'
                : 'Crea tu primera automatización para comenzar'}
            </p>
            {!searchQuery && !statusFilter && (
              <Button onClick={() => navigate('/automations/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Nueva automatización
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredAutomations.map((automation) => (
            <AutomationCard
              key={automation.id}
              automation={automation}
              canOperate={canOperate}
              onEdit={() => navigate(`/automations/${automation.id}`)}
              onHistory={() => navigate(`/automations/${automation.id}/runs`)}
              onDuplicate={() => duplicateAutomation.mutate(automation.id)}
              onToggleStatus={() => {
                // Check if trying to activate an automation with send actions without credits
                const hasSendActions = automationHasSendActions(automation.actions || []);
                if (!canOperate && hasSendActions && automation.status !== 'active') {
                  setShowCreditsDialog(true);
                  return;
                }
                toggleStatus.mutate({ id: automation.id, status: automation.status });
              }}
              onDelete={() => setDeleteId(automation.id)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar automatización?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán también todos los registros de ejecución asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Credits required dialog */}
      <AlertDialog open={showCreditsDialog} onOpenChange={setShowCreditsDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sin saldo disponible</AlertDialogTitle>
            <AlertDialogDescription>
              Esta automatización envía mensajes. Tu saldo es gestionado desde Brokia24 Core; contacta
              a tu administrador para obtener más créditos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowCreditsDialog(false)}>
              Entendido
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface AutomationCardProps {
  automation: Automation;
  canOperate: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onDuplicate: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

function AutomationCard({
  automation,
  canOperate,
  onEdit,
  onHistory,
  onDuplicate,
  onToggleStatus,
  onDelete,
}: AutomationCardProps) {
  const statusConfig = STATUS_CONFIG[automation.status];
  const hasSendActions = automationHasSendActions(automation.actions || []);
  const isActivationBlocked = !canOperate && hasSendActions && automation.status !== 'active';

  return (
    <Card
      className="bg-secondary/30 border-border hover:bg-secondary/50 transition-colors cursor-pointer"
      onClick={onEdit}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className={`p-2 rounded-lg ${automation.status === 'active' ? 'bg-success/10' : 'bg-muted'}`}>
              <Zap className={`h-5 w-5 ${automation.status === 'active' ? 'text-success' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium text-foreground truncate">{automation.name}</h3>
                <Badge variant={statusConfig.variant} className="shrink-0">
                  {statusConfig.label}
                </Badge>
              </div>
              {automation.description && (
                <p className="text-sm text-muted-foreground truncate mb-2">
                  {automation.description}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {TRIGGER_LABELS[automation.trigger_type] || automation.trigger_type}
                </span>
                <span>•</span>
                <span>{automation.actions?.length || 0} acciones</span>
                <span>•</span>
                <span>
                  Actualizado {new Date(automation.updated_at).toLocaleDateString('es-MX')}
                </span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={onEdit}>
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onHistory}>
                <History className="h-4 w-4 mr-2" />
                Ver historial
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onToggleStatus}>
                {automation.status === 'active' ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Pausar
                  </>
                ) : isActivationBlocked ? (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center text-muted-foreground cursor-not-allowed">
                          <Lock className="h-4 w-4 mr-2" />
                          Activar
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        Necesitas créditos para activar
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Activar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}
