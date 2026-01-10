import { useState } from "react";
import { Plus, GripVertical, Trash2, Edit2, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { usePropertyFaq, usePropertyFaqMutations, PropertyFaq } from "@/hooks/useProperties";

interface PropertyFaqEditorProps {
  propertyId: string;
}

export default function PropertyFaqEditor({ propertyId }: PropertyFaqEditorProps) {
  const { data: faqs, isLoading } = usePropertyFaq(propertyId);
  const { createFaq, updateFaq, deleteFaq } = usePropertyFaqMutations(propertyId);

  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAnswer, setNewAnswer] = useState("");
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");

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
        <CardTitle>Preguntas frecuentes</CardTitle>
        {!isAdding && (
          <Button variant="outline" size="sm" onClick={() => setIsAdding(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Agregar pregunta
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <p className="text-muted-foreground text-sm">Cargando...</p>
        ) : faqs?.length === 0 && !isAdding ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            No hay preguntas frecuentes. Agrega una para empezar.
          </p>
        ) : null}

        {/* FAQ List */}
        <div className="space-y-3">
          {faqs?.map((faq) => (
            <div
              key={faq.id}
              className="rounded-lg border bg-muted/30 p-4"
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
                  <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {faq.answer}
                    </p>
                  </div>
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
                </div>
              )}
            </div>
          ))}
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
