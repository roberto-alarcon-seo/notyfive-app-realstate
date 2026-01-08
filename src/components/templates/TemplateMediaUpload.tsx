import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Upload, X, Image, Video, FileText, AlertCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface MediaFile {
  url: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

interface TemplateMediaUploadProps {
  mediaType: 'image' | 'video' | 'document';
  value?: MediaFile | null;
  onChange: (media: MediaFile | null) => void;
  disabled?: boolean;
}

const mediaConfig = {
  image: {
    accept: '.jpg,.jpeg,.png',
    mimeTypes: ['image/jpeg', 'image/png'],
    maxSize: 5 * 1024 * 1024, // 5MB
    maxSizeLabel: '5MB',
    icon: Image,
    label: 'imagen',
  },
  video: {
    accept: '.mp4',
    mimeTypes: ['video/mp4'],
    maxSize: 16 * 1024 * 1024, // 16MB
    maxSizeLabel: '16MB',
    icon: Video,
    label: 'video',
  },
  document: {
    accept: '.pdf',
    mimeTypes: ['application/pdf'],
    maxSize: 10 * 1024 * 1024, // 10MB
    maxSizeLabel: '10MB',
    icon: FileText,
    label: 'documento PDF',
  },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export function TemplateMediaUpload({ mediaType, value, onChange, disabled }: TemplateMediaUploadProps) {
  const { tenant } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  const config = mediaConfig[mediaType];
  const Icon = config.icon;
  
  const validateFile = (file: File): string | null => {
    if (!config.mimeTypes.includes(file.type)) {
      return `Tipo de archivo no válido. Usa: ${config.accept}`;
    }
    if (file.size > config.maxSize) {
      return `El archivo excede el tamaño máximo de ${config.maxSizeLabel}`;
    }
    return null;
  };
  
  const uploadFile = async (file: File) => {
    if (!tenant?.id) {
      setError('No hay tenant activo');
      return;
    }
    
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setError(null);
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      // Generate unique filename
      const ext = file.name.split('.').pop();
      const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
      const filePath = `${tenant.id}/${uniqueName}`;
      
      // Simulate progress (Supabase doesn't provide upload progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 100);
      
      const { data, error: uploadError } = await supabase.storage
        .from('template-media')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      clearInterval(progressInterval);
      
      if (uploadError) throw uploadError;
      
      // Get public URL
      const { data: urlData } = supabase.storage
        .from('template-media')
        .getPublicUrl(data.path);
      
      setUploadProgress(100);
      
      onChange({
        url: urlData.publicUrl,
        filename: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      
      toast.success('Archivo subido correctamente');
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Error al subir archivo');
      toast.error('Error al subir archivo');
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [tenant?.id]);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    // Reset input
    if (inputRef.current) inputRef.current.value = '';
  };
  
  const handleRemove = async () => {
    if (value?.url && tenant?.id) {
      // Extract path from URL
      const urlParts = value.url.split('/template-media/');
      if (urlParts[1]) {
        await supabase.storage
          .from('template-media')
          .remove([urlParts[1]]);
      }
    }
    onChange(null);
    setError(null);
  };
  
  if (value) {
    return (
      <div className="border border-border rounded-lg p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{value.filename}</p>
            <p className="text-xs text-muted-foreground">{formatFileSize(value.sizeBytes)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => inputRef.current?.click()}
              disabled={disabled || isUploading}
            >
              <RefreshCw className="w-4 h-4 mr-1" />
              Reemplazar
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={handleRemove}
              disabled={disabled || isUploading}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
    );
  }
  
  return (
    <div className="space-y-2">
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
          isDragging && "border-primary bg-primary/5",
          error && "border-destructive",
          !isDragging && !error && "border-border hover:border-primary/50",
          (disabled || isUploading) && "opacity-50 cursor-not-allowed"
        )}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => !disabled && !isUploading && inputRef.current?.click()}
      >
        {isUploading ? (
          <div className="space-y-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
              <Upload className="w-5 h-5 text-primary animate-pulse" />
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Subiendo archivo...</p>
              <Progress value={uploadProgress} className="h-1 max-w-xs mx-auto" />
            </div>
          </div>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium mb-1">
              Arrastra tu {config.label} aquí
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground">
              {config.accept.replace(/\./g, '').toUpperCase()} • Máx. {config.maxSizeLabel}
            </p>
          </>
        )}
        
        <input
          ref={inputRef}
          type="file"
          accept={config.accept}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || isUploading}
        />
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
