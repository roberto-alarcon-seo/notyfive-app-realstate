import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Plus, Search, Edit, Trash2, ToggleLeft, ToggleRight, Tag } from 'lucide-react';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { 
  useKnowledgeBase, 
  useDeleteKBEntry, 
  useToggleKBEntry,
  KBCategory,
  KB_CATEGORY_LABELS,
  KnowledgeBaseEntry
} from '@/hooks/useKnowledgeBase';

const CATEGORIES = Object.entries(KB_CATEGORY_LABELS) as [KBCategory, string][];

export default function SettingsKnowledgeBase() {
  const navigate = useNavigate();
  const { data: entries = [], isLoading } = useKnowledgeBase();
  const deleteEntry = useDeleteKBEntry();
  const toggleEntry = useToggleKBEntry();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = 
      entry.question.toLowerCase().includes(search.toLowerCase()) ||
      entry.answer.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || entry.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const groupedEntries = filteredEntries.reduce((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = [];
    acc[entry.category].push(entry);
    return acc;
  }, {} as Record<string, KnowledgeBaseEntry[]>);

  if (isLoading) {
    return (
      <SettingsLayout title="Base de Conocimiento" description="Gestiona las respuestas del asistente" icon={BookOpen}>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout title="Base de Conocimiento" description="Gestiona las respuestas del asistente" icon={BookOpen}>
      <div className="space-y-6">
        {/* Header Actions */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar pregunta o respuesta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {CATEGORIES.map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => navigate('/settings/knowledge-base/new')}>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Entrada
          </Button>
        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <Badge variant="secondary" className="text-sm">
            {entries.length} entradas totales
          </Badge>
          <Badge variant="outline" className="text-sm">
            {entries.filter((e) => e.is_active).length} activas
          </Badge>
        </div>

        {/* Entries by Category */}
        {Object.keys(groupedEntries).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                {search ? 'No hay resultados para tu búsqueda' : 'Aún no hay entradas en la base de conocimiento'}
              </p>
              <Button variant="outline" className="mt-4" onClick={() => navigate('/settings/knowledge-base/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera entrada
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedEntries).map(([category, categoryEntries]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">
                  {KB_CATEGORY_LABELS[category as KBCategory]} ({categoryEntries.length})
                </h3>
                <div className="space-y-3">
                  {categoryEntries.map((entry) => (
                    <Card 
                      key={entry.id} 
                      className={`cursor-pointer hover:bg-muted/50 transition-colors ${!entry.is_active ? 'opacity-60' : ''}`}
                      onClick={() => navigate(`/settings/knowledge-base/${entry.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground">{entry.question}</p>
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{entry.answer}</p>
                            {entry.tags && entry.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {entry.tags.map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    <Tag className="h-3 w-3 mr-1" />
                                    {tag}
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleEntry.mutate({ id: entry.id, is_active: !entry.is_active })}
                              title={entry.is_active ? 'Desactivar' : 'Activar'}
                            >
                              {entry.is_active ? (
                                <ToggleRight className="h-4 w-4 text-green-500" />
                              ) : (
                                <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                              )}
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => navigate(`/settings/knowledge-base/${entry.id}`)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteId(entry.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar entrada?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La entrada será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) {
                  deleteEntry.mutate(deleteId);
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
    </SettingsLayout>
  );
}
