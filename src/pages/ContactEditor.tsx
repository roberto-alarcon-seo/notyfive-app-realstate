import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save, User, Settings2, X, MessageSquare, Activity, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { LeadPriorityCard, LeadPriorityData } from "@/components/contacts/LeadPriorityCard";
import { RealEstateCreditCard, RealEstateCreditData } from "@/components/contacts/RealEstateCreditCard";
import { RealEstatePreferencesCard, RealEstatePreferencesData } from "@/components/contacts/RealEstatePreferencesCard";

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
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    country: '',
    tags: [],
    notes: '',
    custom_fields: {},
    // Universal fixed fields
    lead_score: 0,
    lead_temperature: 'cold',
    engagement_level: 'low',
    source: '',
    opt_in_status: 'unknown',
    next_action_at: '',
    // Real Estate fixed fields
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
  });
  const [tagInput, setTagInput] = useState('');

  const isEditing = !!id;
  const canManageContacts = hasRole(['owner', 'marketer']);

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
        // Format datetime for input
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
          // Universal fixed fields
          lead_score: contact.lead_score ?? 0,
          lead_temperature: contact.lead_temperature ?? 'cold',
          engagement_level: contact.engagement_level ?? 'low',
          source: contact.source || '',
          opt_in_status: contact.opt_in_status ?? 'unknown',
          next_action_at: formatDateTime(contact.next_action_at),
          // Real Estate fixed fields
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
        });
      } else {
        toast.error("Contacto no encontrado");
        navigate("/contacts");
      }
    }
  }, [id, contacts, isEditing, navigate]);

  // Get last_interaction_at from the contact being edited
  const currentContact = isEditing ? contacts.find(c => c.id === id) : null;
  const lastInteractionAt = currentContact?.last_interaction_at || null;

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
      return;
    }

    // Validate required custom fields
    for (const field of customFields) {
      if (field.is_required && !formData.custom_fields?.[field.key]) {
        toast.error(`El campo "${field.name}" es requerido`);
        return;
      }
    }

    setIsSaving(true);

    try {
      let success = false;
      if (isEditing) {
        success = await updateContact(id!, formData);
      } else {
        success = await createContact(formData);
      }

      if (success) {
        handleBack();
      }
    } finally {
      setIsSaving(false);
    }
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isEditing ? 'Editar contacto' : 'Nuevo contacto'}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditing ? 'Modifica los datos del contacto' : 'Ingresa los datos del nuevo contacto'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {fromConversationId && (
              <Button variant="outline" onClick={handleBack}>
                <MessageSquare className="w-4 h-4 mr-2" />
                Volver a conversación
              </Button>
            )}
            {isEditing && id && (
              <ConsentBadge contactId={id} />
            )}
            <Button onClick={handleSave} disabled={isSaving || !formData.name.trim()}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? 'Guardar cambios' : 'Crear contacto'}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <Tabs defaultValue="datos" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="datos" className="gap-2">
                <User className="h-4 w-4" />
                Datos del contacto
              </TabsTrigger>
              {isEditing && (
                <TabsTrigger value="actividad" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Historial / Actividad
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="datos" className="mt-0">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN - Operational Cards */}
                <div className="space-y-6">
                  {/* General Information */}
                  <Card className="h-fit">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <User className="h-5 w-5 text-primary" />
                        <CardTitle>Información general</CardTitle>
                      </div>
                      <CardDescription>Datos básicos del contacto</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nombre *</Label>
                        <Input
                          id="name"
                          placeholder="Nombre completo"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                          placeholder="País"
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
                          <div className="flex flex-wrap gap-2 mt-3">
                            {formData.tags.map((tag) => (
                              <Badge
                                key={tag}
                                variant="secondary"
                                className="px-3 py-1 flex items-center gap-1.5"
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
                    </CardContent>
                  </Card>

                  {/* Lead Priority Card */}
                  <LeadPriorityCard
                    data={{
                      lead_score: formData.lead_score ?? 0,
                      lead_temperature: formData.lead_temperature ?? 'cold',
                      engagement_level: formData.engagement_level ?? 'low',
                      source: formData.source ?? '',
                      opt_in_status: formData.opt_in_status ?? 'unknown',
                      next_action_at: formData.next_action_at ?? '',
                      last_interaction_at: lastInteractionAt,
                    }}
                    onChange={(data) => setFormData({
                      ...formData,
                      lead_score: data.lead_score,
                      lead_temperature: data.lead_temperature,
                      engagement_level: data.engagement_level,
                      source: data.source,
                      opt_in_status: data.opt_in_status,
                      next_action_at: data.next_action_at,
                    })}
                  />

                  {/* Real Estate Credit Card */}
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

                  {/* Real Estate Preferences Card */}
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

                {/* RIGHT COLUMN - Custom Fields */}
                <Card className="h-fit">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Settings2 className="h-5 w-5 text-primary" />
                      <CardTitle>Campos personalizados</CardTitle>
                      {customFields.length > 0 && (
                        <Badge variant="secondary" className="ml-2">
                          {customFields.length}
                        </Badge>
                      )}
                    </div>
                    <CardDescription>
                      Información adicional del contacto. Los campos personalizados son opcionales y no afectan segmentaciones por defecto.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {customFields.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p>No hay campos personalizados</p>
                        <p className="text-sm mt-1">Puedes crearlos desde Configuración</p>
                        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/settings/contact-fields')}>
                          Crear campo
                        </Button>
                      </div>
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
                        <TabsList className="w-full flex flex-wrap h-auto gap-1 mb-4">
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
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Activity Timeline Tab - Only show when editing */}
            {isEditing && id && (
              <TabsContent value="actividad" className="mt-0">
                <Card>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" />
                      <CardTitle>Historial / Actividad</CardTitle>
                    </div>
                    <CardDescription>Interacciones y eventos relacionados con este contacto</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ContactActivityTimeline contactId={id} />
                  </CardContent>
                </Card>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}
