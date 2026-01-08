import { useState, useCallback, useEffect } from 'react';
import { Loader2, RefreshCw, ImageOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { SupportAttachment } from '@/hooks/useSupportTickets';

interface AttachmentThumbnailProps {
  attachment: SupportAttachment;
  onClick?: () => void;
  className?: string;
}

export function AttachmentThumbnail({
  attachment,
  onClick,
  className,
}: AttachmentThumbnailProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(
    attachment.signed_url || null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retrying, setRetrying] = useState(false);

  // Refresh signed URL if expired or missing
  const refreshSignedUrl = useCallback(async () => {
    const filePath = attachment.file_path || attachment.file_url;
    if (!filePath) {
      setError(true);
      setLoading(false);
      return;
    }

    // Clean up file_path if it contains public URL prefix
    let cleanPath = filePath;
    if (filePath.includes('/storage/v1/object/public/support-attachments/')) {
      cleanPath = filePath.split('/storage/v1/object/public/support-attachments/')[1];
    }

    setRetrying(true);
    try {
      const { data, error: urlError } = await supabase.storage
        .from('support-attachments')
        .createSignedUrl(cleanPath, 3600);

      if (urlError || !data?.signedUrl) {
        console.error('Error generating signed URL:', urlError);
        setError(true);
      } else {
        setSignedUrl(data.signedUrl);
        setError(false);
      }
    } catch (err) {
      console.error('Error refreshing signed URL:', err);
      setError(true);
    } finally {
      setRetrying(false);
      setLoading(false);
    }
  }, [attachment.file_path, attachment.file_url]);

  // Automatically generate signed URL on mount if not provided
  useEffect(() => {
    if (!attachment.signed_url) {
      refreshSignedUrl();
    } else {
      setSignedUrl(attachment.signed_url);
      setLoading(false);
    }
  }, [attachment.signed_url, refreshSignedUrl]);

  // Handle image load success
  const handleLoad = () => {
    setLoading(false);
    setError(false);
  };

  // Handle image load error
  const handleError = () => {
    setError(true);
    setLoading(false);
  };

  // Show loading state
  if (loading && !signedUrl) {
    return (
      <div
        className={cn(
          'relative aspect-video rounded-lg overflow-hidden bg-muted flex items-center justify-center',
          className
        )}
      >
        <Skeleton className="absolute inset-0" />
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground z-10" />
      </div>
    );
  }

  // Show error state with retry
  if (error || !signedUrl) {
    return (
      <div
        className={cn(
          'relative aspect-video rounded-lg overflow-hidden bg-muted flex flex-col items-center justify-center gap-2 border border-destructive/30',
          className
        )}
      >
        <ImageOff className="h-5 w-5 text-muted-foreground" />
        <p className="text-xs text-muted-foreground text-center px-2">
          No se pudo cargar
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            refreshSignedUrl();
          }}
          disabled={retrying}
          className="h-7 text-xs gap-1"
        >
          {retrying ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
          Reintentar
        </Button>
      </div>
    );
  }

  // Show image with hover effect
  return (
    <div
      className={cn(
        'relative aspect-video rounded-lg overflow-hidden cursor-pointer group',
        className
      )}
      onClick={onClick}
    >
      {/* Loading skeleton behind image */}
      {loading && <Skeleton className="absolute inset-0" />}
      
      <img
        src={signedUrl}
        alt={attachment.file_name}
        className={cn(
          'w-full h-full object-cover transition-all duration-200',
          'group-hover:scale-105 group-hover:brightness-90',
          loading && 'opacity-0'
        )}
        onLoad={handleLoad}
        onError={handleError}
      />
      
      {/* Hover overlay */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
    </div>
  );
}

interface AttachmentGridProps {
  attachments: SupportAttachment[];
  onImageClick: (images: { url: string; name?: string }[], index: number) => void;
}

export function AttachmentGrid({ attachments, onImageClick }: AttachmentGridProps) {
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

  // Generate signed URLs for all attachments that don't have one
  useEffect(() => {
    const generateUrls = async () => {
      const urlsToGenerate = attachments.filter(a => !a.signed_url && !signedUrls[a.id]);
      
      for (const att of urlsToGenerate) {
        const filePath = att.file_path || att.file_url;
        if (!filePath) continue;
        
        // Clean up file_path if it contains public URL prefix
        let cleanPath = filePath;
        if (filePath.includes('/storage/v1/object/public/support-attachments/')) {
          cleanPath = filePath.split('/storage/v1/object/public/support-attachments/')[1];
        }

        try {
          const { data } = await supabase.storage
            .from('support-attachments')
            .createSignedUrl(cleanPath, 3600);
          
          if (data?.signedUrl) {
            setSignedUrls(prev => ({ ...prev, [att.id]: data.signedUrl }));
          }
        } catch (err) {
          console.error('Error generating signed URL for attachment:', att.id, err);
        }
      }
    };

    if (attachments.length > 0) {
      generateUrls();
    }
  }, [attachments, signedUrls]);

  if (attachments.length === 0) return null;

  const handleClick = (index: number) => {
    const images = attachments
      .map((a) => ({
        url: a.signed_url || signedUrls[a.id] || '',
        name: a.file_name,
      }))
      .filter(img => img.url);
    
    if (images.length > 0) {
      onImageClick(images, Math.min(index, images.length - 1));
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {attachments.map((att, index) => (
        <AttachmentThumbnail
          key={att.id}
          attachment={{ ...att, signed_url: att.signed_url || signedUrls[att.id] }}
          onClick={() => handleClick(index)}
        />
      ))}
    </div>
  );
}
