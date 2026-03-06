import { useState, useRef } from "react";
import {
  Youtube,
  Image as ImageIcon,
  FileText,
  Upload,
  Trash2,
  Star,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  Plus,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  usePropertyImages,
  usePropertyDocuments,
  usePropertyImageMutations,
  usePropertyDocumentMutations,
} from "@/hooks/useProperties";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PropertyMultimediaTabProps {
  propertyId?: string;
  youtubeUrl?: string;
  onYoutubeUrlChange?: (url: string) => void;
}

const YOUTUBE_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)[\w-]+/;

function extractYoutubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  return match ? match[1] : null;
}

export default function PropertyMultimediaTab({ propertyId, youtubeUrl: externalYoutubeUrl, onYoutubeUrlChange }: PropertyMultimediaTabProps) {
  const { data: images, isLoading: loadingImages } = usePropertyImages(propertyId);
  const { data: documents, isLoading: loadingDocs } = usePropertyDocuments(propertyId);
  
  // Always call hooks unconditionally
  const imageMutations = usePropertyImageMutations(propertyId || "placeholder");
  const docMutations = usePropertyDocumentMutations(propertyId || "placeholder");

  const [localYoutubeUrl, setLocalYoutubeUrl] = useState("");
  const youtubeUrl = externalYoutubeUrl ?? localYoutubeUrl;
  const setYoutubeUrl = onYoutubeUrlChange ?? setLocalYoutubeUrl;
  const [imageUrlInput, setImageUrlInput] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  if (!propertyId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Guarda la propiedad primero para agregar multimedia
        </CardContent>
      </Card>
    );
  }

  const handleAddImageUrl = async () => {
    if (!imageUrlInput.trim()) return;

    await imageMutations.addImage.mutateAsync({
      file_url: imageUrlInput,
      sort_order: images?.length || 0,
    });

    setImageUrlInput("");
    toast.success("Imagen agregada");
  };

  const handleUploadImages = async (files: FileList) => {
    setUploadingImage(true);

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${propertyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("property-images")
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("property-images")
          .getPublicUrl(path);

        await imageMutations.addImage.mutateAsync({
          file_url: urlData.publicUrl,
          file_path: path,
          sort_order: (images?.length || 0) + 1,
        });
      }
      toast.success("Imágenes subidas");
    } catch (error) {
      toast.error("Error al subir imágenes");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleUploadDocs = async (files: FileList) => {
    setUploadingDoc(true);

    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const path = `${propertyId}/${Date.now()}-${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("property-documents")
          .upload(path, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("property-documents")
          .getPublicUrl(path);

        await docMutations.addDocument.mutateAsync({
          file_url: urlData.publicUrl,
          file_path: path,
          file_name: file.name,
          file_type: ext || "unknown",
        });
      }
      toast.success("Documentos subidos");
    } catch (error) {
      toast.error("Error al subir documentos");
    } finally {
      setUploadingDoc(false);
    }
  };

  const youtubeId = YOUTUBE_REGEX.test(youtubeUrl)
    ? extractYoutubeId(youtubeUrl)
    : null;

  return (
    <div className="space-y-6">
      {/* YouTube */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Video de YouTube
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Input
              value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Se guarda automáticamente al presionar "Guardar"
            </p>
          </div>
          {youtubeId && (
            <div className="aspect-video rounded-lg overflow-hidden bg-muted">
              <iframe
                src={`https://www.youtube.com/embed/${youtubeId}`}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5" />
            Imágenes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => imageInputRef.current?.click()}
          >
            {uploadingImage ? (
              <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Arrastra imágenes aquí o haz clic para seleccionar
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPG, PNG, WebP
                </p>
              </>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUploadImages(e.target.files)}
            />
          </div>

          {/* Add by URL */}
          <div className="flex gap-2">
            <Input
              value={imageUrlInput}
              onChange={(e) => setImageUrlInput(e.target.value)}
              placeholder="Agregar imagen por URL..."
            />
            <Button
              variant="outline"
              onClick={handleAddImageUrl}
              disabled={!imageUrlInput.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Image Grid */}
          {loadingImages ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : images?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay imágenes
            </p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images?.map((img, idx) => (
                <div
                  key={img.id}
                  className="relative group aspect-square rounded-lg overflow-hidden bg-muted"
                >
                  <img
                    src={img.file_url}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  {img.is_cover && (
                    <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded flex items-center gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      Portada
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!img.is_cover && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => imageMutations.setCover.mutate(img.id)}
                        title="Establecer como imagen principal"
                        className="gap-1"
                      >
                        <Star className="h-4 w-4" />
                        Portada
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => imageMutations.deleteImage.mutate(img.id)}
                      title="Eliminar imagen"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documentos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Upload Area */}
          <div
            className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => docInputRef.current?.click()}
          >
            {uploadingDoc ? (
              <Loader2 className="h-6 w-6 mx-auto animate-spin text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Subir documentos (PDF, JPG, PNG)
                </p>
              </>
            )}
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && handleUploadDocs(e.target.files)}
            />
          </div>

          {/* Document List */}
          {loadingDocs ? (
            <p className="text-sm text-muted-foreground">Cargando...</p>
          ) : documents?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No hay documentos
            </p>
          ) : (
            <div className="space-y-2">
              {documents?.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30"
                >
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {doc.file_type}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => window.open(doc.file_url, "_blank")}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => docMutations.deleteDocument.mutate(doc.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
