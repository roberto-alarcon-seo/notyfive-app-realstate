import { useState, useEffect, useCallback } from "react";
import { FileText, Download, MapPin, Volume2, Image, File, X, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ImageLightbox } from "@/components/support/ImageLightbox";

interface MediaProps {
  type: string | null;
  url: string | null;
  mimeType?: string | null;
  filename?: string | null;
  sizeBytes?: number | null;
  durationSec?: number | null;
  locationLat?: number | null;
  locationLng?: number | null;
  // Legacy support for media_urls array
  mediaUrls?: string[] | null;
}

interface MessageMediaRendererProps {
  media: MediaProps;
  className?: string;
}

const formatFileSize = (bytes: number | null): string => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDuration = (seconds: number | null): string => {
  if (!seconds) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Check if URL is a Twilio media URL
const isTwilioUrl = (url: string): boolean => {
  return url.includes('api.twilio.com') || url.includes('media.twiliocdn.com');
};

async function openViaProxyIfNeeded(url: string) {
  // If it's already a blob URL or not a Twilio URL, open directly
  if (url.startsWith('blob:') || !isTwilioUrl(url)) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    // Without session we can't proxy; fallback to direct open
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-twilio-media?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl, {
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
    },
  });

  if (!response.ok) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');

  // Revoke after some time to allow the new tab to load it
  setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
}

// Hook to get proxied URL for Twilio media
function useProxiedMediaUrl(originalUrl: string | null) {
  const [proxiedUrl, setProxiedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!originalUrl) {
      setProxiedUrl(null);
      return;
    }

    // If not a Twilio URL, use directly
    if (!isTwilioUrl(originalUrl)) {
      setProxiedUrl(originalUrl);
      return;
    }

    // Fetch via proxy
    const fetchProxiedMedia = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('No session');
          return;
        }

        const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-twilio-media?url=${encodeURIComponent(originalUrl)}`;

        const response = await fetch(proxyUrl, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Proxy failed: ${response.status}`);
        }

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        setProxiedUrl(blobUrl);
      } catch (err) {
        console.error('Error fetching proxied media:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        // Fallback to original URL
        setProxiedUrl(originalUrl);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProxiedMedia();

    // Cleanup blob URL on unmount
    return () => {
      if (proxiedUrl && proxiedUrl.startsWith('blob:')) {
        URL.revokeObjectURL(proxiedUrl);
      }
    };
  }, [originalUrl]);

  return { url: proxiedUrl, isLoading, error };
}

