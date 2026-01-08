import { useState } from "react";
import { useApiTokens, ALL_SCOPES, ApiToken } from "@/hooks/useApiTokens";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Plus, Key, Copy, RefreshCw, Trash2, CheckCircle2, 
  XCircle, Clock, AlertTriangle, Loader2 
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Props {
  disabled?: boolean;
}

export function DeveloperTokensCard({ disabled }: Props) {
  const { 
    tokens, 
    loading, 
    oneTimeToken, 
    createToken, 
    rotateToken, 
    toggleToken, 
    deleteToken,
    clearOneTimeToken,
  } = useApiTokens();
  const { toast } = useToast();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRotateDialogOpen, setIsRotateDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedToken, setSelectedToken] = useState<ApiToken | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scopes, setScopes] = useState<string[]>(["contacts:read"]);
  const [expiresAt, setExpiresAt] = useState("");

  const resetForm = () => {
    setName("");
    setDescription("");
    setScopes(["contacts:read"]);
    setExpiresAt("");
  };

  const handleCreate = async () => {
    if (!name.trim() || scopes.length === 0) return;
    
    setIsSubmitting(true);
    const result = await createToken({
      name: name.trim(),
      description: description.trim() || undefined,
      scopes,
      expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
    setIsSubmitting(false);

    if (result) {
      resetForm();
      setIsCreateOpen(false);
    }
  };

  const handleRotate = async () => {
    if (!selectedToken) return;
    setIsSubmitting(true);
    await rotateToken(selectedToken.id);
    setIsSubmitting(false);
    setIsRotateDialogOpen(false);
    setSelectedToken(null);
  };

  const handleDelete = async () => {
    if (!selectedToken) return;
    setIsSubmitting(true);
    await deleteToken(selectedToken.id);
    setIsSubmitting(false);
    setIsDeleteDialogOpen(false);
    setSelectedToken(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiado",
      description: "Token copiado al portapapeles",
    });
  };

  const toggleScope = (scope: string) => {
    setScopes(prev => 
      prev.includes(scope) 
        ? prev.filter(s => s !== scope) 
        : [...prev, scope]
    );
  };

  return (
    <div className="bg-card rounded-xl border border-border">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">API Tokens</h3>
              <p className="text-sm text-muted-foreground">
                Tokens para integraciones con Zapier, Make, HubSpot, etc.
              </p>
            </div>
          </div>
          
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button disabled={disabled}>
                <Plus className="h-4 w-4 mr-2" />
                Crear Token
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Crear nuevo API Token</DialogTitle>
                <DialogDescription>
                  El token se mostrará solo una vez después de crearlo. Guárdalo en un lugar seguro.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="token-name">Nombre *</Label>
                  <Input
                    id="token-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Sync HubSpot, Zapier Integration"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token-description">Descripción</Label>
                  <Textarea
                    id="token-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe el uso de este token..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="token-expires">Fecha de expiración (opcional)</Label>
                  <Input
                    id="token-expires"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Deja vacío para un token sin expiración
                  </p>
                </div>

                <div className="space-y-3">
                  <Label>Permisos (scopes) *</Label>
                  <div className="space-y-2">
                    {ALL_SCOPES.map((scope) => (
                      <div
                        key={scope.value}
                        className="flex items-start space-x-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                      >
                        <Checkbox
                          id={scope.value}
                          checked={scopes.includes(scope.value)}
                          onCheckedChange={() => toggleScope(scope.value)}
                        />
                        <div className="space-y-0.5">
                          <label
                            htmlFor={scope.value}
                            className="text-sm font-medium cursor-pointer"
                          >
                            {scope.label}
                          </label>
                          <p className="text-xs text-muted-foreground">
                            {scope.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreate} 
                  disabled={!name.trim() || scopes.length === 0 || isSubmitting}
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Crear Token
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* One-time token display */}
      {oneTimeToken && (
        <div className="p-6 bg-primary/5 border-b border-primary/20">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground mb-2">
                Token generado - Cópialo ahora
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-3 bg-background rounded-lg text-sm font-mono break-all border border-border">
                  {oneTimeToken}
                </code>
                <Button
                  size="icon"
                  variant="outline"
                  onClick={() => copyToClipboard(oneTimeToken)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Por seguridad, este token no se volverá a mostrar. Si lo pierdes, deberás rotarlo.
              </p>
              <Button 
                variant="ghost" 
                size="sm" 
                className="mt-2"
                onClick={clearOneTimeToken}
              >
                Entendido, ya lo copié
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Token list */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : tokens.length === 0 ? (
          <div className="text-center py-8">
            <Key className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">
              Aún no tienes tokens de API
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Crea tu primer token para comenzar a integrar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {tokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                disabled={disabled}
                onToggle={(active) => toggleToken(token.id, active)}
                onRotate={() => {
                  setSelectedToken(token);
                  setIsRotateDialogOpen(true);
                }}
                onDelete={() => {
                  setSelectedToken(token);
                  setIsDeleteDialogOpen(true);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Rotate confirmation dialog */}
      <AlertDialog open={isRotateDialogOpen} onOpenChange={setIsRotateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Rotar token "{selectedToken?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esto invalidará el token actual e generará uno nuevo. 
              Las integraciones que usen el token actual dejarán de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRotate} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Rotar Token
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar token "{selectedToken?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las integraciones que usen este token dejarán de funcionar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={isSubmitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TokenRowProps {
  token: ApiToken;
  disabled?: boolean;
  onToggle: (active: boolean) => void;
  onRotate: () => void;
  onDelete: () => void;
}

function TokenRow({ token, disabled, onToggle, onRotate, onDelete }: TokenRowProps) {
  const isExpired = token.expires_at && new Date(token.expires_at) < new Date();

  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border hover:border-border/80 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground">{token.name}</h4>
            {!token.is_active && (
              <Badge variant="secondary" className="text-xs">
                <XCircle className="h-3 w-3 mr-1" />
                Inactivo
              </Badge>
            )}
            {isExpired && (
              <Badge variant="destructive" className="text-xs">
                <Clock className="h-3 w-3 mr-1" />
                Expirado
              </Badge>
            )}
          </div>
          
          {token.description && (
            <p className="text-sm text-muted-foreground mb-2">{token.description}</p>
          )}

          <div className="flex flex-wrap gap-1.5 mb-2">
            {token.scopes.map((scope) => (
              <Badge key={scope} variant="outline" className="text-xs font-mono">
                {scope}
              </Badge>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              Creado: {format(new Date(token.created_at), "dd MMM yyyy", { locale: es })}
            </span>
            {token.last_used_at && (
              <span>
                Último uso: {formatDistanceToNow(new Date(token.last_used_at), { 
                  addSuffix: true, 
                  locale: es 
                })}
              </span>
            )}
            {token.expires_at && (
              <span>
                Expira: {format(new Date(token.expires_at), "dd MMM yyyy HH:mm", { locale: es })}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={token.is_active}
            onCheckedChange={onToggle}
            disabled={disabled}
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={onRotate}
            disabled={disabled}
            title="Rotar token"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            disabled={disabled}
            title="Eliminar token"
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
