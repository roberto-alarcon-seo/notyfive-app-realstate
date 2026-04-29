import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, FileVideo, FileAudio, FileText, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { MediaFile } from "./MediaUploadButton";

interface MediaPreviewOverlayProps {
  mediaFiles: MediaFile[];
  onClose: () => void;
  onSend: (caption: string) => void;
  onAddMore: (files: MediaFile[]) => void;
  onRemoveFile: (index: number) => void;
  isSending?: boolean;
  tenantId?: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const MAX_FILES = 10;

export function MediaPreviewOverlay({
  mediaFiles,
  onClose,
  onSend,
  onAddMore,
  onRemoveFile,
  isSending = false,
  tenantId,
}: MediaPreviewOverlayProps) {
  const [caption, setCaption] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const addMoreRef = useRef<HTMLInputElement>(null);

  const activeMedia = mediaFiles[activeIndex] || mediaFiles[0];

  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

  // Keep activeIndex in bounds
  useEffect(() => {
    if (activeIndex >= mediaFiles.length) {
      setActiveIndex(Math.max(0, mediaFiles.length - 1));
    }
  }, [mediaFiles.length, activeIndex]);

  const handleEmojiSelect = (emoji: string) => {
    const input = inputRef.current;
    if (!input) {
      setCaption(prev => prev + emoji);
      return;
    }
    const start = input.selectionStart || 0;
    const end = input.selectionEnd || 0;
    const newText = caption.substring(0, start) + emoji + caption.substring(end);
    setCaption(newText);
    setTimeout(() => {
      input.focus();
      input.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend(caption);
    }
    if (e.key === 'Escape') {
      onClose();
    }
  };

  const handleAddMoreFiles = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const remaining = MAX_FILES - mediaFiles.length;
    if (remaining <= 0) {
      toast.error(`Máximo ${MAX_FILES} archivos`);
      return;
    }

    setIsUploading(true);
    const fileArray = Array.from(files).slice(0, remaining);
    const uploaded: MediaFile[] = [];

    for (const file of fileArray) {
      try {
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 8);
        const extension = file.name.split('.').pop() || 'bin';
        const filename = `${tenantId || 'unknown'}/${timestamp}-${randomId}.${extension}`;

        const { data, error } = await supabase.storage
          .from('inbox-media')
          .upload(filename, file, { cacheControl: '3600', upsert: false });

        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage
          .from('inbox-media')
          .getPublicUrl(data.path);

        const mediaType = file.type.startsWith('image/') ? 'image' as const
          : file.type.startsWith('video/') ? 'video' as const
          : file.type.startsWith('audio/') ? 'audio' as const
          : 'document' as const;

        uploaded.push({
          url: publicUrl,
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          type: mediaType,
          file,
        });
      } catch (err) {
        console.error('Upload error:', err);
        toast.error(`Error al subir ${file.name}`);
      }
    }

    if (uploaded.length > 0) {
      onAddMore(uploaded);
    }
    setIsUploading(false);
    if (addMoreRef.current) addMoreRef.current.value = '';
  }, [mediaFiles.length, tenantId, onAddMore]);

  const renderPreview = () => {
    if (!activeMedia) return null;
    
    switch (activeMedia.type) {
      case 'image':
        return (
          <img
            src={activeMedia.url}
            alt={activeMedia.filename}
            loading="lazy"
            decoding="async"
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        );
      case 'video':
        return (
          <video
            src={activeMedia.url}
            controls
            className="max-w-full max-h-full rounded-lg"
          />
        );
      case 'audio':
        return (
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
              <FileAudio className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium">{activeMedia.filename}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(activeMedia.sizeBytes)}</p>
            </div>
            <audio src={activeMedia.url} controls className="w-full max-w-sm" />
          </div>
        );
      case 'document':
      default:
        const isPDF = activeMedia.mimeType === 'application/pdf';
        return isPDF ? (
          <div className="w-full h-full max-w-2xl bg-card rounded-lg overflow-hidden flex flex-col">
            <iframe src={activeMedia.url} className="flex-1 w-full min-h-[300px]" title={activeMedia.filename} />
          </div>
        ) : (
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium break-all">{activeMedia.filename}</p>
              <p className="text-sm text-muted-foreground mt-1">{formatFileSize(activeMedia.sizeBytes)}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-background flex flex-col animate-in fade-in duration-150">
      {/* Hidden input for adding more files */}
      <input
        ref={addMoreRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleAddMoreFiles}
        className="hidden"
      />

      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
        
        <div className="text-center flex-1 min-w-0 px-2">
          <p className="font-medium text-sm truncate">{activeMedia?.filename}</p>
          <p className="text-xs text-primary">
            {activeMedia && formatFileSize(activeMedia.sizeBytes)}
            {mediaFiles.length > 1 && ` · ${activeIndex + 1} de ${mediaFiles.length}`}
          </p>
        </div>
        
        {/* Remove current file */}
        {mediaFiles.length > 1 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onRemoveFile(activeIndex)}
            className="h-8 w-8 text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
        {mediaFiles.length <= 1 && <div className="w-8" />}
      </div>

      {/* Preview Area */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
        {renderPreview()}
      </div>

      {/* Footer with input */}
      <div className="p-3 border-t border-border shrink-0">
        {/* Caption Input */}
        <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-1">
          <EmojiPicker onEmojiSelect={handleEmojiSelect} disabled={isSending} />
          
          <Input
            ref={inputRef}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={mediaFiles.length > 1 ? `Mensaje (${mediaFiles.length} archivos)` : "Escribe un mensaje"}
            disabled={isSending}
            className="flex-1 border-none bg-transparent focus-visible:ring-0 h-9"
          />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCaption("")}
            className="h-8 w-8 shrink-0"
            disabled={!caption}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Thumbnails and Send */}
        <div className="flex items-center justify-center gap-2 mt-3 overflow-x-auto py-1">
          {mediaFiles.map((m, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIndex(idx)}
              className={cn(
                "w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-all",
                idx === activeIndex ? "border-primary ring-1 ring-primary/30" : "border-transparent opacity-60 hover:opacity-100"
              )}
            >
              {m.type === 'image' ? (
                <img src={m.url} alt={m.filename} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-primary/20 flex items-center justify-center">
                  {m.type === 'video' && <FileVideo className="h-5 w-5 text-primary" />}
                  {m.type === 'audio' && <FileAudio className="h-5 w-5 text-primary" />}
                  {m.type === 'document' && <FileText className="h-5 w-5 text-primary" />}
                </div>
              )}
            </button>
          ))}
          
          {/* Add more button */}
          {mediaFiles.length < MAX_FILES && (
            <button
              onClick={() => addMoreRef.current?.click()}
              disabled={isUploading}
              className="w-12 h-12 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0 hover:border-primary/50 transition-colors"
            >
              {isUploading ? (
                <Loader2 className="h-5 w-5 text-muted-foreground/50 animate-spin" />
              ) : (
                <Plus className="h-5 w-5 text-muted-foreground/50" />
              )}
            </button>
          )}
          
          {/* Send Button */}
          <Button
            size="lg"
            onClick={() => onSend(caption)}
            disabled={isSending || isUploading}
            className="h-12 w-12 rounded-full ml-2 shrink-0"
          >
            {isSending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
