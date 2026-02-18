import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { 
  ArrowLeft, Loader2, Save, User, Settings2, X, MessageSquare, Activity, 
  FolderOpen, TrendingUp, DollarSign, Home, Phone, Mail, MapPin
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useContacts, ContactFormData, CustomField, CustomFieldOption } from "@/hooks/useContacts";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { ContactActivityTimeline } from "@/components/contacts/ContactActivityTimeline";
import ConsentBadge from "@/components/contacts/ConsentBadge";
import { LeadPriorityCard } from "@/components/contacts/LeadPriorityCard";
import { RealEstateCreditCard } from "@/components/contacts/RealEstateCreditCard";
import { RealEstatePreferencesCard } from "@/components/contacts/RealEstatePreferencesCard";
import { LeadContextPanel } from "@/components/contacts/LeadContextPanel";
import { LeadDiagnosticsCard } from "@/components/contacts/LeadDiagnosticsCard";
import { PropertyInterestCard } from "@/components/contacts/PropertyInterestCard";
import { cn } from "@/lib/utils";

// Section navigation items
const SECTIONS = [
  { id: 'general', label: 'Información general', icon: User },
  { id: 'lead', label: 'Prioridad del lead', icon: TrendingUp },
  { id: 'credit', label: 'Crédito y capacidad', icon: DollarSign },
  { id: 'preferences', label: 'Preferencias de búsqueda', icon: Home },
  { id: 'custom', label: 'Campos personalizados', icon: Settings2 },
  { id: 'activity', label: 'Historial / Actividad', icon: Activity },
];

// Reusable component for rendering custom field inputs
function CustomFieldInput({ 
  field, 
  value, 
  options, 
  onChange 
}: { 
  field: CustomField; 
  value: string; 
  options: CustomFieldOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.key}>
        {field.name}
        {field.is_required && <span className="text-destructive ml-1">*</span>}
      </Label>
      {field.data_type === 'long_text' ? (
        <Textarea
          id={field.key}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
        />
      ) : field.data_type === 'boolean' ? (
        <div className="flex items-center gap-2 h-10">
          <Checkbox
            id={field.key}
            checked={value === 'true'}
            onCheckedChange={(checked) => onChange(checked ? 'true' : 'false')}
          />
          <Label htmlFor={field.key} className="text-sm font-normal">Sí</Label>
        </div>
      ) : field.data_type === 'select' ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona una opción" />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => (
              <SelectItem key={option.id} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          id={field.key}
          type={field.data_type === 'number' || field.data_type === 'decimal' ? 'number' : 
                field.data_type === 'date' ? 'date' : 
                field.data_type === 'datetime' ? 'datetime-local' :
                field.data_type === 'url' ? 'url' : 'text'}
          step={field.data_type === 'decimal' ? '0.01' : undefined}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </div>
  );
}

