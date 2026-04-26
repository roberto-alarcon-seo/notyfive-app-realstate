import { Building } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useProperties } from "@/hooks/useProperties";

interface PropertyInterestCardProps {
  propertyId: string | null;
  onChange: (propertyId: string | null) => void;
}

export function PropertyInterestCard({ propertyId, onChange }: PropertyInterestCardProps) {
  const { data: properties, isLoading } = useProperties();

  const selectedProperty = properties?.find(p => p.id === propertyId);

  const formatPrice = (price: number, currency: string) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency === 'USD' ? 'USD' : 'MXN',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Building className="h-4 w-4" />
          Inmueble de interés
        </CardTitle>
        <CardDescription>
          Propiedad en la que está interesado este contacto
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Select 
            value={propertyId || "none"} 
            onValueChange={(val) => onChange(val === "none" ? null : val)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar propiedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin propiedad asignada</SelectItem>
              {isLoading ? (
                <SelectItem value="loading" disabled>Cargando...</SelectItem>
              ) : (
                properties?.filter(p => p.is_active).map((property) => (
                  <SelectItem key={property.id} value={property.id}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{property.property_code}</span>
                      <span className="text-muted-foreground">- {property.title}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {selectedProperty && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold">{selectedProperty.title}</p>
                <p className="text-sm text-muted-foreground">{selectedProperty.property_code}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">{selectedProperty.zone}</Badge>
              <Badge variant="secondary">
                {formatPrice(selectedProperty.price, selectedProperty.currency)}
              </Badge>
              <Badge 
                variant={selectedProperty.status === 'available' ? 'default' : 'secondary'}
              >
                {selectedProperty.status === 'available' ? 'Disponible' : 
                 selectedProperty.status === 'reserved' ? 'Reservado' : 
                 selectedProperty.status === 'sold' ? 'Vendido' : selectedProperty.status}
              </Badge>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
