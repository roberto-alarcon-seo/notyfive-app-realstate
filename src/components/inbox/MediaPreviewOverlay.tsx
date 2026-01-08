import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, FileVideo, FileAudio, FileText, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EmojiPicker } from "./EmojiPicker";
import type { MediaFile } from "./MediaUploadButton";

interface MediaPreviewOverlayProps {
  media: MediaFile;
  onClose: () => void;
  onSend: (caption: string) => void;
  isSending?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function MediaPreviewOverlay({
  media,
  onClose,
  onSend,
  isSending = false,
}: MediaPreviewOverlayProps) {
  const [caption, setCaption] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  }, []);

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

  const renderPreview = () => {
    switch (media.type) {
      case 'image':
        return (
          <img
            src={media.url}
            alt={media.filename}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        );
      
      case 'video':
        return (
          <video
            src={media.url}
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
              <p className="font-medium">{media.filename}</p>
              <p className="text-sm text-muted-foreground">{formatFileSize(media.sizeBytes)}</p>
            </div>
            <audio src={media.url} controls className="w-full max-w-sm" />
          </div>
        );
      
      case 'document':
      default:
        const isPDF = media.mimeType === 'application/pdf';
        
        return isPDF ? (
          <div className="w-full h-full max-w-2xl bg-card rounded-lg overflow-hidden flex flex-col">
            <iframe
              src={media.url}
              className="flex-1 w-full min-h-[300px]"
              title={media.filename}
            />
          </div>
        ) : (
          <div className="bg-card/80 backdrop-blur-sm rounded-2xl p-6 flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
              <FileText className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center">
              <p className="font-medium break-all">{media.filename}</p>
              <p className="text-sm text-muted-foreground mt-1">{formatFileSize(media.sizeBytes)}</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="absolute inset-0 z-40 bg-background flex flex-col animate-in fade-in duration-150">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <div className="text-center flex-1 min-w-0 px-2">
          <p className="font-medium text-sm truncate">{media.filename}</p>
          <p className="text-xs text-primary">{formatFileSize(media.sizeBytes)}</p>
        </div>
        
        <div className="w-8" />
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
            placeholder="Escribe un mensaje"
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

        {/* Thumbnail and Send */}
        <div className="flex items-center justify-center gap-3 mt-3">
          {/* Small Thumbnail */}
          {media.type === 'image' ? (
            <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-primary">
              <img
                src={media.url}
                alt="Preview"
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center border-2 border-primary">
              {media.type === 'video' && <FileVideo className="h-5 w-5 text-primary" />}
              {media.type === 'audio' && <FileAudio className="h-5 w-5 text-primary" />}
              {media.type === 'document' && <FileText className="h-5 w-5 text-primary" />}
            </div>
          )}
          
          {/* Add more button */}
          <div className="w-12 h-12 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
            <Plus className="h-5 w-5 text-muted-foreground/50" />
          </div>
          
          {/* Send Button */}
          <Button
            size="lg"
            onClick={() => onSend(caption)}
            disabled={isSending}
            className="h-12 w-12 rounded-full ml-2"
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