export function MessageMediaRenderer({ media, className }: MessageMediaRendererProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const { url: proxiedUrl, isLoading: mediaLoading } = useProxiedMediaUrl(media.url);

  // Handle multiple images (media_urls array with more than 1 item)
  const multipleImages = media.mediaUrls && media.mediaUrls.length > 1 && 
    (media.type === 'image' || !media.type || media.mimeType?.startsWith('image/'));
  
  if (multipleImages) {
    const urls = media.mediaUrls!;
    const gridCols = urls.length === 2 ? 'grid-cols-2' : urls.length >= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-1';
    return (
      <div className={cn("space-y-1", className)}>
        <div className={cn("grid gap-1.5", gridCols)}>
          {urls.map((url, idx) => (
            <MultiImagePreview
              key={idx}
              url={url}
              onExpand={() => { setLightboxIndex(idx); setLightboxOpen(true); }}
              className="!max-w-full"
            />
          ))}
        </div>
        <ImageLightbox
          images={urls.map((u, i) => ({ url: u, name: `imagen-${i + 1}` }))}
          initialIndex={lightboxIndex}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </div>
    );
  }

  // Handle single media_urls array (legacy)
  if (media.mediaUrls && media.mediaUrls.length === 1 && !media.url) {
    return (
      <>
        <ImagePreview
          url={media.mediaUrls[0]}
          onExpand={() => { setLightboxIndex(0); setLightboxOpen(true); }}
          className={className}
        />
        <ImageLightbox
          images={[{ url: media.mediaUrls[0], name: 'imagen' }]}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  if (!media.url && !media.locationLat) return null;

  const mediaType = media.type?.toLowerCase() || 'unknown';
  const isTwilio = isTwilioUrl(media.url || '');

  // Show loading state for Twilio media — never render raw Twilio URLs
  if (isTwilio && (mediaLoading || !proxiedUrl)) {
    return (
      <div className={cn("flex items-center justify-center p-4 bg-muted/50 rounded-lg min-w-32 min-h-20", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Safe URL: use proxied for Twilio, original for everything else
  const safeUrl = isTwilio ? proxiedUrl! : media.url!;

  // Image
  if (mediaType === 'image' || media.mimeType?.startsWith('image/')) {
    return (
      <>
        <ImagePreview
          url={safeUrl}
          onExpand={() => { setLightboxIndex(0); setLightboxOpen(true); }}
          className={className}
        />
        <ImageLightbox
          images={[{ url: safeUrl, name: media.filename || 'imagen' }]}
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
        />
      </>
    );
  }

  // Video
  if (mediaType === 'video' || media.mimeType?.startsWith('video/')) {
    return (
      <div className={cn("relative max-w-xs rounded-lg overflow-hidden bg-black/10", className)}>
        <video
          src={safeUrl}
          controls
          preload="metadata"
          className="max-w-full max-h-64 rounded-lg"
        >
          Tu navegador no soporta video.
        </video>
        {media.durationSec && (
          <span className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
            {formatDuration(media.durationSec)}
          </span>
        )}
      </div>
    );
  }

  // Audio / Voice note
  if (mediaType === 'audio' || media.mimeType?.startsWith('audio/')) {
    return (
      <div className={cn("flex items-center gap-3 bg-muted/50 rounded-lg p-3 min-w-48", className)}>
        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
          <Volume2 className="h-5 w-5 text-primary" />
        </div>
        <audio
          src={safeUrl}
          controls
          className="flex-1 h-8"
          style={{ minWidth: '150px' }}
        />
        {media.durationSec && (
          <span className="text-xs text-muted-foreground shrink-0">
            {formatDuration(media.durationSec)}
          </span>
        )}
      </div>
    );
  }

  // Document
  if (mediaType === 'document' || media.mimeType?.startsWith('application/')) {
    // Get extension from filename or mime type
    const getExtension = () => {
      if (media.filename) {
        const ext = media.filename.split('.').pop();
        if (ext && ext.length <= 5) return ext.toUpperCase();
      }
      // Fallback to mime type
      const mimeExtensions: Record<string, string> = {
        'application/pdf': 'PDF',
        'application/msword': 'DOC',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
        'application/vnd.ms-excel': 'XLS',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'XLSX',
        'application/vnd.ms-powerpoint': 'PPT',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
        'text/plain': 'TXT',
        'text/csv': 'CSV',
      };
      return mimeExtensions[media.mimeType || ''] || 'DOC';
    };

    // Clean up filename - detect if it's a hash/SID and replace with friendly name
    const getDisplayFilename = () => {
      const filename = media.filename;
      if (!filename) return 'Documento';

      // Check if filename looks like a hash/SID (all alphanumeric, >20 chars, no extension)
      const isHashFilename = /^[A-Za-z0-9]{20,}$/.test(filename.split('.')[0]);
      if (isHashFilename) {
        return `Documento.${getExtension().toLowerCase()}`;
      }
      return filename;
    };

    const extension = getExtension();
    const displayFilename = getDisplayFilename();

    return (
      <DocumentPreview
        url={safeUrl}
        originalUrl={media.url!}
        displayFilename={displayFilename}
        extension={extension}
        sizeBytes={media.sizeBytes}
        className={className}
      />
    );
  }

  // Location
  if (mediaType === 'location' || (media.locationLat && media.locationLng)) {
    const lat = media.locationLat;
    const lng = media.locationLng;
    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    return (
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={cn("block rounded-lg overflow-hidden bg-muted/50 max-w-xs", className)}
      >
        <div className="w-full h-32 bg-muted flex items-center justify-center">
          <MapPin className="h-8 w-8 text-primary" />
        </div>
        <div className="p-2 flex items-center gap-2">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {lat?.toFixed(6)}, {lng?.toFixed(6)}
          </span>
        </div>
      </a>
    );
  }

  // Sticker
  if (mediaType === 'sticker') {
    return (
      <img
        src={safeUrl}
        alt="Sticker"
        loading="lazy"
        decoding="async"
        className={cn("max-w-24 max-h-24", className)}
      />
    );
  }

  // Unknown/fallback - generic file
  return (
    <div className={cn("flex items-center gap-3 bg-muted/50 rounded-lg p-3 max-w-xs", className)}>
      <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <File className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {media.filename || 'Archivo'}
        </p>
        {media.sizeBytes && (
          <p className="text-xs text-muted-foreground">
            {formatFileSize(media.sizeBytes)}
          </p>
        )}
      </div>
      <DownloadButton url={safeUrl} filename={media.filename || 'archivo'} />
    </div>
  );
}

// Document preview with open + download capability
function DocumentPreview({
  url,
  originalUrl,
  displayFilename,
  extension,
  sizeBytes,
  className
}: {
  url: string;
  originalUrl: string;
  displayFilename: string;
  extension: string;
  sizeBytes?: number | null;
  className?: string;
}) {
  const handleOpen = useCallback(async () => {
    try {
      // Always open using the ORIGINAL url (so the proxy check sees it's Twilio)
      await openViaProxyIfNeeded(originalUrl);
    } catch (e) {
      console.error('Open document error:', e);
      window.open(originalUrl, '_blank', 'noopener,noreferrer');
    }
  }, [originalUrl]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') handleOpen();
      }}
      className={cn(
        "flex items-center gap-3 bg-muted/50 rounded-lg p-3 max-w-xs cursor-pointer hover:bg-muted/70 transition-colors",
        className
      )}
      aria-label={`Abrir documento ${displayFilename}`}
    >
      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
        <FileText className="h-5 w-5 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{displayFilename}</p>
        <p className="text-xs text-muted-foreground">{extension} {sizeBytes ? `• ${formatFileSize(sizeBytes)}` : ''}</p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          handleOpen();
        }}
        aria-label="Abrir"
      >
        <ExternalLink className="h-4 w-4" />
      </Button>
      <DownloadButton url={url} filename={displayFilename} />
    </div>
  );
}

// Download button that handles both blob and regular URLs
function DownloadButton({ url, filename }: { url: string; filename: string }) {
  const handleDownload = useCallback(async () => {
    // If it's already a blob URL or not a Twilio URL, just open it
    if (url.startsWith('blob:') || !isTwilioUrl(url)) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // For Twilio URLs, fetch via proxy
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.open(url, '_blank');
        return;
      }

      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-twilio-media?url=${encodeURIComponent(url)}`;

      const response = await fetch(proxyUrl, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Download error:', error);
      // Fallback to opening in new tab
      window.open(url, '_blank');
    }
  }, [url, filename]);

  return (
    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={handleDownload} aria-label="Descargar">
      <Download className="h-4 w-4" />
    </Button>
  );
}

// Image preview component
function ImagePreview({
  url,
  onExpand,
  className
}: {
  url: string;
  onExpand: () => void;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { url: proxiedUrl, isLoading: proxyLoading } = useProxiedMediaUrl(url);

  if (hasError) {
    return (
      <div className={cn("w-48 h-32 bg-muted rounded-lg flex items-center justify-center", className)}>
        <Image className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  const displayUrl = proxiedUrl || url;

  return (
    <div className={cn("relative max-w-xs cursor-pointer group", className)}>
      {(isLoading || proxyLoading) && (
        <div className="absolute inset-0 bg-muted rounded-lg flex items-center justify-center min-w-32 min-h-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={displayUrl}
        alt="Imagen"
        loading="lazy"
        decoding="async"
        className={cn(
          "max-w-full max-h-64 rounded-lg transition-opacity",
          (isLoading || proxyLoading) ? "opacity-0" : "opacity-100"
        )}
        onClick={() => onExpand()}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors pointer-events-none" />
    </div>
  );
}

// Multi-image preview (uses proxy internally)
function MultiImagePreview({
  url,
  onExpand,
  className
}: {
  url: string;
  onExpand: () => void;
  className?: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const { url: proxiedUrl, isLoading: proxyLoading } = useProxiedMediaUrl(url);

  if (hasError) {
    return (
      <div className={cn("w-48 h-32 bg-muted rounded-lg flex items-center justify-center", className)}>
        <Image className="h-8 w-8 text-muted-foreground" />
      </div>
    );
  }

  const displayUrl = proxiedUrl || url;

  return (
    <div className={cn("relative max-w-xs cursor-pointer group", className)}>
      {(isLoading || proxyLoading) && (
        <div className="absolute inset-0 bg-muted rounded-lg flex items-center justify-center min-w-32 min-h-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <img
        src={displayUrl}
        alt="Imagen"
        loading="lazy"
        decoding="async"
        className={cn(
          "max-w-full max-h-64 rounded-lg transition-opacity",
          (isLoading || proxyLoading) ? "opacity-0" : "opacity-100"
        )}
        onClick={() => onExpand()}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setIsLoading(false);
          setHasError(true);
        }}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-lg transition-colors pointer-events-none" />
    </div>
  );
}
