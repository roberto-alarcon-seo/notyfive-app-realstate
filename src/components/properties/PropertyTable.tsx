import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Edit, Copy, Trash2, Power, Megaphone } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Property, usePropertyMutations } from "@/hooks/useProperties";
import { useState } from "react";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/contexts/AuthContext";

interface PropertyTableProps {
  properties: Property[];
  isLoading: boolean;
  onCreateCampaign?: (property: Property) => void;
}

const STATUS_COLORS: Record<string, string> = {
  available: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  reserved: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  sold: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  rented: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  inactive: "bg-muted text-muted-foreground border-muted",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible",
  reserved: "Apartado",
  sold: "Vendido",
  rented: "Rentado",
  inactive: "Inactiva",
};

const formatPrice = (price: number, currency: string) => {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: currency,
    maximumFractionDigits: 0,
  }).format(price);
};

export default function PropertyTable({ properties, isLoading, onCreateCampaign }: PropertyTableProps) {
  const navigate = useNavigate();
  const { updateProperty, deleteProperty, duplicateProperty } = usePropertyMutations();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { enabled: metaAdsEnabled } = useFeatureFlag("meta_ads");
  const { tenantRole, isSuperAdmin } = useAuth();
  const canCreateCampaign =
    metaAdsEnabled &&
    !!onCreateCampaign &&
    (isSuperAdmin || tenantRole === "administrador" || tenantRole === "manager");

  const handleToggleActive = (property: Property) => {
    updateProperty.mutate({ id: property.id, is_active: !property.is_active });
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteProperty.mutate(deleteId);
      setDeleteId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Métricas</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="w-20">Activo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-10 w-10 rounded" /></TableCell>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                <TableCell><Skeleton className="h-8 w-8" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="rounded-lg border p-12 text-center">
        <p className="text-muted-foreground">No se encontraron propiedades</p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Foto</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Zona</TableHead>
              <TableHead>Precio</TableHead>
              <TableHead>Métricas</TableHead>
              <TableHead>Estatus</TableHead>
              <TableHead className="w-20">Activo</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {properties.map((property) => (
              <TableRow
                key={property.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => navigate(`/properties/${property.id}`)}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  {property.cover_image ? (
                    <img
                      src={property.cover_image}
                      alt={property.title}
                      className="h-10 w-10 rounded object-cover"
                    />
                  ) : (
                    <div className="h-10 w-10 rounded bg-muted flex items-center justify-center text-muted-foreground text-xs">
                      N/A
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{property.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {property.property_code}
                    </p>
                  </div>
                </TableCell>
                <TableCell>{property.zone}</TableCell>
                <TableCell>
                  {formatPrice(property.price, property.currency)}
                </TableCell>
                <TableCell>
                  <span className="text-muted-foreground">0 / 0</span>
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={STATUS_COLORS[property.status] || STATUS_COLORS.inactive}
                  >
                    {STATUS_LABELS[property.status] || property.status}
                  </Badge>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Switch
                    checked={property.is_active}
                    onCheckedChange={() => handleToggleActive(property)}
                  />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canCreateCampaign && (
                        <DropdownMenuItem
                          onClick={() => onCreateCampaign?.(property)}
                        >
                          <Megaphone className="mr-2 h-4 w-4" />
                          Campaña Meta Ads
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        onClick={() => navigate(`/properties/${property.id}`)}
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => duplicateProperty.mutate(property.id)}
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleToggleActive(property)}
                      >
                        <Power className="mr-2 h-4 w-4" />
                        {property.is_active ? "Desactivar" : "Activar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(property.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar propiedad?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los datos
              asociados a esta propiedad, incluyendo imágenes, documentos y FAQs.
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
