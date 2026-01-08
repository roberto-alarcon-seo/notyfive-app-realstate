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
        setFormData({
          name: contact.name,
          email: contact.email || '',
          phone: contact.phone || '',
          country: contact.country || '',
          tags: contact.tags || [],
          notes: contact.notes || '',
          custom_fields: contact.custom_fields || {},
        });
      } else {
        toast.error("Contacto no encontrado");
        navigate("/contacts");
      }
    }
  }, [id, contacts, isEditing, navigate]);

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

                {/* Custom Fields with Category Tabs */}
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
                    <CardDescription>Información adicional del contacto</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {customFields.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Settings2 className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p>No hay campos personalizados</p>
                        <p className="text-sm mt-1">Puedes crearlos desde Configuración</p>
                      </div>
                    ) : categoryNames.length === 0 ? (
                      // No categories - show all fields flat
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
                      // Has categories - show in tabs
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
