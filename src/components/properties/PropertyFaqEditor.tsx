import { useState } from "react";
import { Plus, GripVertical, Trash2, Edit2, Check, X, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { usePropertyFaq, usePropertyFaqMutations, PropertyFaq } from "@/hooks/useProperties";
import { useTenantContext } from "@/hooks/useTenantContext";

interface PropertyFaqEditorProps {
  propertyId: string;
}

export default function PropertyFaqEditor({ propertyId }: PropertyFaqEditorProps) {
  const { data: faqs, isLoading } = usePropertyFaq(propertyId);
  const { createFaq, updateFaq, deleteFaq } = usePropertyFaqMutations(propertyId);
  const { data: tenantContext } = useTenantContext();
  const isExternallyManaged = !!tenantContext?.managed_externally;

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

  const coreFaqs = faqs?.filter((f) => f.source === 'core') ?? [];

  const handleAdd = async () => {
    if (!newQuestion.trim() || !newAnswer.trim()) return;

    await createFaq.mutateAsync({
      question: newQuestion,
      answer: newAnswer,
      sort_order: (faqs?.length || 0),
    });

    setNewQuestion("");
    setNewAnswer("");
    setIsAdding(false);
  };

  const handleEdit = (faq: PropertyFaq) => {
    setEditingId(faq.id);
    setEditQuestion(faq.question);
    setEditAnswer(faq.answer);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editQuestion.trim() || !editAnswer.trim()) return;

    await updateFaq.mutateAsync({
      id: editingId,
      question: editQuestion,
      answer: editAnswer,
    });

    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    await deleteFaq.mutateAsync(id);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          Preguntas frecuentes
          {coreFaqs.length > 0 && (
            <Badge variant="secondary" className="gap-1">
              <Lock className="h-3 w-3" />
              {coreFaqs.length} sincronizada{coreFaqs.length === 1 ? '' : 's'}
            </Badge>
          )}
        </CardTitle>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {isExternallyManaged ? 'Agregar adicional' : 'Agregar pregunta'}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isExternallyManaged && coreFaqs.length > 0 && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
            <Lock className="h-4 w-4 mt-0.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-muted-foreground text-xs">
              Las preguntas marcadas como <strong>Core</strong> se sincronizan desde el sistema central y son de solo lectura. Puedes añadir preguntas adicionales para complementar el entrenamiento de la IA.
            </p>
          </div>
        )}

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : faqs?.length === 0 && !isAdding ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No hay preguntas frecuentes. Agrega una para empezar.
          </p>
        ) : null}

        {/* FAQ List */}
        <div className="space-y-3">
          {faqs?.map((faq) => {
            const isCoreFaq = faq.source === 'core';
            return (
            <div
              key={faq.id}
              className={`rounded-lg border p-4 ${isCoreFaq ? 'bg-muted/60 border-amber-500/20' : 'bg-muted/30'}`}
            >
              {editingId === faq.id ? (
                <div className="space-y-3">
                  <Input
                    value={editQuestion}
                    onChange={(e) => setEditQuestion(e.target.value)}
                    placeholder="Pregunta"
                  />
                  <Textarea
                    value={editAnswer}
                    onChange={(e) => setEditAnswer(e.target.value)}
                    placeholder="Respuesta"
                    className="min-h-[80px]"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveEdit}>
                      <Check className="mr-1 h-4 w-4" />
                      Guardar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                    >
                      <X className="mr-1 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-3">
                  {isCoreFaq ? (
                    <Lock className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  ) : (
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm flex items-center gap-2">
                      {faq.question}
                      {isCoreFaq && (
                        <Badge variant="secondary" className="gap-1 text-[10px] px-1.5 py-0">
                          Core
                        </Badge>
                      )}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {faq.answer}
                    </p>
                  </div>
                  {!isCoreFaq && (
                    <div className="flex gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(faq)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(faq.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>

        {/* Add New FAQ Form */}
        {isAdding && (
          <div className="rounded-lg border border-primary/50 bg-primary/5 p-4 space-y-3">
            <Input
              value={newQuestion}
              onChange={(e) => setNewQuestion(e.target.value)}
              placeholder="¿Cuál es la pregunta?"
              autoFocus
            />
            <Textarea
              value={newAnswer}
              onChange={(e) => setNewAnswer(e.target.value)}
              placeholder="Escribe la respuesta..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd}>
                <Check className="mr-1 h-4 w-4" />
                Agregar
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setIsAdding(false);
                  setNewQuestion("");
                  setNewAnswer("");
                }}
              >
                <X className="mr-1 h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
