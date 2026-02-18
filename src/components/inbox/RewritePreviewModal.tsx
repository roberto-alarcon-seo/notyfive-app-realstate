import { useState, useEffect } from 'react';
import { Sparkles, Check, Edit3, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export type RewriteTone = 'formal' | 'informal';

const TONE_STORAGE_KEY = 'rewrite-tone-preference';

export function getStoredTone(): RewriteTone {
  return (localStorage.getItem(TONE_STORAGE_KEY) as RewriteTone) || 'formal';
}

interface RewritePreviewModalProps {
  open: boolean;
  onClose: () => void;
  originalText: string;
  suggestedText: string;
  onUseSuggestion: (text: string) => void;
  onToneChange?: (tone: RewriteTone) => void;
  isLoading?: boolean;
}

export function RewritePreviewModal({
  open,
  onClose,
  originalText,
  suggestedText,
  onUseSuggestion,
  onToneChange,
  isLoading = false,
}: RewritePreviewModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(suggestedText);
  const [tone, setTone] = useState<RewriteTone>(getStoredTone());

  const handleToneChange = (value: RewriteTone) => {
    setTone(value);
    localStorage.setItem(TONE_STORAGE_KEY, value);
    onToneChange?.(value);
  };

  // Reset state when modal opens with new suggestion
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setIsEditing(false);
      setEditedText(suggestedText);
    }
  };

  const handleUseSuggestion = () => {
    onUseSuggestion(isEditing ? editedText : suggestedText);
    onClose();
    setIsEditing(false);
  };

  const handleEdit = () => {
    setEditedText(suggestedText);
    setIsEditing(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Mejorar redacción
          </DialogTitle>
          <DialogDescription>
            Revisa la sugerencia de IA y decide si usarla
          </DialogDescription>
        </DialogHeader>

        {/* Tone selector */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Tono:</label>
          <Select value={tone} onValueChange={(v) => handleToneChange(v as RewriteTone)}>
            <SelectTrigger className="w-[160px] h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">Formal (usted)</SelectItem>
              <SelectItem value="informal">Informal (tú)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Mejorando tu mensaje...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Original text */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                Texto original
              </label>
              <div className="p-3 bg-muted rounded-lg text-sm">
                {originalText}
              </div>
            </div>

            {/* Suggested/Edited text */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {isEditing ? 'Editar sugerencia' : 'Texto sugerido'}
              </label>
              {isEditing ? (
                <Textarea
                  value={editedText}
                  onChange={(e) => setEditedText(e.target.value)}
                  className="min-h-[100px] resize-none"
                  autoFocus
                />
              ) : (
                <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
                  {suggestedText}
                </div>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="sm:order-1"
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          
          {!isLoading && (
            <>
              {!isEditing && (
                <Button
                  variant="outline"
                  onClick={handleEdit}
                  className="sm:order-2"
                >
                  <Edit3 className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              )}
              
              <Button
                onClick={handleUseSuggestion}
                className="sm:order-3"
              >
                <Check className="h-4 w-4 mr-2" />
                Usar {isEditing ? 'texto editado' : 'sugerencia'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
