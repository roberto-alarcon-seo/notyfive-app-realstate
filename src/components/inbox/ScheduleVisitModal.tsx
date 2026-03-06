import { useState, useEffect } from "react";
import { CalendarPlus, Building, User, CreditCard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateEvent } from "@/hooks/useEvents";
import { useCreateFollowup } from "@/hooks/useFollowups";
import { useProperties } from "@/hooks/useProperties";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { localDatetimeToTimezoneISO } from "@/lib/timezoneUtils";

const CREDIT_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: "INFONAVIT", label: "Infonavit" },
  { value: "COFINAVIT", label: "Cofinavit" },
  { value: "FOVISSSTE", label: "Fovissste" },
  { value: "ISFAM", label: "ISFAM" },
  { value: "CFE", label: "CFE" },
  { value: "BANK", label: "Bancario" },
  { value: "CASH", label: "Contado" },
];

interface ScheduleVisitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contactName: string;
  conversationId: string;
  propertyInterestId?: string | null;
  contactCreditType?: string | null;
}


export function ScheduleVisitModal({
  open,
  onOpenChange,
  contactId,
  contactName,
  conversationId,
  propertyInterestId,
  contactCreditType,
}: ScheduleVisitModalProps) {
  const createEvent = useCreateEvent();
  const createFollowup = useCreateFollowup();
  const { data: properties = [] } = useProperties();

  const [clientName, setClientName] = useState(contactName);
  const [startAt, setStartAt] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState(propertyInterestId || "none");
  const [selectedCreditType, setSelectedCreditType] = useState(contactCreditType || "none");
  const [notes, setNotes] = useState("");

  // Sync property interest when modal opens or prop changes
  useEffect(() => {
    if (open) {
      setClientName(contactName);
      setSelectedPropertyId(propertyInterestId || "none");
      setSelectedCreditType(contactCreditType || "none");
      setStartAt("");
      setNotes("");
    }
  }, [open, contactName, propertyInterestId, contactCreditType]);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setClientName(contactName);
      setStartAt("");
      setSelectedPropertyId(propertyInterestId || "none");
      setSelectedCreditType(contactCreditType || "none");
      setNotes("");
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = async () => {
    if (!startAt) return;

    const trimmedName = clientName.trim();
    if (!trimmedName) {
      toast.error("El nombre del cliente es requerido");
      return;
    }

    // Convert datetime-local to timezone-aware ISO string
    const startISO = localDatetimeToTimezoneISO(startAt);
    const startDate = new Date(startISO);
    const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
    const endISO = endDate.toISOString();

    const metadata: Record<string, string> = {};
    if (selectedPropertyId && selectedPropertyId !== "none") {
      const property = properties.find((p) => p.id === selectedPropertyId);
      if (property) {
        metadata.property_id = property.id;
        metadata.property_title = property.title;
        metadata.property_code = property.property_code || "";
      }
    }

    // Update contact fields if changed (name, credit type) + always set pipeline to visit_scheduled
    const contactUpdates: Record<string, unknown> = {
      pipeline_stage: 'visit_scheduled',
    };
    if (trimmedName !== contactName) {
      contactUpdates.name = trimmedName;
    }
    const newCreditType = selectedCreditType !== "none" ? selectedCreditType : null;
    if (newCreditType !== (contactCreditType || null)) {
      contactUpdates.re_credit_type = newCreditType;
    }

    const { error: updateError } = await supabase
      .from("contacts")
      .update(contactUpdates)
      .eq("id", contactId);

    if (updateError) {
      toast.error(`Error al actualizar contacto: ${updateError.message}`);
      return;
    }

    // Create the appointment
    const event = await createEvent.mutateAsync({
      contact_id: contactId,
      event_type: "visita",
      title: `Visita - ${trimmedName}`,
      start_at: startISO,
      end_at: endISO,
      status: "scheduled",
      source: "manual",
      notes: notes || undefined,
      metadata,
    });

    // Log visit_scheduled activity
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user?.id ?? '')
        .single();

      if (profile?.tenant_id) {
        await supabase.from('conversation_activity').insert({
          tenant_id: profile.tenant_id,
          conversation_id: conversationId,
          contact_id: contactId,
          actor_user_id: user?.id ?? null,
          actor_type: 'user',
          event_type: 'visit_scheduled',
          payload: {
            event_id: event.id,
            start_at: startISO,
            title: `Visita - ${trimmedName}`,
            property_id: selectedPropertyId !== "none" ? selectedPropertyId : null,
            notes: notes || null,
          },
        });
      }
    } catch (e) {
      console.warn('Failed to log visit_scheduled activity:', e);
    }

    // Create followup 24hrs before the visit
    const followupDate = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
    // If the followup would be in the past, set it to now
    const followupDueAt = followupDate > new Date() ? followupDate.toISOString() : new Date().toISOString();

    try {
      await createFollowup.mutateAsync({
        conversation_id: conversationId,
        contact_id: contactId,
        due_at: followupDueAt,
        note: "Confirmar visita del cliente",
      });
    } catch {
      // Don't block the flow if followup creation fails
      console.warn("No se pudo crear el seguimiento automático");
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarPlus className="h-5 w-5 text-primary" />
            Agendar cita
          </DialogTitle>
          <DialogDescription>
            Programa una visita para <span className="font-medium text-foreground">{contactName}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Client Name - First field */}
          <div className="space-y-2">
            <Label htmlFor="visit-client-name" className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" />
              Nombre del cliente
            </Label>
            <Input
              id="visit-client-name"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Nombre completo del cliente"
            />
            <p className="text-xs text-muted-foreground">
              Se actualizará el nombre en la ficha del contacto
            </p>
          </div>

          {/* Date/Time */}
          <div className="space-y-2">
            <Label htmlFor="visit-start">Fecha y hora</Label>
            <Input
              id="visit-start"
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              La cita tendrá una duración de 1 hora
            </p>
          </div>

          {/* Property selector */}
          {properties.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5" />
                Inmueble
              </Label>
              <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar inmueble" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin inmueble</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.property_code ? `[${p.property_code}] ` : ""}{p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Credit Type selector */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5" />
              Tipo de crédito (opcional)
            </Label>
            <Select value={selectedCreditType} onValueChange={setSelectedCreditType}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo de crédito" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                {CREDIT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se actualizará en la ficha del contacto si se modifica
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="visit-notes">Comentarios (opcional)</Label>
            <Textarea
              id="visit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Dirección, indicaciones, observaciones..."
              className="resize-none min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!startAt || !clientName.trim() || createEvent.isPending}
          >
            <CalendarPlus className="h-4 w-4 mr-2" />
            {createEvent.isPending ? "Agendando..." : "Agendar cita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
