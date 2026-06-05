import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Edit, Copy, Trash2, Power, Megaphone, MapPin, Bed, Bath, Ruler, UserPlus } from "lucide-react";
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFeatureFlag } from "@/hooks/useFeatureFlag";
import { useAuth } from "@/contexts/AuthContext";
import { useEffectiveTenantId } from "@/hooks/useEffectiveTenantId";
import { AssignAgentsPopover } from "./AssignAgentsPopover";
import { cn } from "@/lib/utils";

interface PropertyGridProps {
  properties: Property[];
  isLoading: boolean;
  onCreateCampaign?: (property: Property) => void;
}

const OPERATION_LABELS: Record<string, string> = {
  sale: "VENTA",
  rent: "RENTA",
};

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  available: { label: "Sincronizado", cls: "bg-emerald-500/90 text-white" },
  reserved: { label: "Pendiente", cls: "bg-amber-500/90 text-white" },
  sold: { label: "Vendido", cls: "bg-blue-500/90 text-white" },
  rented: { label: "Rentado", cls: "bg-purple-500/90 text-white" },
  inactive: { label: "Inactiva", cls: "bg-muted text-muted-foreground" },
};

const formatPrice = (price: number, currency: string) =>
  new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(price);

export default function PropertyGrid({ properties, isLoading, onCreateCampaign }: PropertyGridProps) {
  const navigate = useNavigate();
  const { updateProperty, deleteProperty, duplicateProperty } = usePropertyMutations();
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [assignOpenId, setAssignOpenId] = useState<string | null>(null);
  const { enabled: metaAdsEnabled } = useFeatureFlag("meta_ads");
  const { tenantRole, isSuperAdmin } = useAuth();
  const tenantId = useEffectiveTenantId();
  const canCreateCampaign =
    metaAdsEnabled &&
    !!onCreateCampaign &&
    (isSuperAdmin || tenantRole === "administrador" || tenantRole === "manager");
  const canManage =
    isSuperAdmin || tenantRole === "administrador" || tenantRole === "manager";

  const { data: assignmentsMap } = useQuery({
    queryKey: ["inventory-assignments-all", tenantId],
    enabled: !!tenantId && canManage,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_assignments")
        .select("property_id, user_id")
        .eq("tenant_id", tenantId!);
      if (error) throw error;
      const map = new Map<string, string[]>();
      (data ?? []).forEach((r: any) => {
        if (!map.has(r.property_id)) map.set(r.property_id, []);
        map.get(r.property_id)!.push(r.user_id);
      });
      return map;
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card overflow-hidden">
            <Skeleton className="h-48 w-full" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-6 w-32" />
            </div>
          </div>
        ))}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {properties.map((property) => {
          const op = OPERATION_LABELS[property.operation_type] || property.operation_type?.toUpperCase();
          const statusInfo = STATUS_BADGE[property.status] || STATUS_BADGE.inactive;
          const assignedCount = assignmentsMap?.get(property.id)?.length ?? 0;
          return (
            <div
              key={property.id}
              onClick={() => navigate(`/properties/${property.id}`)}
              className={cn(
                "group relative rounded-xl border bg-card overflow-hidden cursor-pointer",
                "transition-all hover:border-primary/50 hover:shadow-lg",
                !property.is_active && "opacity-60"
              )}
            >
              {/* Image */}
              <div className="relative aspect-[16/10] bg-muted overflow-hidden">
                {property.cover_image ? (
                  <img
                    src={property.cover_image}
                    alt={property.title}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
                    Sin imagen
                  </div>
                )}

                {/* Top-left badges */}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  {op && (
                    <span className="px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide bg-emerald-500/90 text-white">
                      {op}
                    </span>
                  )}
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-[11px] font-medium",
                      statusInfo.cls
                    )}
                  >
                    {statusInfo.label}
                  </span>
                </div>

                {/* Top-right actions */}
                <div
                  className="absolute top-2 right-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-black/40 hover:bg-black/60 text-white rounded-full"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canCreateCampaign && (
                        <DropdownMenuItem onClick={() => onCreateCampaign?.(property)}>
                          <Megaphone className="mr-2 h-4 w-4" />
                          Campaña Meta Ads
                        </DropdownMenuItem>
                      )}
                      {canManage && (
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            setAssignOpenId(property.id);
                          }}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          Asignar asesores
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => navigate(`/properties/${property.id}`)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => duplicateProperty.mutate(property.id)}>
                        <Copy className="mr-2 h-4 w-4" />
                        Duplicar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          updateProperty.mutate({ id: property.id, is_active: !property.is_active })
                        }
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
                </div>
              </div>

              {/* Content */}
              <div className="p-4 space-y-2">
                <p className="text-[11px] font-mono text-muted-foreground tracking-wider">
                  {property.property_code}
                </p>
                <h3 className="font-semibold text-base leading-snug line-clamp-1">
                  {property.title}
                </h3>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-1">{property.zone}</span>
                </div>
                <p className="text-lg font-bold text-primary pt-1">
                  {formatPrice(property.price, property.currency)}
                </p>

                <div className="flex items-center gap-4 pt-2 border-t mt-2 text-xs text-muted-foreground">
                  {property.bedrooms != null && (
                    <div className="flex items-center gap-1">
                      <Bed className="h-3.5 w-3.5" />
                      <span>{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms != null && (
                    <div className="flex items-center gap-1">
                      <Bath className="h-3.5 w-3.5" />
                      <span>{property.bathrooms}</span>
                    </div>
                  )}
                  {property.sq_meters != null && (
                    <div className="flex items-center gap-1">
                      <Ruler className="h-3.5 w-3.5" />
                      <span>{property.sq_meters} m²</span>
                    </div>
                  )}
                </div>

                {canManage && tenantId && (
                  <div onClick={(e) => e.stopPropagation()} className="pt-2">
                    <AssignAgentsPopover
                      propertyId={property.id}
                      tenantId={tenantId}
                      open={assignOpenId === property.id}
                      onOpenChange={(o) =>
                        setAssignOpenId(o ? property.id : null)
                      }
                      trigger={
                        <button
                          type="button"
                          onClick={(e) => e.stopPropagation()}
                          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors w-full"
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          <span>
                            {assignedCount === 0
                              ? "Asignar asesor"
                              : `${assignedCount} asesor${assignedCount !== 1 ? "es" : ""} asignado${assignedCount !== 1 ? "s" : ""}`}
                          </span>
                        </button>
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
              onClick={() => {
                if (deleteId) {
                  deleteProperty.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
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