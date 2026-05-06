import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, XCircle, PlayCircle, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface TestResult {
  scenario: string;
  expected: string;
  actual: any;
  passed: boolean;
}

interface TestRun {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  duration_ms: number;
  results: TestResult[];
  error?: string;
}

export default function AdminAssignmentTests() {
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<TestRun | null>(null);

  const handleRun = async () => {
    setRunning(true);
    setRun(null);
    try {
      const { data, error } = await supabase.functions.invoke("run-assignment-tests", {
        method: "POST",
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setRun(data as TestRun);
      if (data.ok) {
        toast.success(`✅ Todos los tests pasaron (${data.passed}/${data.total})`);
      } else {
        toast.error(`❌ ${data.failed} test(s) fallaron`);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "Error ejecutando tests");
      setRun({
        ok: false,
        total: 0,
        passed: 0,
        failed: 0,
        duration_ms: 0,
        results: [],
        error: e?.message ?? String(e),
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <AdminLayout
      title="Diagnóstico del motor de asignación"
      description="Ejecuta una batería de pruebas que valida toda la lógica de asignación de leads sin tocar tus datos reales."
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>¿Qué hace este diagnóstico?</AlertTitle>
          <AlertDescription className="text-sm">
            Crea un tenant temporal con asesores, propiedades y conversaciones ficticias, ejecuta
            12 escenarios contra el motor real (Sticky → Propiedad → Round Robin → Fallback,
            timeouts, capacidad máxima, reasignación manual, auditoría) y al finalizar borra todo
            automáticamente. Tus datos reales no se modifican.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base">Suite de pruebas</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                12 escenarios · ~5–10 segundos · ejecutado bajo demanda
              </p>
            </div>
            <Button onClick={handleRun} disabled={running} size="lg">
              {running ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Ejecutando…
                </>
              ) : (
                <>
                  <PlayCircle className="h-4 w-4 mr-2" /> Ejecutar diagnóstico
                </>
              )}
            </Button>
          </CardHeader>

          {run && (
            <CardContent className="space-y-4">
              {run.error ? (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription className="text-sm font-mono">
                    {run.error}
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant={run.ok ? "default" : "destructive"} className="text-sm">
                      {run.ok ? "✓ TODO OK" : "✗ FALLOS"}
                    </Badge>
                    <span className="text-muted-foreground">
                      {run.passed}/{run.total} pasaron · {Math.round(run.duration_ms)}ms
                    </span>
                  </div>

                  <div className="space-y-2">
                    {run.results.map((r, i) => (
                      <div
                        key={i}
                        className={`rounded-md border p-3 ${
                          r.passed
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-destructive/40 bg-destructive/5"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {r.passed ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                          ) : (
                            <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{r.scenario}</div>
                            <div className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Esperado:</span> {r.expected}
                            </div>
                            {!r.passed && (
                              <div className="text-xs text-destructive mt-1 font-mono break-all">
                                <span className="font-medium">Real:</span>{" "}
                                {JSON.stringify(r.actual)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>
      </div>
    </AdminLayout>
  );
}