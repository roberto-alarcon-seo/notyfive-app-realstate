import { useState, useCallback } from 'react';
import { X, Upload, Loader2, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadedFile {
  file: File;
  preview: string;
  uploading?: boolean;
}

interface SupportImageUploaderProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  disabled?: boolean;
}

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

export function SupportImageUploader({
  files,
  onChange,
  maxFiles = 5,
  maxSizeMB = 8,
  disabled = false,
}: SupportImageUploaderProps) {
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles || disabled) return;

    const validFiles: UploadedFile[] = [];
    const maxBytes = maxSizeMB * 1024 * 1024;

    for (let i = 0; i < newFiles.length && files.length + validFiles.length < maxFiles; i++) {
      const file = newFiles[i];
      
      if (!ACCEPTED_TYPES.includes(file.type)) {
        continue;
      }
      
      if (file.size > maxBytes) {
        continue;
      }

      validFiles.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    if (validFiles.length > 0) {
      onChange([...files, ...validFiles]);
    }
  }, [files, maxFiles, maxSizeMB, disabled, onChange]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const removeFile = useCallback((index: number) => {
    const newFiles = [...files];
    URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    onChange(newFiles);
  }, [files, onChange]);

  const canAddMore = files.length < maxFiles && !disabled;

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            'relative border-2 border-dashed rounded-lg p-4 transition-colors text-center',
            dragActive
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          <input
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            multiple
            onChange={(e) => handleFiles(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={disabled}
          />
          <div className="flex flex-col items-center gap-2">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arrastra imágenes aquí o haz clic para seleccionar
            </p>
            <p className="text-xs text-muted-foreground">
              PNG, JPG, WEBP • Máx {maxSizeMB}MB • Hasta {maxFiles} archivos
            </p>
          </div>
        </div>
      )}

      {/* Preview grid */}
      {files.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {files.map((file, index) => (
            <div
              key={index}
              className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted"
            >
              <img
                src={file.preview}
                alt={file.file.name}
                className="w-full h-full object-cover"
              />
              {file.uploading ? (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-6 w-6"
                  onClick={() => removeFile(index)}
                  disabled={disabled}
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Inline image attachment button for reply composer
interface AttachButtonProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

export function AttachImageButton({ onFilesSelected, disabled }: AttachButtonProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    
    const validFiles: File[] = [];
    const maxBytes = 8 * 1024 * 1024;
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (ACCEPTED_TYPES.includes(file.type) && file.size <= maxBytes) {
        validFiles.push(file);
      }
    }
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
    
    // Reset input
    e.target.value = '';
  };

  return (
    <label className="cursor-pointer">
      <input
        type="file"
        accept={ACCEPTED_TYPES.join(',')}
        multiple
        onChange={handleChange}
        className="hidden"
        disabled={disabled}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        asChild
      >
        <span>
          <ImageIcon className="h-4 w-4" />
        </span>
      </Button>
    </label>
  );
}