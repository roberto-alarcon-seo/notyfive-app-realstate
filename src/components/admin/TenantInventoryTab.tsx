import { useEffect, useState } from 'react';
import { Building2, Eye, Loader2, Lock, Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { TenantPropertyDetailSheet } from './TenantPropertyDetailSheet';

interface TenantInventoryTabProps {
  tenantId: string;
  managedExternally?: boolean;
}

interface PropertyRow {
  id: string;
  property_code: string;
  title: string;
  zone: string | null;
  operation_type: string;
  status: string;
  is_active: boolean;
  price: number;
  currency: string;
  bedrooms: number | null;
  bathrooms: number | null;
  parking_spots: number | null;
  sq_meters: number | null;
  created_at: string;
}

const operationLabels: Record<string, string> = {
  sale: 'Venta',
  rent: 'Renta',
  preventa: 'Preventa',
};

const statusLabels: Record<string, string> = {
  available: 'Disponible',
  reserved: 'Reservado',
  sold: 'Vendido',
  rented: 'Rentado',
  inactive: 'Inactivo',
};

export function TenantInventoryTab({ tenantId, managedExternally }: TenantInventoryTabProps) {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const openDetail = (id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
  };

  useEffect(() => {
    const fetchProperties = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('properties')
          .select(
            'id, property_code, title, zone, operation_type, status, is_active, price, currency, bedrooms, bathrooms, parking_spots, sq_meters, created_at',
          )
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(500);
        if (error) throw error;
        setProperties((data ?? []) as PropertyRow[]);
      } catch (err) {
        console.error('Error loading properties for tenant:', err);
        toast.error('No se pudo cargar el inventario del tenant');
      } finally {
        setIsLoading(false);
      }
    };
    fetchProperties();
  }, [tenantId]);

  const filtered = properties.filter((p) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.property_code.toLowerCase().includes(q) ||
      (p.zone ?? '').toLowerCase().includes(q)
    );
  });

  const formatPrice = (price: number, currency: string) => {
    try {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: currency || 'MXN',
        maximumFractionDigits: 0,
      }).format(price);
    } catch {
      return `${currency} ${price.toLocaleString('es-MX')}`;
    }
  };

  return (
    <div className="space-y-6">
      {managedExternally && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 p-4 flex items-start gap-3">
          <Lock className="h-4 w-4 text-accent mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Inventario gestionado por el Core</p>
            <p className="text-muted-foreground">
              Las propiedades se sincronizan desde el sistema externo. La edición local está bloqueada.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por título, código o zona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Badge variant="secondary" className="shrink-0">
          {properties.length} {properties.length === 1 ? 'propiedad' : 'propiedades'}
        </Badge>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Building2 className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">
              {properties.length === 0
                ? 'Este tenant no tiene propiedades registradas.'
                : 'No hay coincidencias para tu búsqueda.'}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Propiedad</TableHead>
                <TableHead>Operación</TableHead>
                <TableHead>Estatus</TableHead>
                <TableHead className="text-right">Precio</TableHead>
                <TableHead className="text-center">Rec.</TableHead>
                <TableHead className="text-center">Baños</TableHead>
                <TableHead className="text-center">m²</TableHead>
                <TableHead>Origen</TableHead>
                <TableHead className="w-12 text-right">Detalle</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-muted/40"
                  onClick={() => openDetail(p.id)}
                >
                  <TableCell>
                    <div className="flex flex-col min-w-0">
                      <span className="font-medium text-foreground truncate max-w-[260px]">
                        {p.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {p.property_code}
                        {p.zone ? ` · ${p.zone}` : ''}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {operationLabels[p.operation_type] ?? p.operation_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={p.is_active ? 'secondary' : 'outline'}
                      className="capitalize"
                    >
                      {statusLabels[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(p.price, p.currency)}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {p.bedrooms ?? '—'}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {p.bathrooms ?? '—'}
                  </TableCell>
                  <TableCell className="text-center text-muted-foreground">
                    {p.sq_meters ?? '—'}
                  </TableCell>
                  <TableCell>
                    {managedExternally ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider border-accent text-accent bg-accent/10 gap-1"
                      >
                        <Lock className="h-3 w-3" />
                        Sincronizado
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        Local
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openDetail(p.id)}
                      aria-label="Ver detalle"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <TenantPropertyDetailSheet
        propertyId={selectedId}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open);
          if (!open) setSelectedId(null);
        }}
        managedExternally={managedExternally}
      />
    </div>
  );
}