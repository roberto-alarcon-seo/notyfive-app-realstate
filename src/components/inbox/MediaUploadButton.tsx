import { useState, useRef, useCallback } from "react";
import { Paperclip, Image, FileVideo, FileAudio, FileText, X, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface MediaFile {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: 'image' | 'video' | 'audio' | 'document';
  file: File;
}

interface MediaUploadButtonProps {
  onMediaSelected: (media: MediaFile[]) => void;
  onMediaRemoved: () => void;
  selectedMedia: MediaFile | null;
  disabled?: boolean;
  tenantId?: string;
  /** Allow selecting multiple files (only for images) */
  multiple?: boolean;
}

const MAX_FILE_SIZES: Record<string, number> = {
  image: 5 * 1024 * 1024,     // 5MB
  video: 16 * 1024 * 1024,    // 16MB
  audio: 16 * 1024 * 1024,    // 16MB
  document: 100 * 1024 * 1024, // 100MB
};

const ACCEPTED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  video: ['video/mp4', 'video/quicktime', 'video/3gpp'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/aac', 'audio/amr'],
  document: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/zip',
    'text/plain',
  ],
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const getMediaType = (mimeType: string): 'image' | 'video' | 'audio' | 'document' => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  return 'document';
};

const MAX_MULTI_FILES = 10;

export function MediaUploadButton({
  onMediaSelected,
  onMediaRemoved,
  selectedMedia,
  disabled,
  tenantId,
  multiple = false,
}: MediaUploadButtonProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [acceptType, setAcceptType] = useState<string>('*/*');
  const [isMultiple, setIsMultiple] = useState(false);

  const uploadSingleFile = async (file: File): Promise<MediaFile | null> => {
    const mediaType = getMediaType(file.type);
    const maxSize = MAX_FILE_SIZES[mediaType];
    const acceptedTypes = ACCEPTED_TYPES[mediaType];

    if (!acceptedTypes.some(type => file.type === type || file.type.startsWith(type.split('/')[0]))) {
      toast.error(`Tipo de archivo no soportado: ${file.type}`);
      return null;
    }

    if (file.size > maxSize) {
      toast.error(`${file.name} es muy grande. Máximo: ${formatFileSize(maxSize)}`);
      return null;
    }

    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split('.').pop() || 'bin';
    const filename = `${tenantId || 'unknown'}/${timestamp}-${randomId}.${extension}`;

    const { data, error: uploadError } = await supabase.storage
      .from('inbox-media')
      .upload(filename, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('inbox-media')
      .getPublicUrl(data.path);

    return {
      url: publicUrl,
      filename: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      type: mediaType,
      file,
    };
  };

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setError(null);
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const fileArray = Array.from(files).slice(0, MAX_MULTI_FILES);
      const uploaded: MediaFile[] = [];
      
      for (let i = 0; i < fileArray.length; i++) {
        setUploadProgress(Math.round(((i) / fileArray.length) * 90));
        const result = await uploadSingleFile(fileArray[i]);
        if (result) {
          uploaded.push(result);
        }
      }

      setUploadProgress(100);

      if (uploaded.length > 0) {
        onMediaSelected(uploaded);
        toast.success(uploaded.length === 1 ? 'Archivo adjuntado' : `${uploaded.length} archivos adjuntados`);
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError('Error al subir el archivo');
      toast.error('Error al subir el archivo');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [tenantId, onMediaSelected]);

  const triggerFileSelect = (accept: string, allowMultiple: boolean = false) => {
    setAcceptType(accept);
    setIsMultiple(allowMultiple);
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 0);
  };

  // Show preview when media is selected
  if (selectedMedia) {
    return (
      <div className="relative inline-flex items-center gap-2 bg-muted rounded-lg p-2 max-w-48">
        {selectedMedia.type === 'image' ? (
          <img
            src={selectedMedia.url}
            alt={selectedMedia.filename}
            className="w-10 h-10 rounded object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-primary/20 flex items-center justify-center">
            {selectedMedia.type === 'video' && <FileVideo className="h-5 w-5 text-primary" />}
            {selectedMedia.type === 'audio' && <FileAudio className="h-5 w-5 text-primary" />}
            {selectedMedia.type === 'document' && <FileText className="h-5 w-5 text-primary" />}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium truncate">{selectedMedia.filename}</p>
          <p className="text-xs text-muted-foreground">{formatFileSize(selectedMedia.sizeBytes)}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onMediaRemoved}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  // Show uploading state
  if (isUploading) {
    return (
      <div className="flex items-center gap-2 min-w-32">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <div className="flex-1">
          <Progress value={uploadProgress} className="h-1" />
          <span className="text-xs text-muted-foreground">Subiendo...</span>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive">
        <AlertTriangle className="h-4 w-4" />
        <span className="text-xs">{error}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto py-0 px-1"
          onClick={() => setError(null)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptType}
        multiple={isMultiple}
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-11 w-11 shrink-0"
            disabled={disabled}
          >
            <Paperclip className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          <DropdownMenuItem onClick={() => triggerFileSelect('image/*', true)}>
            <Image className="h-4 w-4 mr-2" />
            Imagen
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileSelect('video/*')}>
            <FileVideo className="h-4 w-4 mr-2" />
            Video
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileSelect('audio/*')}>
            <FileAudio className="h-4 w-4 mr-2" />
            Audio
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileSelect('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt')}>
            <FileText className="h-4 w-4 mr-2" />
            Documento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
