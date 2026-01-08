import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Eye, Loader2, Save } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Segment, SegmentRules, SegmentType } from "@/types/segments";
import { SegmentRuleBuilder } from "@/components/segments/SegmentRuleBuilder";
import { ContactSelector } from "@/components/segments/ContactSelector";
import { useSegments, useSegmentContacts, getSegmentContactsPreview } from "@/hooks/useSegments";
import { useCustomFields } from "@/hooks/useCustomFields";
import { useCustomFieldOptions } from "@/hooks/useCustomFieldOptions";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function SegmentEditor() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const { createSegment, updateSegment } = useSegments();
  const { customFields } = useCustomFields();
  const { options: customFieldOptions, fetchAllOptions } = useCustomFieldOptions();

  const [segment, setSegment] = useState<Segment | null>(null);
  const [isLoadingSegment, setIsLoadingSegment] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<SegmentType>("dynamic");
  const [rules, setRules] = useState<SegmentRules>({ logic: "AND", conditions: [] });
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [previewContacts, setPreviewContacts] = useState<
    { id: string; name: string; email: string | null; phone: string | null }[]
  >([]);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const isEditing = !!id;

  // Load existing segment if editing
  useEffect(() => {
    if (id && profile?.tenant_id) {
      loadSegment(id);
    }
  }, [id, profile?.tenant_id]);

  // Load custom field options
  useEffect(() => {
    fetchAllOptions();
  }, [fetchAllOptions]);

  const loadSegment = async (segmentId: string) => {
    setIsLoadingSegment(true);
    try {
      const { data, error } = await supabase
        .from("segments")
        .select("*")
        .eq("id", segmentId)
        .single();

      if (error) throw error;
      if (data) {
        const seg = {
          ...data,
          rules_json: data.rules_json as unknown as SegmentRules | null,
        } as Segment;
        
        setSegment(seg);
        setName(seg.name);
        setDescription(seg.description || "");
        setType(seg.type);
        if (seg.rules_json) {
          setRules(seg.rules_json);
        }

        // Load static contacts if needed
        if (seg.type === "static") {
          const { data: contacts } = await supabase
            .from("segment_contacts")
            .select("contact_id")
            .eq("segment_id", segmentId);
          
          if (contacts) {
            setSelectedContactIds(contacts.map((c) => c.contact_id));
          }
        }
      }
    } catch (error) {
      console.error("Error loading segment:", error);
      toast.error("Error al cargar el segmento");
      navigate("/segments");
    } finally {
      setIsLoadingSegment(false);
    }
  };

  const handlePreview = async () => {
    if (!profile?.tenant_id) return;

    setIsLoadingPreview(true);
    setShowPreview(true);
    try {
      const contacts = await getSegmentContactsPreview(
        profile.tenant_id,
        type,
        type === "dynamic" ? rules : null,
        type === "static" ? selectedContactIds : undefined
      );
      setPreviewContacts(contacts);
      // Scroll to preview after loading
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (error) {
      console.error("Error loading preview:", error);
      toast.error("Error al cargar la previsualización");
      setShowPreview(false);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("El nombre es requerido");
      return;
    }

    if (type === "static" && selectedContactIds.length === 0) {
      toast.error("Selecciona al menos un contacto");
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing && segment) {
        await updateSegment.mutateAsync({
          id: segment.id,
          name,
          description,
          type,
          rules_json: type === "dynamic" ? rules : undefined,
          contactIds: type === "static" ? selectedContactIds : undefined,
        });
      } else {
        await createSegment.mutateAsync({
          name,
          description,
          type,
          rules_json: type === "dynamic" ? rules : undefined,
          contactIds: type === "static" ? selectedContactIds : undefined,
        });
      }
      navigate("/segments");
    } catch (error) {
      console.error("Error saving segment:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoadingSegment) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/segments")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {isEditing ? "Editar segmento" : "Nuevo segmento"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {isEditing
                  ? "Modifica la configuración del segmento"
                  : "Crea un nuevo segmento para organizar tus contactos"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handlePreview}
              disabled={isLoadingPreview}
            >
              {isLoadingPreview ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Previsualizar
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              {isEditing ? "Guardar cambios" : "Crear segmento"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Basic Info Card */}
          <Card>
            <CardHeader>
              <CardTitle>Información básica</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del segmento *</Label>
                  <Input
                    id="name"
                    placeholder="Ej: Clientes VIP"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de segmento</Label>
                  <Select
                    value={type}
                    onValueChange={(val: SegmentType) => setType(val)}
                    disabled={isEditing}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dynamic">
                        Dinámico - Basado en reglas
                      </SelectItem>
                      <SelectItem value="static">
                        Estático - Selección manual
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {isEditing && (
                    <p className="text-xs text-muted-foreground">
                      El tipo no se puede cambiar después de crear el segmento.
                    </p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  placeholder="Descripción del segmento..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Configuration Card */}
          <Card>
            <CardHeader>
              <CardTitle>
                {type === "dynamic" ? "Configuración de reglas" : "Selección de contactos"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {type === "dynamic" ? (
                <SegmentRuleBuilder
                  rules={rules}
                  onChange={setRules}
                  customFields={customFields}
                  customFieldOptions={customFieldOptions}
                />
              ) : (
                <ContactSelector
                  selectedIds={selectedContactIds}
                  onChange={setSelectedContactIds}
                />
              )}
            </CardContent>
          </Card>

          {/* Preview Section */}
          {showPreview && (
            <Card ref={previewRef}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Previsualización de contactos</CardTitle>
                  {isLoadingPreview ? (
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Badge variant="secondary">
                      {previewContacts.length} contactos
                      {previewContacts.length === 50 && " (mostrando máx. 50)"}
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingPreview ? (
                  <div className="p-8 text-center">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-muted-foreground mt-2">Cargando contactos...</p>
                  </div>
                ) : previewContacts.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    No hay contactos que coincidan con los criterios
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="text-left p-3 font-medium">Nombre</th>
                          <th className="text-left p-3 font-medium">Email</th>
                          <th className="text-left p-3 font-medium">Teléfono</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewContacts.map((contact) => (
                          <tr key={contact.id} className="border-t">
                            <td className="p-3">{contact.name}</td>
                            <td className="p-3 text-muted-foreground">
                              {contact.email || "-"}
                            </td>
                            <td className="p-3 text-muted-foreground">
                              {contact.phone || "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
