import { RefreshCw, FileText, ExternalLink, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useStripeInvoices, StripeInvoice } from "@/hooks/useStripeInvoices";
import { format } from "date-fns";
import { es } from "date-fns/locale";

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "bg-success/10 text-success border-success/30";
    case "open":
    case "draft":
      return "bg-warning/10 text-warning border-warning/30";
    case "uncollectible":
      return "bg-destructive/10 text-destructive border-destructive/30";
    case "void":
      return "bg-muted text-muted-foreground border-muted";
    default:
      return "bg-muted text-muted-foreground border-muted";
  }
}

function formatDate(timestamp: number): string {
  return format(new Date(timestamp * 1000), "d MMM yyyy", { locale: es });
}

function InvoiceRow({ invoice }: { invoice: StripeInvoice }) {
  const hasPeriod = invoice.period_start && invoice.period_end;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-3 px-2 text-sm text-foreground">
        {formatDate(invoice.created)}
      </td>
      <td className="py-3 px-2">
        <div className="text-sm text-foreground">
          {invoice.description || "Cargo NotyFive"}
        </div>
        {hasPeriod && (
          <div className="text-xs text-muted-foreground mt-0.5">
            Periodo: {formatDate(invoice.period_start!)} – {formatDate(invoice.period_end!)}
          </div>
        )}
      </td>
      <td className="py-3 px-2 text-sm text-foreground font-medium">
        {invoice.total}
      </td>
      <td className="py-3 px-2">
        <Badge variant="outline" className={getStatusBadgeClass(invoice.status)}>
          {invoice.status_label}
        </Badge>
      </td>
      <td className="py-3 px-2">
        <div className="flex items-center gap-2">
          {invoice.invoice_pdf && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => window.open(invoice.invoice_pdf!, "_blank")}
            >
              <FileText className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
          )}
          {invoice.hosted_invoice_url && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => window.open(invoice.hosted_invoice_url!, "_blank")}
            >
              <ExternalLink className="h-3.5 w-3.5 mr-1" />
              Ver
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

export function InvoiceHistoryCard() {
  const { invoices, isLoading, isError, refetch } = useStripeInvoices();

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Historial de facturación</h3>
          <p className="text-muted-foreground text-sm">
            Consulta tus cargos y descarga tus facturas.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Loading state */}
      {isLoading && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Cargando facturas…
        </p>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
          <div className="flex-1">
            <p className="text-sm text-foreground">No se pudieron cargar tus facturas.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && invoices.length === 0 && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          Aún no tienes facturas registradas.
        </p>
      )}

      {/* Invoices table */}
      {!isLoading && !isError && invoices.length > 0 && (
        <div className="overflow-x-auto -mx-2">
          <table className="w-full min-w-[500px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fecha
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Concepto
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Monto
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Estado
                </th>
                <th className="text-left py-2 px-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Factura
                </th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <InvoiceRow key={inv.id} invoice={inv} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
