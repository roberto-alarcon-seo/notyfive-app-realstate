import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Clock, User, Zap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useAutomation,
  useAutomationRuns,
  useAutomationRunSteps,
  type AutomationRun,
  type AutomationRunStatus,
} from '@/hooks/useAutomations';

const STATUS_CONFIG: Record<AutomationRunStatus, { label: string; icon: React.ElementType; color: string }> = {
  queued: { label: 'En cola', icon: Clock, color: 'text-muted-foreground' },
  running: { label: 'Ejecutando', icon: Zap, color: 'text-warning' },
  success: { label: 'Exitoso', icon: CheckCircle, color: 'text-success' },
  failed: { label: 'Fallido', icon: XCircle, color: 'text-destructive' },
  skipped_condition: { label: 'Omitido', icon: AlertTriangle, color: 'text-muted-foreground' },
  blocked_wallet: { label: 'Sin saldo', icon: AlertTriangle, color: 'text-destructive' },
  blocked_rate: { label: 'Límite excedido', icon: AlertTriangle, color: 'text-warning' },
  blocked_window: { label: 'Ventana cerrada', icon: AlertTriangle, color: 'text-warning' },
  blocked_optout: { label: 'Opt-out', icon: AlertTriangle, color: 'text-muted-foreground' },
  blocked_template: { label: 'Plantilla inválida', icon: AlertTriangle, color: 'text-destructive' },
};

export default function AutomationRuns() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedRun, setSelectedRun] = useState<AutomationRun | null>(null);

  const { data: automation, isLoading: loadingAutomation } = useAutomation(id || null);
  const { data: runs, isLoading: loadingRuns } = useAutomationRuns(id);
  const { data: steps } = useAutomationRunSteps(selectedRun?.id || null);

  const isLoading = loadingAutomation || loadingRuns;

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/automations')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Historial de ejecuciones
          </h1>
          {automation && (
            <p className="text-sm text-muted-foreground">
              {automation.name}
            </p>
          )}
        </div>
      </div>

      {/* Stats Summary */}
      {runs && runs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-secondary/30 border-border">
            <CardContent className="p-4">
              <div className="text-2xl font-semibold text-foreground">{runs.length}</div>
              <p className="text-sm text-muted-foreground">Total</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30 border-border">
            <CardContent className="p-4">
              <div className="text-2xl font-semibold text-success">
                {runs.filter(r => r.status === 'success').length}
              </div>
              <p className="text-sm text-muted-foreground">Exitosos</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30 border-border">
            <CardContent className="p-4">
              <div className="text-2xl font-semibold text-destructive">
                {runs.filter(r => r.status === 'failed').length}
              </div>
              <p className="text-sm text-muted-foreground">Fallidos</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30 border-border">
            <CardContent className="p-4">
              <div className="text-2xl font-semibold text-warning">
                {runs.filter(r => r.status.startsWith('blocked_')).length}
              </div>
              <p className="text-sm text-muted-foreground">Bloqueados</p>
            </CardContent>
          </Card>
          <Card className="bg-secondary/30 border-border">
            <CardContent className="p-4">
              <div className="text-2xl font-semibold text-primary">
                {runs.reduce((sum, r) => sum + (r.wallet_consumed || 0), 0)}
              </div>
              <p className="text-sm text-muted-foreground">Mensajes</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Runs List */}
      {!runs || runs.length === 0 ? (
        <Card className="bg-secondary/30 border-border">
          <CardContent className="p-12 text-center">
            <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              Sin ejecuciones
            </h3>
            <p className="text-sm text-muted-foreground">
              Aún no hay ejecuciones registradas para esta automatización
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-secondary/30 border-border">
          <CardHeader>
            <CardTitle className="text-lg">Últimas ejecuciones</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="max-h-[600px]">
              <div className="divide-y divide-border">
                {runs.map((run) => {
                  const statusConfig = STATUS_CONFIG[run.status];
                  const StatusIcon = statusConfig.icon;

                  return (
                    <div
                      key={run.id}
                      className="p-4 hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => setSelectedRun(run)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <StatusIcon className={`h-5 w-5 ${statusConfig.color}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">
                                {run.contact?.name || 'Contacto'}
                              </span>
                              <Badge variant="outline" className={statusConfig.color}>
                                {statusConfig.label}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {run.contact?.phone || 'Sin teléfono'}
                              </span>
                              <span>•</span>
                              <span>
                                {new Date(run.created_at).toLocaleString('es-MX')}
                              </span>
                              {run.wallet_consumed > 0 && (
                                <>
                                  <span>•</span>
                                  <span>{run.wallet_consumed} mensajes</span>
                                </>
                              )}
                            </div>
                            {run.error_message && (
                              <p className="text-sm text-destructive mt-1">
                                {run.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Run Detail Sheet */}
      <Sheet open={!!selectedRun} onOpenChange={() => setSelectedRun(null)}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Detalle de ejecución</SheetTitle>
          </SheetHeader>
          {selectedRun && (
            <div className="mt-6 space-y-6">
              {/* Run Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estado</span>
                  <Badge
                    variant="outline"
                    className={STATUS_CONFIG[selectedRun.status].color}
                  >
                    {STATUS_CONFIG[selectedRun.status].label}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Contacto</span>
                  <span className="text-foreground">
                    {selectedRun.contact?.name || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Teléfono</span>
                  <span className="text-foreground">
                    {selectedRun.contact?.phone || 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Inicio</span>
                  <span className="text-foreground">
                    {selectedRun.started_at
                      ? new Date(selectedRun.started_at).toLocaleString('es-MX')
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Fin</span>
                  <span className="text-foreground">
                    {selectedRun.finished_at
                      ? new Date(selectedRun.finished_at).toLocaleString('es-MX')
                      : 'N/A'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Mensajes consumidos</span>
                  <span className="text-foreground">{selectedRun.wallet_consumed}</span>
                </div>
                {selectedRun.error_message && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm text-destructive font-medium">Error</p>
                    <p className="text-sm text-destructive/80">{selectedRun.error_message}</p>
                  </div>
                )}
              </div>

              {/* Steps */}
              <div className="space-y-3">
                <h4 className="font-medium text-foreground">Pasos ejecutados</h4>
                {steps && steps.length > 0 ? (
                  <div className="space-y-2">
                    {steps.map((step) => {
                      const stepStatusConfig: { color: string } = {
                        queued: { color: 'text-muted-foreground' },
                        running: { color: 'text-warning' },
                        success: { color: 'text-success' },
                        failed: { color: 'text-destructive' },
                        skipped: { color: 'text-muted-foreground' },
                        blocked: { color: 'text-warning' },
                      }[step.status] || { color: 'text-muted-foreground' };

                      return (
                        <div
                          key={step.id}
                          className="p-3 rounded-lg border border-border bg-muted/30"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">
                              Paso {step.step_index + 1}: {step.action_type}
                            </span>
                            <Badge variant="outline" className={stepStatusConfig.color}>
                              {step.status}
                            </Badge>
                          </div>
                          {step.error_message && (
                            <p className="text-xs text-destructive">{step.error_message}</p>
                          )}
                          {step.started_at && (
                            <p className="text-xs text-muted-foreground">
                              {new Date(step.started_at).toLocaleString('es-MX')}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin pasos registrados</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
