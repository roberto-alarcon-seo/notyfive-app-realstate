import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Building2, Trash2, Save, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProperty, usePropertyMutations, Property } from "@/hooks/useProperties";
import PropertyInfoTab from "@/components/properties/PropertyInfoTab";
import PropertyMultimediaTab from "@/components/properties/PropertyMultimediaTab";
import PropertyAvailabilityTab from "@/components/properties/PropertyAvailabilityTab";
import PropertyTemplateTab from "@/components/properties/PropertyTemplateTab";
import PropertyInterestedContacts from "@/components/properties/PropertyInterestedContacts";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";

export default function PropertyEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isNew = id === "new";
  const tenantId = useEffectiveTenantId();

  const { data: property, isLoading } = useProperty(isNew ? undefined : id);
  const { createProperty, updateProperty, deleteProperty } = usePropertyMutations();

  const [formData, setFormData] = useState<Partial<Property>>({
    property_code: "",
    title: "",
    operation_type: "sale",
    property_type: "",
    zone: "",
    address: "",
    price: 0,
    currency: "MXN",
    status: "available",
    is_active: true,
    assigned_user_id: null,
    template_id: null,
    ai_prompt: "",
    internal_notes: "",
    maintenance_fee: null,
    visit_availability: "",
    accepted_credits: [],
    youtube_url: "",
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (property && !isNew) {
      setFormData({
        property_code: property.property_code,
        title: property.title,
        operation_type: property.operation_type,
        property_type: property.property_type || "",
        zone: property.zone,
        address: property.address || "",
        price: property.price,
        currency: property.currency,
        status: property.status,
        is_active: property.is_active,
        assigned_user_id: property.assigned_user_id,
        template_id: property.template_id,
        ai_prompt: property.ai_prompt || "",
        internal_notes: property.internal_notes || "",
        maintenance_fee: property.maintenance_fee,
        visit_availability: property.visit_availability || "",
        accepted_credits: property.accepted_credits || [],
        youtube_url: property.youtube_url || "",
      });
    }
  }, [property, isNew]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (isNew) {
        await createProperty.mutateAsync({
          ...formData,
          tenant_id: tenantId!,
        });
        navigate("/properties");
      } else {
        await updateProperty.mutateAsync({
          id: id!,
          ...formData,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteProperty.mutateAsync(id!);
    navigate("/properties");
  };

  const updateField = <K extends keyof Property>(field: K, value: Property[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading && !isNew) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/properties")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-2xl font-bold">
                  {isNew ? "Nueva propiedad" : formData.title || "Editar propiedad"}
                </h1>
                {!isNew && (
                  <p className="text-muted-foreground">{formData.property_code}</p>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!isNew && (
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
              </Button>
            )}
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-3">
            <Tabs defaultValue="info" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="info">Información</TabsTrigger>
                <TabsTrigger value="multimedia">Multimedia</TabsTrigger>
                <TabsTrigger value="availability">Disponibilidad</TabsTrigger>
                <TabsTrigger value="template">Plantilla</TabsTrigger>
              </TabsList>

              <TabsContent value="info">
                <PropertyInfoTab
                  formData={formData}
                  updateField={updateField}
                  propertyId={isNew ? undefined : id}
                />
              </TabsContent>

              <TabsContent value="multimedia">
                <PropertyMultimediaTab propertyId={isNew ? undefined : id} />
              </TabsContent>

              <TabsContent value="availability">
                <PropertyAvailabilityTab
                  formData={formData}
                  updateField={updateField}
                />
              </TabsContent>

              <TabsContent value="template">
                <PropertyTemplateTab
                  formData={formData}
                  updateField={updateField}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar - Interested Contacts */}
          {!isNew && (
            <div className="lg:col-span-1">
              <PropertyInterestedContacts propertyId={id!} />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar propiedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos
              asociados a esta propiedad.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
