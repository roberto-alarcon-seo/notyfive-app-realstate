import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, ToggleLeft, ToggleRight, Tag, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useKnowledgeBase, 
  useCreateKBEntry, 
  useUpdateKBEntry,
  KBCategory,
  KB_CATEGORY_LABELS
} from '@/hooks/useKnowledgeBase';

const CATEGORIES = Object.entries(KB_CATEGORY_LABELS) as [KBCategory, string][];

export default function KnowledgeBaseEditor() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;
  
  const { data: entries = [], isLoading } = useKnowledgeBase();
  const createEntry = useCreateKBEntry();
  const updateEntry = useUpdateKBEntry();

  const [formData, setFormData] = useState({
    category: 'general_info' as KBCategory,
    question: '',
    answer: '',
    tags: [] as string[],
    is_active: true,
  });
  const [tagInput, setTagInput] = useState('');

  // Load existing entry data when editing
  useEffect(() => {
    if (isEditing && entries.length > 0) {
      const entry = entries.find(e => e.id === id);
      if (entry) {
        setFormData({
          category: entry.category,
          question: entry.question,
          answer: entry.answer,
          tags: entry.tags || [],
          is_active: entry.is_active,
        });
      }
    }
  }, [id, isEditing, entries]);

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  const handleSave = () => {
    if (isEditing) {
      updateEntry.mutate({ id, ...formData }, {
        onSuccess: () => navigate('/settings/knowledge-base'),
      });
    } else {
      createEntry.mutate(formData, {
        onSuccess: () => navigate('/settings/knowledge-base'),
      });
    }
  };

  if (isLoading && isEditing) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-96" />
          <Skeleton className="h-96 lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings/knowledge-base')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-primary" />
              {isEditing ? 'Editar Entrada' : 'Nueva Pregunta Frecuente'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isEditing 
                ? 'Modifica la información de esta entrada en la base de conocimiento'
                : 'Agrega una nueva pregunta frecuente a la base de conocimiento'}
            </p>
          </div>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={!formData.question || !formData.answer || createEntry.isPending || updateEntry.isPending}
        >
          <Save className="h-4 w-4 mr-2" />
          {isEditing ? 'Guardar Cambios' : 'Crear Entrada'}
        </Button>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Metadata */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configuración</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <Label>Categoría</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value: KBCategory) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Estado</Label>
                <Card className="p-3 bg-muted/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {formData.is_active ? 'Activo' : 'Inactivo'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formData.is_active 
                          ? 'La IA usará esta entrada' 
                          : 'La IA ignorará esta entrada'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                      className={formData.is_active ? 'text-green-500 hover:text-green-600' : 'text-muted-foreground'}
                    >
                      {formData.is_active ? (
                        <ToggleRight className="h-8 w-8" />
                      ) : (
                        <ToggleLeft className="h-8 w-8" />
                      )}
                    </Button>
                  </div>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Etiquetas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Nueva etiqueta"
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddTag}>
                  <Tag className="h-4 w-4" />
                </Button>
              </div>
              {formData.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {formData.tags.map((tag) => (
                    <Badge 
                      key={tag} 
                      variant="secondary" 
                      className="cursor-pointer hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag} ×
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Las etiquetas ayudan a organizar y buscar entradas
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Content */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pregunta</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                value={formData.question}
                onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                placeholder="¿Cuál es la pregunta que el cliente podría hacer?"
                className="text-base"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Escribe la pregunta tal como la haría un cliente
              </p>
            </CardContent>
          </Card>

          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-base">Respuesta</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={formData.answer}
                onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                placeholder="Escribe aquí la respuesta completa que la IA debe proporcionar cuando detecte esta pregunta o tema relacionado.

Puedes incluir:
• Información detallada del producto o servicio
• Horarios, ubicaciones, precios
• Instrucciones paso a paso
• Políticas de la empresa
• Cualquier información relevante

Entre más detallada sea la respuesta, mejor podrá responder la IA a variaciones de la pregunta."
                className="min-h-[400px] resize-none text-base leading-relaxed"
              />
              <p className="text-xs text-muted-foreground mt-3">
                Esta respuesta será usada por la IA como referencia. Escribe de forma natural, como si estuvieras respondiendo directamente al cliente.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
