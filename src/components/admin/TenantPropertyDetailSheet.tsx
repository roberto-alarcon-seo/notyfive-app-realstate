import { useEffect, useState } from 'react';
import { Loader2, Lock, ExternalLink, Image as ImageIcon, Sparkles, HelpCircle, Building2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface TenantPropertyDetailSheetProps {
  propertyId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  managedExternally?: boolean;
}

interface PropertyDetail {
  id: string;
  property_code: string;
  title: string;
  zone: string | null;
  address: string | null;
  operation_type: string;
  property_type: string | null;
  status: string;
  is_active: boolean;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  sq_meters: number | null;
  maintenance_fee: number | null;
  visit_availability: string | null;
  accepted_credits: string[] | null;
  youtube_url: string | null;
  ai_prompt: string | null;
  ai_description_template: string | null;
  internal_notes: string | null;
  created_at: string;
}

interface PropertyImage {
  id: string;
  file_url: string;
  is_cover: boolean;
  sort_order: number;
  source: string;
}

interface PropertyFaq {
  id: string;
  question: string;
  answer: string;
  sort_order: number;
  source: string;
}

const operationLabels: Record<string, string> = {
  sale: 'Venta',
  rent: 'Renta',
  preventa: 'Preventa',
};

const statusLabels: Record<string, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
  rented: 'Rentado',
  inactive: 'Inactivo',
};