export default function ContactEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const fromConversationId = searchParams.get('from_conversation');
  const isMobile = useIsMobile();
  const { hasRole } = useAuth();
  const { 
    contacts, 
    customFields, 
    customFieldOptions,
    loading, 
    createContact, 
    updateContact 
  } = useContacts();

  const [isSaving, setIsSaving] = useState(false);
  const [activeSection, setActiveSection] = useState('general');
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    country: '',
    tags: [],
    notes: '',
    custom_fields: {},
    lead_score: 0,
    lead_temperature: 'cold',
    engagement_level: 'low',
    source: '',
    opt_in_status: 'unknown',
    next_action_at: '',
    pipeline_stage: 'new_lead',
    operational_status: 'ACTIVE',
    re_budget_estimated_mxn: null,
    re_credit_type: null,
    re_credit_preapproved: false,
    re_down_payment_mxn: null,
    re_monthly_income_mxn: null,
    re_property_types: [],
    re_bedrooms: null,
    re_bathrooms: null,
    re_parking_spots: null,
    re_requires_parking: false,
    re_zones: [],
    re_amenities: [],
    re_accepts_pets: false,
    re_reason: null,
    re_current_situation: null,
    re_property_interest_id: null,
    re_block_reason: null,
    re_visit_outcome: null,
  });
  const [tagInput, setTagInput] = useState('');

  const isEditing = !!id;
  const canManageContacts = hasRole(['administrador', 'manager']);

  // Group custom fields by category
  const fieldsByCategory = useMemo(() => {
    const grouped: Record<string, typeof customFields> = {};
    const uncategorized: typeof customFields = [];
    
    customFields.forEach(field => {
      if (field.category) {
        if (!grouped[field.category]) {
          grouped[field.category] = [];
        }
        grouped[field.category].push(field);
      } else {
        uncategorized.push(field);
      }
    });
    
    return { grouped, uncategorized };
  }, [customFields]);

  const categoryNames = Object.keys(fieldsByCategory.grouped).sort();

  const handleBack = () => {
    if (fromConversationId) {
      navigate(`/inbox?conversation=${fromConversationId}`);
    } else {
      navigate("/contacts");
    }
  };

  // Load contact data when editing
  useEffect(() => {
    if (isEditing && contacts.length > 0) {
      const contact = contacts.find(c => c.id === id);
      if (contact) {
        const formatDateTime = (dt: string | null) => {
          if (!dt) return '';
          return new Date(dt).toISOString().slice(0, 16);
        };

        setFormData({
          name: contact.name,
          email: contact.email || '',
          phone: contact.phone || '',
          country: contact.country || '',
          tags: contact.tags || [],
          notes: contact.notes || '',
          custom_fields: contact.custom_fields || {},
          lead_score: contact.lead_score ?? 0,
          lead_temperature: contact.lead_temperature ?? 'cold',
          engagement_level: contact.engagement_level ?? 'low',
          source: contact.source || '',
          opt_in_status: contact.opt_in_status ?? 'unknown',
          next_action_at: formatDateTime(contact.next_action_at),
          pipeline_stage: contact.pipeline_stage ?? 'new_lead',
          operational_status: contact.operational_status ?? 'ACTIVE',
          re_budget_estimated_mxn: contact.re_budget_estimated_mxn,
          re_credit_type: contact.re_credit_type,
          re_credit_preapproved: contact.re_credit_preapproved ?? false,
          re_down_payment_mxn: contact.re_down_payment_mxn,
          re_monthly_income_mxn: contact.re_monthly_income_mxn,
          re_property_types: contact.re_property_types || [],
          re_bedrooms: contact.re_bedrooms,
          re_bathrooms: contact.re_bathrooms,
          re_parking_spots: contact.re_parking_spots,
          re_requires_parking: contact.re_requires_parking ?? false,
          re_zones: contact.re_zones || [],
          re_amenities: contact.re_amenities || [],
          re_accepts_pets: contact.re_accepts_pets ?? false,
          re_reason: contact.re_reason,
          re_current_situation: contact.re_current_situation,
          re_property_interest_id: contact.re_property_interest_id ?? null,
          re_block_reason: contact.re_block_reason,
          re_visit_outcome: contact.re_visit_outcome,
        });
      } else {
        toast.error("Contacto no encontrado");
        navigate("/contacts");
      }
    }
  }, [id, contacts, isEditing, navigate]);

  const currentContact = isEditing ? contacts.find(c => c.id === id) : null;
  const lastInteractionAt = currentContact?.last_interaction_at || null;
  const originalPipelineStage = currentContact?.pipeline_stage || 'new_lead';

  const addTag = () => {
    if (tagInput.trim() && !formData.tags?.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...(formData.tags || []), tagInput.trim()],
      });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setFormData({
      ...formData,
      tags: formData.tags?.filter(t => t !== tag) || [],
    });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("El nombre es requerido");
      setActiveSection('general');
      return;
    }

    for (const field of customFields) {
      if (field.is_required && !formData.custom_fields?.[field.key]) {
        toast.error(`El campo "${field.name}" es requerido`);
        setActiveSection('custom');
        return;
      }
    }

    setIsSaving(true);

    try {
      let success = false;
      if (isEditing) {
        // Pass original pipeline stage for conversion tracking
        success = await updateContact(id!, formData, originalPipelineStage);
      } else {
        success = await createContact(formData);
        // Only redirect on new contact creation to continue editing
        if (success) {
          handleBack();
        }
      }
      // For updates, just show toast and stay on the form
    } finally {
      setIsSaving(false);
    }
  };

  // Get temperature badge styling
  const getTemperatureBadge = () => {
    const temp = formData.lead_temperature;
    if (temp === 'hot') return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">🔥 Caliente</Badge>;
    if (temp === 'warm') return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">🌡️ Tibio</Badge>;
    return <Badge variant="secondary">❄️ Frío</Badge>;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canManageContacts) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">No tienes permisos para gestionar contactos</p>
      </div>
    );
  }

  // Filter sections for new contacts (no activity tab)
  const availableSections = isEditing ? SECTIONS : SECTIONS.filter(s => s.id !== 'activity');


  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="shrink-0 px-4 md:px-6 py-3 md:py-4 border-b border-border bg-card">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 md:gap-4 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 md:h-10 md:w-10" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              {/* Contact Avatar/Initial */}
              <div className="h-9 w-9 md:h-12 md:w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <span className="text-sm md:text-lg font-semibold text-primary">
                  {formData.name ? formData.name.charAt(0).toUpperCase() : '?'}
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 md:gap-3 flex-wrap">
                  <h1 className="text-base md:text-xl font-bold text-foreground truncate">
                    {formData.name || (isEditing ? 'Sin nombre' : 'Nuevo contacto')}
                  </h1>
                  {getTemperatureBadge()}
                  {formData.lead_score > 0 && (
                    <Badge variant="outline" className="text-xs">
                      Score: {formData.lead_score}
                    </Badge>
                  )}
                </div>
                <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground mt-0.5">
                  {formData.email && (
                    <span className="flex items-center gap-1">
                      <Mail className="h-3 w-3" /> {formData.email}
                    </span>
                  )}
                  {formData.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {formData.phone}
                    </span>
                  )}
                  {formData.country && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {formData.country}
                    </span>
                  )}
                </div>
                {/* Mobile: show phone below name */}
                {isMobile && formData.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" /> {formData.phone}
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            {isEditing && id && formData.phone && !isMobile && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/inbox?contact_id=${id}`)}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Ir a conversación
              </Button>
            )}
            {fromConversationId && !isMobile && (
              <Button variant="outline" size="sm" onClick={handleBack}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Volver al chat
              </Button>
            )}
            {isEditing && id && !isMobile && (
              <ConsentBadge contactId={id} />
            )}
            <Button size={isMobile ? "sm" : "default"} onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {!isMobile && <span className="ml-2">Guardar</span>}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content with Sidebar Navigation */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Mobile: Horizontal scrollable tabs */}
        {isMobile && (
          <div className="shrink-0 border-b border-border bg-muted/30 overflow-x-auto">
            <nav className="flex gap-1 p-2 min-w-max">
              {availableSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        {/* Desktop: Left Sidebar Navigation */}
        <div className="hidden md:block w-56 shrink-0 border-r border-border bg-muted/30">
          <ScrollArea className="h-full">
            <nav className="p-3 space-y-1">
              {availableSections.map((section) => {
                const Icon = section.icon;
                const isActive = activeSection === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                      isActive 
                        ? "bg-primary text-primary-foreground" 
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{section.label}</span>
                  </button>
                );
              })}
            </nav>
          </ScrollArea>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="p-4 md:p-6 max-w-3xl">
            {/* General Information Section */}
            {activeSection === 'general' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Información general</h2>
                  <p className="text-sm text-muted-foreground">Datos básicos del contacto</p>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre *</Label>
                    <Input
                      id="name"
                      placeholder="Nombre completo"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="correo@ejemplo.com"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Teléfono</Label>
                      <Input
                        id="phone"
                        placeholder="+52 55 1234 5678"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="country">País</Label>
                    <Input
                      id="country"
                      placeholder="México"
                      value={formData.country}
                      onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Etiquetas</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nueva etiqueta"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                      />
                      <Button type="button" variant="secondary" onClick={addTag}>
                        Añadir
                      </Button>
                    </div>
                    {formData.tags && formData.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {formData.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="secondary"
                            className="px-2 py-1 flex items-center gap-1"
                          >
                            {tag}
                            <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notas</Label>
                    <Textarea
                      id="notes"
                      placeholder="Notas adicionales sobre el contacto..."
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={4}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Lead Priority Section */}
            {activeSection === 'lead' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Prioridad del lead</h2>
                  <p className="text-sm text-muted-foreground">Campos operativos para segmentar, priorizar y dar seguimiento</p>
                </div>
                
                <LeadPriorityCard
                  data={{
                    lead_score: formData.lead_score ?? 0,
                    lead_temperature: formData.lead_temperature ?? 'cold',
                    engagement_level: formData.engagement_level ?? 'low',
                    source: formData.source ?? '',
                    opt_in_status: formData.opt_in_status ?? 'unknown',
                    next_action_at: formData.next_action_at ?? '',
                    last_interaction_at: lastInteractionAt,
                    pipeline_stage: formData.pipeline_stage ?? 'new_lead',
                    operational_status: formData.operational_status ?? 'ACTIVE',
                  }}
                  onChange={(data) => setFormData({
                    ...formData,
                    lead_score: data.lead_score,
                    lead_temperature: data.lead_temperature,
                    engagement_level: data.engagement_level,
                    source: data.source,
                    opt_in_status: data.opt_in_status,
                    next_action_at: data.next_action_at,
                    pipeline_stage: data.pipeline_stage,
                    operational_status: data.operational_status,
                  })}
                />

                {/* Lead Diagnostics - Block reason & Visit outcome */}
                <div className="pt-4 border-t border-border">
                  <h3 className="text-base font-medium mb-4">Diagnóstico del lead</h3>
                  <LeadDiagnosticsCard
                    data={{
                      pipeline_stage: formData.pipeline_stage ?? 'new_lead',
                      re_block_reason: formData.re_block_reason ?? null,
                      re_visit_outcome: formData.re_visit_outcome ?? null,
                    }}
                    onChange={(data) => setFormData({
                      ...formData,
                      re_block_reason: data.re_block_reason,
                      re_visit_outcome: data.re_visit_outcome,
                    })}
                  />
                </div>
              </div>
            )}

            {/* Real Estate Credit Section */}
            {activeSection === 'credit' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Crédito y capacidad</h2>
                  <p className="text-sm text-muted-foreground">Información financiera básica para calificación</p>
                </div>
                
                <RealEstateCreditCard
                  data={{
                    re_budget_estimated_mxn: formData.re_budget_estimated_mxn ?? null,
                    re_credit_type: formData.re_credit_type ?? null,
                    re_credit_preapproved: formData.re_credit_preapproved ?? false,
                    re_down_payment_mxn: formData.re_down_payment_mxn ?? null,
                    re_monthly_income_mxn: formData.re_monthly_income_mxn ?? null,
                  }}
                  onChange={(data) => setFormData({
                    ...formData,
                    re_budget_estimated_mxn: data.re_budget_estimated_mxn,
                    re_credit_type: data.re_credit_type,
                    re_credit_preapproved: data.re_credit_preapproved,
                    re_down_payment_mxn: data.re_down_payment_mxn,
                    re_monthly_income_mxn: data.re_monthly_income_mxn,
                  })}
                />
              </div>
            )}

            {/* Real Estate Preferences Section */}
            {activeSection === 'preferences' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Preferencias de búsqueda</h2>
                  <p className="text-sm text-muted-foreground">Requisitos y preferencias del inmueble</p>
                </div>

                {/* Property Interest Card */}
                <PropertyInterestCard
                  propertyId={formData.re_property_interest_id ?? null}
                  onChange={(propertyId) => setFormData({
                    ...formData,
                    re_property_interest_id: propertyId,
                  })}
                />
                
                <RealEstatePreferencesCard
                  data={{
                    re_property_types: formData.re_property_types ?? [],
                    re_bedrooms: formData.re_bedrooms ?? null,
                    re_bathrooms: formData.re_bathrooms ?? null,
                    re_parking_spots: formData.re_parking_spots ?? null,
                    re_requires_parking: formData.re_requires_parking ?? false,
                    re_zones: formData.re_zones ?? [],
                    re_amenities: formData.re_amenities ?? [],
                    re_accepts_pets: formData.re_accepts_pets ?? false,
                    re_reason: formData.re_reason ?? null,
                    re_current_situation: formData.re_current_situation ?? null,
                  }}
                  onChange={(data) => setFormData({
                    ...formData,
                    re_property_types: data.re_property_types,
                    re_bedrooms: data.re_bedrooms,
                    re_bathrooms: data.re_bathrooms,
                    re_parking_spots: data.re_parking_spots,
                    re_requires_parking: data.re_requires_parking,
                    re_zones: data.re_zones,
                    re_amenities: data.re_amenities,
                    re_accepts_pets: data.re_accepts_pets,
                    re_reason: data.re_reason,
                    re_current_situation: data.re_current_situation,
                  })}
                />
              </div>
            )}

            {/* Custom Fields Section */}
            {activeSection === 'custom' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Campos personalizados</h2>
                  <p className="text-sm text-muted-foreground">
                    Información adicional definida por tu equipo
                  </p>
                </div>
                
                {customFields.length === 0 ? (
                  <Card>
                    <CardContent className="py-12">
                      <div className="text-center text-muted-foreground">
                        <Settings2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p className="font-medium">No hay campos personalizados</p>
                        <p className="text-sm mt-1">Puedes crearlos desde Configuración</p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="mt-4" 
                          onClick={() => navigate('/settings/contact-fields')}
                        >
                          Crear campo
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : categoryNames.length === 0 ? (
                  <div className="space-y-4">
                    {customFields.map((field) => (
                      <CustomFieldInput 
                        key={field.id} 
                        field={field} 
                        value={formData.custom_fields?.[field.key] || ''} 
                        options={customFieldOptions[field.id] || []}
                        onChange={(val) => setFormData({
                          ...formData,
                          custom_fields: { ...formData.custom_fields, [field.key]: val }
                        })}
                      />
                    ))}
                  </div>
                ) : (
                  <Tabs defaultValue={categoryNames[0] || 'general'} className="w-full">
                    <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
                      {categoryNames.map(cat => (
                        <TabsTrigger key={cat} value={cat} className="flex items-center gap-1 text-xs">
                          <FolderOpen className="h-3 w-3" />
                          {cat}
                          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                            {fieldsByCategory.grouped[cat].length}
                          </Badge>
                        </TabsTrigger>
                      ))}
                      {fieldsByCategory.uncategorized.length > 0 && (
                        <TabsTrigger value="general" className="flex items-center gap-1 text-xs">
                          General
                          <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                            {fieldsByCategory.uncategorized.length}
                          </Badge>
                        </TabsTrigger>
                      )}
                    </TabsList>
                    
                    {categoryNames.map(cat => (
                      <TabsContent key={cat} value={cat} className="mt-0 space-y-4">
                        {fieldsByCategory.grouped[cat].map((field) => (
                          <CustomFieldInput 
                            key={field.id} 
                            field={field} 
                            value={formData.custom_fields?.[field.key] || ''} 
                            options={customFieldOptions[field.id] || []}
                            onChange={(val) => setFormData({
                              ...formData,
                              custom_fields: { ...formData.custom_fields, [field.key]: val }
                            })}
                          />
                        ))}
                      </TabsContent>
                    ))}
                    
                    {fieldsByCategory.uncategorized.length > 0 && (
                      <TabsContent value="general" className="mt-0 space-y-4">
                        {fieldsByCategory.uncategorized.map((field) => (
                          <CustomFieldInput 
                            key={field.id} 
                            field={field} 
                            value={formData.custom_fields?.[field.key] || ''} 
                            options={customFieldOptions[field.id] || []}
                            onChange={(val) => setFormData({
                              ...formData,
                              custom_fields: { ...formData.custom_fields, [field.key]: val }
                            })}
                          />
                        ))}
                      </TabsContent>
                    )}
                  </Tabs>
                )}
              </div>
            )}

            {/* Activity Timeline Section */}
            {activeSection === 'activity' && isEditing && id && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-semibold mb-1">Historial / Actividad</h2>
                  <p className="text-sm text-muted-foreground">Interacciones y eventos relacionados con este contacto</p>
                </div>
                
                <ContactActivityTimeline contactId={id} />
              </div>
            )}
          </div>
        </div>

        {/* Persistent Lead Context Panel - Right Side */}
        <LeadContextPanel
          data={{
            lead_score: formData.lead_score ?? 0,
            lead_temperature: (formData.lead_temperature ?? 'cold') as 'cold' | 'warm' | 'hot',
            engagement_level: (formData.engagement_level ?? 'low') as 'low' | 'medium' | 'high',
            opt_in_status: (formData.opt_in_status ?? 'unknown') as 'unknown' | 'opt_in' | 'opt_out',
            next_action_at: formData.next_action_at || null,
            last_interaction_at: lastInteractionAt,
            re_budget_estimated_mxn: formData.re_budget_estimated_mxn,
            re_credit_preapproved: formData.re_credit_preapproved ?? false,
            re_credit_type: formData.re_credit_type,
            pipeline_stage: formData.pipeline_stage ?? 'new_lead',
            operational_status: formData.operational_status ?? 'ACTIVE',
            re_block_reason: formData.re_block_reason ?? null,
            re_visit_outcome: formData.re_visit_outcome ?? null,
          }}
        />
      </div>
    </div>
  );
}
