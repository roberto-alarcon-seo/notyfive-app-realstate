import { useNavigate } from "react-router-dom";
import { Users, Phone, Mail, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useInterestedContacts } from "@/hooks/useProperties";

interface PropertyInterestedContactsProps {
  propertyId: string;
}

const TEMPERATURE_COLORS: Record<string, string> = {
  hot: "bg-red-500/20 text-red-400 border-red-500/30",
  warm: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  cold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const STAGE_LABELS: Record<string, string> = {
  new_lead: "Nuevo Lead",
  contacted: "Contactado",
  qualified: "Calificado",
  proposal: "Propuesta",
  negotiation: "Negociación",
  closed_won: "Cerrado Ganado",
  closed_lost: "Cerrado Perdido",
};

export default function PropertyInterestedContacts({
  propertyId,
}: PropertyInterestedContactsProps) {
  const navigate = useNavigate();
  const { data: contacts, isLoading } = useInterestedContacts(propertyId);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Contactos interesados
          {contacts && contacts.length > 0 && (
            <Badge variant="secondary">{contacts.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="max-h-[calc(100vh-200px)] overflow-y-auto space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Cargando...</p>
        ) : !contacts || contacts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No hay contactos interesados en esta propiedad
          </p>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/contacts/${contact.id}`)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium truncate">{contact.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    {contact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {contact.phone}
                      </span>
                    )}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={TEMPERATURE_COLORS[contact.lead_temperature] || ""}
                >
                  {contact.lead_temperature}
                </Badge>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className="text-xs">
                  {STAGE_LABELS[contact.pipeline_stage] || contact.pipeline_stage}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