const creditLabels: Record<string, string> = {
  infonavit: 'Infonavit',
  fovissste: 'Fovissste',
  bancario: 'Bancario',
  contado: 'Contado',
  cofinavit: 'Cofinavit',
  fhipo: 'FHipo',
  isssteleon: 'ISSSTELEÓN',
};

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency || 'MXN',
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${currency} ${price.toLocaleString('es-MX')}`;
  }
}

export function TenantPropertyDetailSheet({
  propertyId,
  open,
  onOpenChange,
  managedExternally,
}: TenantPropertyDetailSheetProps) {
  const [loading, setLoading] = useState(false);
  const [property, setProperty] = useState<PropertyDetail | null>(null);
  const [images, setImages] = useState<PropertyImage[]>([]);
  const [faqs, setFaqs] = useState<PropertyFaq[]>([]);

  useEffect(() => {
    if (!open || !propertyId) return;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const [propRes, imgRes, faqRes] = await Promise.all([
          supabase.from('properties').select('*').eq('id', propertyId).maybeSingle(),
          supabase
            .from('property_images')
            .select('id, file_url, is_cover, sort_order, source')
            .eq('property_id', propertyId)
            .order('sort_order', { ascending: true }),
          supabase
            .from('property_faq')
            .select('id, question, answer, sort_order, source')
            .eq('property_id', propertyId)
            .order('sort_order', { ascending: true }),
        ]);

        if (cancelled) return;
        if (propRes.error) throw propRes.error;
        setProperty(propRes.data as PropertyDetail);
        setImages((imgRes.data ?? []) as PropertyImage[]);
        setFaqs((faqRes.data ?? []) as PropertyFaq[]);
      } catch (err) {
        console.error('Error loading property detail:', err);
        toast.error('No se pudo cargar el detalle de la propiedad');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [open, propertyId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <SheetTitle className="truncate text-base">
                {property?.title ?? 'Detalle de propiedad'}
              </SheetTitle>
              <SheetDescription className="text-xs">
                {property
                  ? `${property.property_code}${property.zone ? ` · ${property.zone}` : ''}`
                  : 'Cargando información sincronizada…'}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">
            {loading || !property ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {managedExternally && (
                  <div className="rounded-lg border border-accent/40 bg-accent/10 p-3 flex items-start gap-2.5">
                    <Lock className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    <div className="text-xs">
                      <p className="font-medium text-foreground">Gestionado por el Core</p>
                      <p className="text-muted-foreground">
                        Este detalle es de solo lectura. La fuente de verdad es el sistema externo.
                      </p>
                    </div>
                  </div>
                )}

                {/* Resumen Técnico */}
                <section className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Resumen técnico</h3>
                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                        {operationLabels[property.operation_type] ?? property.operation_type}
                      </Badge>
                      {property.property_type && property.property_type.trim().length > 0 && (
                        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                          {property.property_type}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <SpecCell label="Precio" value={formatPrice(property.price, property.currency)} />
                    <SpecCell label="Estatus" value={statusLabels[property.status] ?? property.status} />
                    <SpecCell label="Recámaras" value={property.bedrooms ?? '—'} />
                    <SpecCell label="Baños" value={property.bathrooms ?? '—'} />
                    <SpecCell label="Estac." value={property.parking_spots ?? '—'} />
                    <SpecCell label="m²" value={property.sq_meters ?? '—'} />
                    <SpecCell
                      label="Mantenim."
                      value={
                        property.maintenance_fee != null
                          ? formatPrice(property.maintenance_fee, property.currency)
                          : '—'
                      }
                    />
                    <SpecCell
                      label="Tipo"
                      value={
                        property.property_type && property.property_type.trim().length > 0
                          ? property.property_type
                          : 'No especificado'
                      }
                    />
                  </div>

                  {/* Galería */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Galería de imágenes ({images.length})
                    </p>
                    {images.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border p-6 flex flex-col items-center text-muted-foreground">
                        <ImageIcon className="h-6 w-6 opacity-50 mb-1" />
                        <p className="text-xs">Sin imágenes sincronizadas</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {images.map((img) => (
                          <a
                            key={img.id}
                            href={img.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted group"
                          >
                            <img
                              src={img.file_url}
                              alt=""
                              loading="lazy"
                              className="w-full h-full object-cover transition-transform group-hover:scale-105"
                            />
                            {img.is_cover && (
                              <Badge className="absolute top-1 left-1 text-[9px] uppercase tracking-wider bg-primary/90 text-primary-foreground border-0">
                                Cover
                              </Badge>
                            )}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* YouTube */}
                  {property.youtube_url && (
                    <a
                      href={property.youtube_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm text-primary hover:underline"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Ver video en YouTube
                    </a>
                  )}
                </section>

                <Separator />

                {/* Conocimiento IA */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Conocimiento IA — FAQs ({faqs.length})
                    </h3>
                  </div>
                  {faqs.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No hay preguntas frecuentes registradas para esta propiedad.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {faqs.map((faq) => (
                        <div
                          key={faq.id}
                          className="rounded-lg border border-border bg-card p-3 space-y-1.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-medium text-foreground">{faq.question}</p>
                            {faq.source !== 'manual' && (
                              <Badge
                                variant="outline"
                                className="text-[9px] uppercase tracking-wider border-accent/40 text-accent shrink-0"
                              >
                                {faq.source}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                            {faq.answer}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <Separator />

                {/* Prompt Maestro */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Prompt maestro IA</h3>
                  </div>
                  {property.ai_description_template ? (
                    <pre className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                      {property.ai_description_template}
                    </pre>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Sin prompt personalizado. La IA usará la plantilla por defecto del tenant.
                    </p>
                  )}
                  {property.ai_prompt && property.ai_prompt !== property.ai_description_template && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        Ai_prompt (legacy)
                      </p>
                      <pre className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                        {property.ai_prompt}
                      </pre>
                    </div>
                  )}
                </section>

                <Separator />

                {/* Metadata */}
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-foreground">Metadata</h3>

                  <MetaRow label="Dirección" value={property.address ?? '—'} />
                  <MetaRow
                    label="Disponibilidad de visita"
                    value={property.visit_availability ?? '—'}
                  />
                  <MetaRow
                    label="Notas internas"
                    value={property.internal_notes ?? '—'}
                  />

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                      Créditos aceptados
                    </p>
                    {property.accepted_credits && property.accepted_credits.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {property.accepted_credits.map((c) => (
                          <Badge key={c} variant="secondary" className="capitalize">
                            {creditLabels[c.toLowerCase()] ?? c}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                  </div>

                  <MetaRow
                    label="Creado"
                    value={new Date(property.created_at).toLocaleString('es-MX', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                  <MetaRow label="ID interno" value={<span className="font-mono">{property.id}</span>} />
                </section>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function SpecCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-0.5">{value}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-foreground text-right break-words">{value}</span>
    </div>
  );
}