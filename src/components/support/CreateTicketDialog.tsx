import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSupportTickets, TicketCategory, TicketPriority } from '@/hooks/useSupportTickets';
import { SupportImageUploader } from './SupportImageUploader';

const formSchema = z.object({
  subject: z.string().min(5, 'El asunto debe tener al menos 5 caracteres').max(200),
  category: z.enum(['bug', 'campaign_error', 'billing', 'whatsapp_twilio', 'ux_ui', 'other']),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  description: z.string().min(20, 'La descripción debe tener al menos 20 caracteres').max(5000),
});

type FormData = z.infer<typeof formSchema>;

interface UploadedFile {
  file: File;
  preview: string;
  uploading?: boolean;
}

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const categories: { value: TicketCategory; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'campaign_error', label: 'Error en campañas' },
  { value: 'billing', label: 'Facturación' },
  { value: 'whatsapp_twilio', label: 'WhatsApp (Conexión / Mensajes)' },
  { value: 'ux_ui', label: 'UX / UI' },
  { value: 'other', label: 'Otro' },
];

const priorities: { value: TicketPriority; label: string; description: string }[] = [
  { value: 'low', label: 'Baja', description: 'Objetivo: respuesta en 48h' },
  { value: 'medium', label: 'Media', description: 'Objetivo: respuesta en 24h' },
  { value: 'high', label: 'Alta', description: 'Objetivo: respuesta en 12h' },
  { value: 'critical', label: 'Crítica', description: 'Objetivo: respuesta en 4h' },
];

export function CreateTicketDialog({ open, onOpenChange }: CreateTicketDialogProps) {
  const { createTicket, isCreating } = useSupportTickets();
  const [attachments, setAttachments] = useState<UploadedFile[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: '',
      category: 'other',
      priority: 'medium',
      description: '',
    },
  });

  const onSubmit = async (values: FormData) => {
    const files = attachments.map(a => a.file);
    
    await createTicket({
      subject: values.subject,
      category: values.category,
      priority: values.priority,
      description: values.description,
      attachments: files.length > 0 ? files : undefined,
    });
    
    // Cleanup previews
    attachments.forEach(a => URL.revokeObjectURL(a.preview));
    setAttachments([]);
    form.reset();
    onOpenChange(false);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      attachments.forEach(a => URL.revokeObjectURL(a.preview));
      setAttachments([]);
      form.reset();
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear nuevo ticket</DialogTitle>
          <DialogDescription>
            Describe tu problema o solicitud. Nuestro equipo te responderá lo antes posible.
            Si es posible, incluye capturas de pantalla y pasos para reproducir el problema.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Subject */}
            <FormField
              control={form.control}
              name="subject"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Asunto</FormLabel>
                  <FormControl>
                    <Input placeholder="Resumen breve del problema" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Categoría</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona una categoría" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Priority */}
            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prioridad</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-3"
                    >
                      {priorities.map((priority) => (
                        <label
                          key={priority.value}
                          className={`
                            flex items-center gap-3 p-3 rounded-lg border cursor-pointer
                            transition-colors hover:bg-secondary
                            ${field.value === priority.value ? 'border-primary bg-primary/5' : 'border-border'}
                          `}
                        >
                          <RadioGroupItem value={priority.value} />
                          <div>
                            <p className="font-medium text-sm">{priority.label}</p>
                            <p className="text-xs text-muted-foreground">{priority.description}</p>
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descripción</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe el problema con el mayor detalle posible. Incluye pasos para reproducir el error si aplica."
                      className="min-h-[150px] resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Adjuntar imágenes (opcional)
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Puedes subir capturas de pantalla para darnos más contexto.
              </p>
              <SupportImageUploader
                files={attachments}
                onChange={setAttachments}
                maxFiles={5}
                maxSizeMB={8}
                disabled={isCreating}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => handleClose(false)}
                disabled={isCreating}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Enviar ticket
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}