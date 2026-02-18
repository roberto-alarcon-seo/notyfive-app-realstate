import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { localDatetimeToTimezoneISO } from "@/lib/timezoneUtils";
import { Check, ChevronsUpDown, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Event, useCreateEvent, useUpdateEvent, useEventTypes, DEFAULT_EVENT_TYPES } from "@/hooks/useEvents";
import { useContacts } from "@/hooks/useContacts";

const eventSchema = z.object({
  contact_id: z.string().min(1, "Selecciona un contacto"),
  event_type: z.string().min(1, "Selecciona un tipo"),
  title: z.string().min(1, "El título es requerido"),
  start_at: z.string().min(1, "La fecha de inicio es requerida"),
  end_at: z.string().optional(),
  status: z.enum(['scheduled', 'confirmed', 'canceled', 'completed', 'no_show']),
  notes: z.string().optional(),
});

type EventFormData = z.infer<typeof eventSchema>;

interface MetadataField {
  key: string;
  value: string;
}

interface EventDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: Event | null;
}

// Usamos DEFAULT_EVENT_TYPES importado de useEvents

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'Programado' },
  { value: 'confirmed', label: 'Confirmado' },
  { value: 'canceled', label: 'Cancelado' },
  { value: 'completed', label: 'Completado' },
  { value: 'no_show', label: 'No asistió' },
];

export function EventDrawer({ open, onOpenChange, event }: EventDrawerProps) {
  const isEditing = !!event;
  const createEvent = useCreateEvent();
  const updateEvent = useUpdateEvent();
  const { contacts } = useContacts();
  const { data: eventTypes = [] } = useEventTypes();

  const [contactOpen, setContactOpen] = useState(false);

  // Merge default types with custom ones from DB
  const allEventTypes = [
    ...DEFAULT_EVENT_TYPES,
    ...eventTypes
      .filter(t => !DEFAULT_EVENT_TYPES.some(d => d.value === t))
      .map(t => ({ value: t, label: t }))
  ];

  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);
  const [customEventType, setCustomEventType] = useState("");

  const form = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      contact_id: "",
      event_type: "cita",
      title: "",
      start_at: "",
      end_at: "",
      status: "scheduled",
      notes: "",
    },
  });

  useEffect(() => {
    if (event) {
      form.reset({
        contact_id: event.contact_id,
        event_type: event.event_type,
        title: event.title,
        start_at: format(new Date(event.start_at), "yyyy-MM-dd'T'HH:mm"),
        end_at: event.end_at ? format(new Date(event.end_at), "yyyy-MM-dd'T'HH:mm") : "",
        status: event.status,
        notes: event.notes || "",
      });
      // Load metadata
      const fields = Object.entries(event.metadata || {}).map(([key, value]) => ({
        key,
        value: String(value),
      }));
      setMetadataFields(fields.length > 0 ? fields : []);
    } else {
      form.reset({
        contact_id: "",
        event_type: "cita",
        title: "",
        start_at: "",
        end_at: "",
        status: "scheduled",
        notes: "",
      });
      setMetadataFields([]);
    }
  }, [event, form]);

  const onSubmit = async (data: EventFormData) => {
    const metadata: Record<string, string> = {};
    metadataFields.forEach(field => {
      if (field.key.trim()) {
        metadata[field.key.trim()] = field.value;
      }
    });

    const eventType = customEventType || data.event_type;

    // Convert datetime-local to timezone-aware ISO
    const startISO = localDatetimeToTimezoneISO(data.start_at);
    const endISO = data.end_at ? localDatetimeToTimezoneISO(data.end_at) : null;

    if (isEditing && event) {
      await updateEvent.mutateAsync({ 
        id: event.id,
        contact_id: data.contact_id,
        event_type: eventType,
        title: data.title,
        start_at: startISO,
        end_at: endISO,
        status: data.status,
        notes: data.notes || null,
        metadata,
      });
    } else {
      await createEvent.mutateAsync({
        contact_id: data.contact_id,
        event_type: eventType,
        title: data.title,
        start_at: startISO,
        end_at: endISO,
        status: data.status,
        notes: data.notes || null,
        metadata,
      });
    }
    onOpenChange(false);
  };

  const addMetadataField = () => {
    setMetadataFields(prev => [...prev, { key: "", value: "" }]);
  };

  const removeMetadataField = (index: number) => {
    setMetadataFields(prev => prev.filter((_, i) => i !== index));
  };

  const updateMetadataField = (index: number, field: Partial<MetadataField>) => {
    setMetadataFields(prev => prev.map((f, i) => i === index ? { ...f, ...field } : f));
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Editar evento" : "Crear evento"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Modifica los detalles del evento" : "Completa los detalles para crear un nuevo evento"}
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
            {/* Contact - Searchable */}
            <FormField
              control={form.control}
              name="contact_id"
              render={({ field }) => {
                const selectedContact = contacts.find(c => c.id === field.value);
                return (
                  <FormItem className="flex flex-col">
                    <FormLabel>Contacto *</FormLabel>
                    <Popover open={contactOpen} onOpenChange={setContactOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={contactOpen}
                            className={cn(
                              "w-full justify-between font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {selectedContact
                              ? `${selectedContact.name}${selectedContact.phone ? ` (${selectedContact.phone})` : ''}`
                              : "Buscar contacto..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Buscar por nombre o teléfono..." />
                          <CommandList>
                            <CommandEmpty>No se encontraron contactos.</CommandEmpty>
                            <CommandGroup>
                              {contacts.map(contact => (
                                <CommandItem
                                  key={contact.id}
                                  value={`${contact.name} ${contact.phone || ''}`}
                                  onSelect={() => {
                                    field.onChange(contact.id);
                                    setContactOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === contact.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  {contact.name}
                                  {contact.phone && (
                                    <span className="ml-2 text-muted-foreground text-sm">
                                      {contact.phone}
                                    </span>
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />

            {/* Event Type */}
            <FormField
              control={form.control}
              name="event_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de evento *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {allEventTypes.map(type => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="O escribe un tipo personalizado..."
                    value={customEventType}
                    onChange={(e) => setCustomEventType(e.target.value)}
                    className="mt-2"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ej: Cita de revisión" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Inicio *</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="end_at"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fin (opcional)</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estado</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {STATUS_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notas</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Notas adicionales..." 
                      className="resize-none"
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Metadata (Custom Fields) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>Campos adicionales</FormLabel>
                <Button type="button" variant="outline" size="sm" onClick={addMetadataField}>
                  <Plus className="w-3 h-3 mr-1" />
                  Agregar
                </Button>
              </div>
              {metadataFields.map((field, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Nombre"
                    value={field.key}
                    onChange={(e) => updateMetadataField(index, { key: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Valor"
                    value={field.value}
                    onChange={(e) => updateMetadataField(index, { value: e.target.value })}
                    className="flex-1"
                  />
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon"
                    onClick={() => removeMetadataField(index)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {metadataFields.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Agrega campos como: ubicación, sucursal, nombre del proveedor, etc.
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={createEvent.isPending || updateEvent.isPending}
              >
                {isEditing ? "Guardar cambios" : "Crear evento"}
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}
