import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';

interface ImageLightboxProps {
  images: { url: string; name?: string }[];
  initialIndex?: number;
  open: boolean;
  onClose: () => void;
}

const isTwilioUrl = (url: string): boolean => {
  return url.includes('api.twilio.com') || url.includes('media.twiliocdn.com');
};

function useProxiedUrls(images: { url: string; name?: string }[], open: boolean) {
  const [proxiedMap, setProxiedMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;

    const toProxy = images.filter(img => isTwilioUrl(img.url) && !proxiedMap[img.url]);
    if (toProxy.length === 0) return;

    let cancelled = false;

    const fetchAll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;

      setLoading(prev => {
        const next = { ...prev };
        toProxy.forEach(img => { next[img.url] = true; });
        return next;
      });

      await Promise.all(toProxy.map(async (img) => {
        try {
          const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/proxy-twilio-media?url=${encodeURIComponent(img.url)}`;
          const res = await fetch(proxyUrl, {
            headers: { 'Authorization': `Bearer ${session.access_token}` },
          });
          if (!res.ok) throw new Error('proxy fail');
          const blob = await res.blob();
          if (cancelled) return;
          const blobUrl = URL.createObjectURL(blob);
          setProxiedMap(prev => ({ ...prev, [img.url]: blobUrl }));
        } catch {
          if (!cancelled) setProxiedMap(prev => ({ ...prev, [img.url]: img.url }));
        } finally {
          if (!cancelled) setLoading(prev => ({ ...prev, [img.url]: false }));
        }
      }));
    };

    fetchAll();

    return () => {
      cancelled = true;
    };
  }, [open, images]);

  // Cleanup blob URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(proxiedMap).forEach(url => {
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const getUrl = (originalUrl: string) => {
    if (!isTwilioUrl(originalUrl)) return originalUrl;
    return proxiedMap[originalUrl] || null;
  };

  const isLoading = (originalUrl: string) => {
    if (!isTwilioUrl(originalUrl)) return false;
    return loading[originalUrl] ?? (!proxiedMap[originalUrl]);
  };

  return { getUrl, isLoading };
}

export function ImageLightbox({
  images,
  initialIndex = 0,
  open,
  onClose,
}: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const { getUrl, isLoading } = useProxiedUrls(images, open);

  useEffect(() => {
    if (open) {
      setCurrentIndex(initialIndex);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open, initialIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrevious();
      if (e.key === 'ArrowRight') goToNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, currentIndex, images.length]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
  };

  const handleDownload = useCallback(async () => {
    const image = images[currentIndex];
    const resolvedUrl = getUrl(image.url);
    if (!resolvedUrl) return;

    const link = document.createElement('a');
    link.href = resolvedUrl;
    link.download = image.name || `image-${currentIndex + 1}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [currentIndex, images, getUrl]);

  if (!open || images.length === 0) return null;

  const currentImage = images[currentIndex];
  const resolvedUrl = getUrl(currentImage.url);
  const loading = isLoading(currentImage.url);

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 text-white hover:bg-white/20"
        onClick={onClose}
      >
        <X className="h-6 w-6" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-16 text-white hover:bg-white/20"
        onClick={handleDownload}
      >
        <Download className="h-5 w-5" />
      </Button>

      {images.length > 1 && (
        <>
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-4 text-white hover:bg-white/20"
            onClick={goToPrevious}
          >
            <ChevronLeft className="h-8 w-8" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 text-white hover:bg-white/20"
            onClick={goToNext}
          >
            <ChevronRight className="h-8 w-8" />
          </Button>
        </>
      )}

      <div className="max-w-[90vw] max-h-[90vh] overflow-hidden flex items-center justify-center">
        {loading ? (
          <Loader2 className="h-10 w-10 animate-spin text-white" />
        ) : (
          <img
            src={resolvedUrl || ''}
            alt={currentImage.name || ''}
            className="max-w-full max-h-[90vh] object-contain"
          />
        )}
      </div>

      {images.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}
    </div>
  );
}
