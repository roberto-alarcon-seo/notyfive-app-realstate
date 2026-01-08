import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CANCELLATION_REASONS = [
  { value: "too_expensive", label: "El precio es muy alto" },
  { value: "not_using", label: "No estoy usando el servicio" },
  { value: "missing_features", label: "Faltan funcionalidades que necesito" },
  { value: "switching_competitor", label: "Cambiaré a otra plataforma" },
  { value: "business_closed", label: "Mi negocio cerró o cambió" },
  { value: "temporary_pause", label: "Pausa temporal" },
  { value: "other", label: "Otra razón" },
];

interface CancelSubscriptionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  periodEndDate?: string;
  onSuccess: () => void;
}

export function CancelSubscriptionModal({
  open,
  onOpenChange,
  tenantId,
  periodEndDate,
  onSuccess,
}: CancelSubscriptionModalProps) {
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const formattedDate = periodEndDate
    ? new Date(periodEndDate).toLocaleDateString("es-MX", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const handleCancel = async () => {
    if (!reason) {
      toast.error("Por favor selecciona una razón");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "stripe-cancel-subscription",
        {
          body: {
            tenant_id: tenantId,
            reason: CANCELLATION_REASONS.find((r) => r.value === reason)?.label || reason,
            comment: comment.trim() || null,
          },
        }
      );

      if (error) throw error;

      toast.success("Cancelación programada correctamente");
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error canceling subscription:", error);
      toast.error(error.message || "Error al procesar la cancelación");
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setReason("");
      setComment("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancelar suscripción</DialogTitle>
          <DialogDescription>
            Lamentamos que te vayas. Por favor cuéntanos por qué.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-sm">
              Tu servicio seguirá activo hasta el final del periodo actual
              {formattedDate && <strong> ({formattedDate})</strong>}.
              No perderás tus datos ni créditos actuales.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label htmlFor="reason">Razón de cancelación *</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger id="reason">
                <SelectValue placeholder="Selecciona una razón" />
              </SelectTrigger>
              <SelectContent>
                {CANCELLATION_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">
              Comentarios adicionales <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Cuéntanos más sobre tu experiencia o cómo podemos mejorar..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Mantener suscripción
          </Button>
          <Button
            variant="destructive"
            onClick={handleCancel}
            disabled={isLoading || !reason}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar cancelación
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
