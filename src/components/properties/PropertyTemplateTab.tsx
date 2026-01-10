import { useQuery } from "@tanstack/react-query";
import { FileText, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Property } from "@/hooks/useProperties";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { useNavigate } from "react-router-dom";

interface PropertyTemplateTabProps {
  formData: Partial<Property>;
  updateField: <K extends keyof Property>(field: K, value: Property[K]) => void;
}

export default function PropertyTemplateTab({
  formData,
  updateField,
}: PropertyTemplateTabProps) {
  const tenantId = useEffectiveTenantId();
  const navigate = useNavigate();

  const { data: templates, isLoading } = useQuery({
    queryKey: ["templates", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("id, name, category")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      return data as { id: string; name: string; category: string }[];
    },
    enabled: !!tenantId,
  });

  const selectedTemplate = templates?.find((t) => t.id === formData.template_id);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Plantilla asignada
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Selecciona una plantilla</Label>
            <Select
              value={formData.template_id || "none"}
              onValueChange={(v) =>
                updateField("template_id", v === "none" ? null : v)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin plantilla" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin plantilla</SelectItem>
                {templates?.map((template) => (
                  <SelectItem key={template.id} value={template.id}>
                    <div className="flex items-center gap-2">
                      <span>{template.name}</span>
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Solo se muestran plantillas aprobadas
            </p>
          </div>

          {selectedTemplate ? (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{selectedTemplate.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary">{selectedTemplate.category}</Badge>
                    <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                      Aprobada
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/templates")}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Ver plantilla
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-6 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
              <Badge variant="outline" className="text-muted-foreground">
                Sin plantilla
              </Badge>
              <p className="text-sm text-muted-foreground mt-2">
                Asigna una plantilla para usar en campañas y automatizaciones
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-6">
          <p className="text-sm text-muted-foreground text-center">
            Las plantillas asignadas se utilizarán automáticamente al enviar
            campañas o mensajes relacionados con esta propiedad.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
