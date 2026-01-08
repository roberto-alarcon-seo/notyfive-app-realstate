import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Loader2, Archive, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { useSegments } from "@/hooks/useSegments";
import { toast } from "sonner";
import { SegmentCard } from "@/components/segments/SegmentCard";
import { SegmentTableRow } from "@/components/segments/SegmentTableRow";
import { Segment } from "@/types/segments";

export default function Segments() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [segmentToArchive, setSegmentToArchive] = useState<Segment | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  
  const { segments, isLoading, archiveSegment, restoreSegment, createSegment } = useSegments(showArchived);

  const filteredSegments = segments.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleEdit = (segment: Segment) => {
    navigate(`/segments/${segment.id}`);
  };

  const handleArchive = (segment: Segment) => {
    setSegmentToArchive(segment);
  };

  const confirmArchive = () => {
    if (segmentToArchive) {
      archiveSegment.mutate(segmentToArchive.id, {
        onSuccess: () => {
          toast.success("Segmento archivado correctamente");
          setSegmentToArchive(null);
        },
      });
    }
  };

  const handleDuplicate = (segment: Segment) => {
    createSegment.mutate(
      {
        name: `${segment.name} (copia)`,
        description: segment.description || undefined,
        type: segment.type,
        rules_json: segment.rules_json,
        contactIds: [],
      },
      {
        onSuccess: (newSegment) => {
          toast.success("Segmento duplicado correctamente");
          navigate(`/segments/${newSegment.id}`);
        },
      }
    );
  };

  const handleRestore = (segment: Segment) => {
    restoreSegment.mutate(segment.id, {
      onSuccess: () => {
        toast.success("Segmento restaurado correctamente");
      },
    });
  };

  return (
    <>
      <AlertDialog open={!!segmentToArchive} onOpenChange={(open) => !open && setSegmentToArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar segmento?</AlertDialogTitle>
            <AlertDialogDescription>
              El segmento "{segmentToArchive?.name}" será archivado y ya no aparecerá en la lista.
              Esta acción se puede revertir más adelante.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmArchive}>
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Segmentos</h1>
            <p className="text-muted-foreground mt-1">
              Organiza tus contactos en grupos inteligentes
            </p>
          </div>
          <Button onClick={() => navigate("/segments/new")}>
            <Plus className="w-4 h-4 mr-2" />
            Nuevo segmento
          </Button>
        </div>

        {/* Tabs, Search, and View Toggle */}
        <div className="flex items-center gap-4">
          <Tabs value={showArchived ? "archived" : "active"} onValueChange={(v) => setShowArchived(v === "archived")}>
            <TabsList>
              <TabsTrigger value="active">Activos</TabsTrigger>
              <TabsTrigger value="archived">
                <Archive className="w-4 h-4 mr-2" />
                Archivados
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar segmentos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex-1" />
          <ToggleGroup 
            type="single" 
            value={viewMode} 
            onValueChange={(value) => value && setViewMode(value as "grid" | "table")}
            className="border border-border rounded-lg p-1"
          >
            <ToggleGroupItem value="grid" aria-label="Vista de cuadrícula" className="h-8 w-8 p-0">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="table" aria-label="Vista de tabla" className="h-8 w-8 p-0">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      {/* Segments Grid/Table */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredSegments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? "No se encontraron segmentos"
                : showArchived 
                  ? "No tienes segmentos archivados"
                  : "No tienes segmentos aún"}
            </p>
            {!searchQuery && !showArchived && (
              <Button onClick={() => navigate("/segments/new")}>
                <Plus className="w-4 h-4 mr-2" />
                Crear tu primer segmento
              </Button>
            )}
          </div>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSegments.map((segment) => (
              <SegmentCard
                key={segment.id}
                segment={segment}
                onEdit={handleEdit}
                onArchive={showArchived ? undefined : handleArchive}
                onDuplicate={showArchived ? undefined : handleDuplicate}
                onRestore={showArchived ? handleRestore : undefined}
                isArchived={showArchived}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40%]">Nombre</TableHead>
                  <TableHead className="w-[12%]">Tipo</TableHead>
                  <TableHead className="w-[12%]">Reglas</TableHead>
                  <TableHead className="w-[15%]">Contactos</TableHead>
                  <TableHead className="w-[12%]">Actualizado</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSegments.map((segment) => (
                  <SegmentTableRow
                    key={segment.id}
                    segment={segment}
                    onEdit={handleEdit}
                    onArchive={showArchived ? undefined : handleArchive}
                    onDuplicate={showArchived ? undefined : handleDuplicate}
                    onRestore={showArchived ? handleRestore : undefined}
                    isArchived={showArchived}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
      </div>
    </>
  );
}
