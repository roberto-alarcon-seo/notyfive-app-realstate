import { cn } from "@/lib/utils";
import { Image, Play, FileText } from "lucide-react";

interface TemplatePreviewProps {
  headerType: string;
  headerText?: string;
  body: string;
  footer?: string;
  buttons?: { type: 'quick_reply' | 'url'; text: string; url?: string }[];
  media?: {
    url: string;
    filename: string;
    mimeType: string;
  } | null;
  className?: string;
}

// Sample data for preview
const sampleData: Record<string, string> = {
  nombre: 'María García',
  telefono: '+52 55 1234 5678',
  email: 'maria@ejemplo.com',
  empresa: 'Acme Corp',
  fecha: '15 de diciembre',
  hora: '10:00 AM',
  monto: '1,500',
  descuento: '20',
  pedido: 'ORD-12345',
  plan: 'Premium',
  producto: 'Servicio Pro',
};

function replaceVariables(text: string): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, variable) => {
    const key = variable.trim().replace('custom.', '');
    return sampleData[key] || `[${variable}]`;
  });
}

function getMediaType(mimeType: string): 'image' | 'video' | 'document' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}

export function TemplatePreview({ 
  headerType, 
  headerText, 
  body, 
  footer, 
  buttons = [],
  media,
  className 
}: TemplatePreviewProps) {
  const processedHeader = headerText ? replaceVariables(headerText) : '';
  const processedBody = replaceVariables(body || 'Escribe el cuerpo del mensaje...');
  const processedFooter = footer ? replaceVariables(footer) : '';
  
  const isMediaHeader = ['image', 'video', 'document'].includes(headerType);
  const mediaType = media?.mimeType ? getMediaType(media.mimeType) : headerType as 'image' | 'video' | 'document';
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* WhatsApp Header */}
      <div className="bg-[#075E54] px-4 py-3 rounded-t-xl flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-semibold">
          CP
        </div>
        <div>
          <p className="text-white font-medium text-sm">Cliente potencial</p>
          <p className="text-white/70 text-xs">en línea</p>
        </div>
      </div>
      
      {/* Chat Area */}
      <div className="flex-1 bg-[#0B141A] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iNDAwIj48ZGVmcz48cGF0dGVybiBpZD0iYSIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIj48cGF0aCBkPSJNMCAyMGgyMHYyMGgtMjB6IiBmaWxsPSJyZ2JhKDI1NSwgMjU1LCAyNTUsIDAuMDMpIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')] p-4 min-h-[300px] flex flex-col justify-end">
        {/* Message Bubble */}
        <div className="max-w-[85%] ml-auto">
          <div className="bg-[#005C4B] rounded-lg overflow-hidden text-white shadow-lg">
            {/* Media Header */}
            {isMediaHeader && (
              <div className="relative">
                {mediaType === 'image' && (
                  media?.url ? (
                    <img 
                      src={media.url} 
                      alt="Template media" 
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-[#003d3d] flex items-center justify-center">
                      <div className="text-center">
                        <Image className="w-10 h-10 text-white/40 mx-auto mb-2" />
                        <p className="text-xs text-white/40">Imagen del encabezado</p>
                      </div>
                    </div>
                  )
                )}
                
                {mediaType === 'video' && (
                  media?.url ? (
                    <div className="relative w-full h-40 bg-black">
                      <video 
                        src={media.url} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                          <Play className="w-6 h-6 text-white fill-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-40 bg-[#003d3d] flex items-center justify-center">
                      <div className="text-center">
                        <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-2">
                          <Play className="w-6 h-6 text-white/40 fill-white/40" />
                        </div>
                        <p className="text-xs text-white/40">Video del encabezado</p>
                      </div>
                    </div>
                  )
                )}
                
                {mediaType === 'document' && (
                  <div className="p-3 bg-[#003d3d] flex items-center gap-3">
                    <div className="w-10 h-12 bg-white/10 rounded flex items-center justify-center">
                      <FileText className="w-5 h-5 text-white/60" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {media?.filename || 'documento.pdf'}
                      </p>
                      <p className="text-xs text-white/50">PDF</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="p-3">
              {/* Text Header */}
              {headerType === 'text' && processedHeader && (
                <div className="font-semibold text-sm mb-2 pb-2 border-b border-white/10">
                  {processedHeader}
                </div>
              )}
              
              {/* Body */}
              <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                {processedBody}
              </p>
              
              {/* Footer */}
              {processedFooter && (
                <p className="text-xs text-white/60 mt-2 pt-2 border-t border-white/10">
                  {processedFooter}
                </p>
              )}
              
              {/* Timestamp */}
              <div className="flex items-center justify-end gap-1 mt-1">
                <span className="text-[10px] text-white/50">12:00</span>
                <svg className="w-4 h-4 text-[#53BDEB]" viewBox="0 0 16 11" fill="currentColor">
                  <path d="M11.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .501.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.337-.273z"/>
                  <path d="M14.071.653a.457.457 0 0 0-.304-.102.493.493 0 0 0-.381.178l-6.19 7.636-2.405-2.272a.463.463 0 0 0-.336-.146.47.47 0 0 0-.343.146l-.311.31a.445.445 0 0 0-.14.337c0 .136.047.25.14.343l2.996 2.996a.724.724 0 0 0 .501.203.697.697 0 0 0 .546-.266l6.646-8.417a.497.497 0 0 0 .108-.299.441.441 0 0 0-.19-.374l-.337-.273z" transform="translate(-3)"/>
                </svg>
              </div>
            </div>
          </div>
          
          {/* Buttons */}
          {buttons.length > 0 && (
            <div className="mt-1 space-y-1">
              {buttons.map((button, index) => (
                <button
                  key={index}
                  className="w-full bg-[#005C4B] text-[#53BDEB] text-sm py-2 px-4 rounded-lg flex items-center justify-center gap-2"
                >
                  {button.type === 'url' && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  )}
                  {button.text || 'Botón'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Note */}
      <div className="bg-muted/50 px-4 py-3 rounded-b-xl border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Los valores entre <code className="bg-accent/20 px-1 rounded">{'{{'}</code> y <code className="bg-accent/20 px-1 rounded">{'}}'}</code> serán reemplazados con datos reales del contacto
        </p>
      </div>
    </div>
  );
}
