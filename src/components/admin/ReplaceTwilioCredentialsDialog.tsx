import { useState, useEffect } from 'react';
import { Loader2, AlertTriangle, CheckCircle2, ShieldAlert, ArrowLeft, ArrowRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CurrentIntegration {
  account_sid: string | null;
  phone_number: string | null;
  phone_number_name: string | null;
  messaging_service_sid: string | null;
  updated_at: string;
}

interface ValidationResult {
  account?: { name: string; status: string; type: string };
  whatsappSenders?: Array<{ phoneNumber: string; businessName: string; status: string }>;
  phoneNumbers?: Array<{ sid: string; phoneNumber: string; friendlyName: string }>;
  messagingServices?: Array<{ sid: string; name: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  current: CurrentIntegration | null;
  onReplaced: () => void;
}

const CONFIRM_KEYWORD = 'REEMPLAZAR';

export function ReplaceTwilioCredentialsDialog({
  open,
  onOpenChange,
  tenantId,
  tenantName,
  current,
  onReplaced,
}: Props) {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 2 state
  const [accountSid, setAccountSid] = useState('');
  const [authToken, setAuthToken] = useState('');
  const [validating, setValidating] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [selectionType, setSelectionType] = useState<'whatsapp' | 'number' | 'service' | null>(null);
  const [selectedKey, setSelectedKey] = useState<string>('');

  // Step 3 state
  const [confirmText, setConfirmText] = useState('');
  const [ackChecked, setAckChecked] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep(1);
      setAccountSid('');
      setAuthToken('');
      setValidation(null);
      setValidationError(null);
      setSelectionType(null);
      setSelectedKey('');
      setConfirmText('');
      setAckChecked(false);
      setValidating(false);
      setSaving(false);
    }
  }, [open]);

  const sidLooksValid = /^AC[a-f0-9]{32}$/i.test(accountSid.trim());
  const tokenLooksValid = authToken.trim().length >= 16;
  const sameAsCurrent = current?.account_sid && accountSid.trim() === current.account_sid;

  const handleValidate = async () => {
    if (!sidLooksValid || !tokenLooksValid) return;
    if (sameAsCurrent) {
      setValidationError('Este es el mismo Account SID actual. Si solo necesitas rotar el token, usa "Rotar token".');
      return;
    }
    setValidating(true);
    setValidationError(null);
    setValidation(null);
    setSelectionType(null);
    setSelectedKey('');
    try {
      const { data, error } = await supabase.functions.invoke('validate-twilio-credentials', {
        body: { accountSid: accountSid.trim(), authToken: authToken.trim() },
      });
      if (error) throw new Error(error.message || 'Error al validar');
      if (!data?.isValid) {
        setValidationError(data?.error || 'Credenciales inválidas');
        return;
      }
      setValidation(data);
      // Auto-pick first WhatsApp sender if any
      if (data.whatsappSenders?.length) {
        setSelectionType('whatsapp');
        setSelectedKey(data.whatsappSenders[0].phoneNumber);
      } else if (data.phoneNumbers?.length) {
        setSelectionType('number');
        setSelectedKey(data.phoneNumbers[0].sid);
      } else if (data.messagingServices?.length) {
        setSelectionType('service');
        setSelectedKey(data.messagingServices[0].sid);
      }
    } catch (e: any) {
      setValidationError(e?.message || 'No se pudo validar');
    } finally {
      setValidating(false);
    }
  };

  const buildSelection = () => {
    if (!validation) return {};
    if (selectionType === 'whatsapp') {
      const s = validation.whatsappSenders?.find((x) => x.phoneNumber === selectedKey);
      if (s) return { selectedWhatsAppSender: s };
    }
    if (selectionType === 'number') {
      const n = validation.phoneNumbers?.find((x) => x.sid === selectedKey);
      if (n) return { selectedNumber: n };
    }
    if (selectionType === 'service') {
      const ms = validation.messagingServices?.find((x) => x.sid === selectedKey);
      if (ms) return { selectedService: ms };
    }
    return {};
  };

  const canProceedFromStep2 =
    !!validation && !!selectionType && !!selectedKey && !validationError;

  const canConfirm =
    confirmText.trim().toUpperCase() === CONFIRM_KEYWORD && ackChecked && !saving;

  const handleReplace = async () => {
    if (!canConfirm) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-twilio-credentials', {
        body: {
          action: 'save',
          tenantId,
          accountSid: accountSid.trim(),
          authToken: authToken.trim(),
          ...buildSelection(),
        },
      });
      if (error) throw new Error(error.message || 'Error al guardar');
      if (data?.error) throw new Error(data.error);
      toast.success('Credenciales reemplazadas correctamente');
      onReplaced();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'No se pudieron reemplazar las credenciales');
    } finally {
      setSaving(false);
    }
  };

  const maskSid = (sid: string | null) => {
    if (!sid) return '—';
    if (sid.length <= 8) return sid;
    return `${sid.substring(0, 6)}…${sid.substring(sid.length - 4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-warning" />
            Reemplazar credenciales de Twilio
          </DialogTitle>
          <DialogDescription>
            Tenant: <span className="font-medium text-foreground">{tenantName}</span> · Paso {step} de 3
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-1">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-primary' : 'bg-muted'
              }`}
            />
          ))}
        </div>

        {/* STEP 1: Diagnóstico actual */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-3">
              <p className="text-sm font-medium text-foreground">Configuración actual</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Account SID</p>
                  <code className="font-mono text-foreground">{maskSid(current?.account_sid ?? null)}</code>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Número / MS</p>
                  <p className="text-foreground">
                    {current?.phone_number || current?.messaging_service_sid || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Nombre</p>
                  <p className="text-foreground">{current?.phone_number_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Última actualización</p>
                  <p className="text-foreground">
                    {current?.updated_at ? new Date(current.updated_at).toLocaleString('es-MX') : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm text-foreground space-y-1">
                <p className="font-medium">Esta acción es destructiva</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
                  <li>Los webhooks dejarán de llegar al Account SID anterior.</li>
                  <li>Las plantillas y números quedarán asociados a la nueva subcuenta.</li>
                  <li>El historial de mensajes existente se preserva en la base de datos.</li>
                </ul>
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setStep(2)}>
                Entendido, continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 2: Nuevas credenciales + validación */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="new-sid" className="text-xs text-muted-foreground">
                  Nuevo Account SID
                </Label>
                <Input
                  id="new-sid"
                  placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                  value={accountSid}
                  onChange={(e) => {
                    setAccountSid(e.target.value);
                    setValidation(null);
                    setValidationError(null);
                  }}
                  className="font-mono text-sm"
                />
                {accountSid && !sidLooksValid && (
                  <p className="text-xs text-destructive mt-1">Debe iniciar con AC y tener 34 caracteres.</p>
                )}
              </div>
              <div>
                <Label htmlFor="new-token" className="text-xs text-muted-foreground">
                  Nuevo Auth Token
                </Label>
                <Input
                  id="new-token"
                  type="password"
                  placeholder="••••••••••••••••"
                  value={authToken}
                  onChange={(e) => {
                    setAuthToken(e.target.value);
                    setValidation(null);
                    setValidationError(null);
                  }}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleValidate}
                  disabled={!sidLooksValid || !tokenLooksValid || validating}
                >
                  {validating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Validando…
                    </>
                  ) : (
                    'Validar sin guardar'
                  )}
                </Button>
              </div>
            </div>

            {validationError && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                {validationError}
              </div>
            )}

            {validation && (
              <div className="rounded-lg border border-success/40 bg-success/10 p-4 space-y-3">
                <div className="flex items-center gap-2 text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    Cuenta validada: {validation.account?.name} ({validation.account?.status})
                  </span>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Recurso a vincular</Label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    <Button
                      type="button"
                      variant={selectionType === 'whatsapp' ? 'default' : 'outline'}
                      size="sm"
                      disabled={!validation.whatsappSenders?.length}
                      onClick={() => {
                        setSelectionType('whatsapp');
                        setSelectedKey(validation.whatsappSenders?.[0]?.phoneNumber || '');
                      }}
                    >
                      WhatsApp ({validation.whatsappSenders?.length || 0})
                    </Button>
                    <Button
                      type="button"
                      variant={selectionType === 'number' ? 'default' : 'outline'}
                      size="sm"
                      disabled={!validation.phoneNumbers?.length}
                      onClick={() => {
                        setSelectionType('number');
                        setSelectedKey(validation.phoneNumbers?.[0]?.sid || '');
                      }}
                    >
                      Número ({validation.phoneNumbers?.length || 0})
                    </Button>
                    <Button
                      type="button"
                      variant={selectionType === 'service' ? 'default' : 'outline'}
                      size="sm"
                      disabled={!validation.messagingServices?.length}
                      onClick={() => {
                        setSelectionType('service');
                        setSelectedKey(validation.messagingServices?.[0]?.sid || '');
                      }}
                    >
                      MS ({validation.messagingServices?.length || 0})
                    </Button>
                  </div>
                </div>

                {selectionType && (
                  <Select value={selectedKey} onValueChange={setSelectedKey}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona un recurso" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectionType === 'whatsapp' &&
                        validation.whatsappSenders?.map((s) => (
                          <SelectItem key={s.phoneNumber} value={s.phoneNumber}>
                            {s.businessName} — {s.phoneNumber}
                          </SelectItem>
                        ))}
                      {selectionType === 'number' &&
                        validation.phoneNumbers?.map((n) => (
                          <SelectItem key={n.sid} value={n.sid}>
                            {n.friendlyName} — {n.phoneNumber}
                          </SelectItem>
                        ))}
                      {selectionType === 'service' &&
                        validation.messagingServices?.map((ms) => (
                          <SelectItem key={ms.sid} value={ms.sid}>
                            {ms.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Atrás
              </Button>
              <Button onClick={() => setStep(3)} disabled={!canProceedFromStep2}>
                Continuar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </DialogFooter>
          </div>
        )}

        {/* STEP 3: Confirmación tipeada */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-destructive font-medium text-sm">
                <AlertTriangle className="h-4 w-4" />
                Confirmación final
              </div>
              <p className="text-sm text-muted-foreground">
                Estás a punto de reemplazar las credenciales de <span className="text-foreground font-medium">{tenantName}</span>.
                El SID anterior <code className="font-mono">{maskSid(current?.account_sid ?? null)}</code> será sustituido por{' '}
                <code className="font-mono">{maskSid(accountSid)}</code>.
              </p>
            </div>

            <div>
              <Label htmlFor="confirm-text" className="text-xs text-muted-foreground">
                Escribe <span className="font-mono font-semibold text-foreground">{CONFIRM_KEYWORD}</span> para confirmar
              </Label>
              <Input
                id="confirm-text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={CONFIRM_KEYWORD}
                className="font-mono"
                autoComplete="off"
              />
            </div>

            <label className="flex items-start gap-2 text-sm cursor-pointer">
              <Checkbox
                checked={ackChecked}
                onCheckedChange={(c) => setAckChecked(c === true)}
                className="mt-0.5"
              />
              <span className="text-muted-foreground">
                Entiendo que el webhook de la subcuenta anterior dejará de funcionar y que esta acción no se puede deshacer automáticamente.
              </span>
            </label>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep(2)} disabled={saving}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Atrás
              </Button>
              <Button variant="destructive" onClick={handleReplace} disabled={!canConfirm}>
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Reemplazando…
                  </>
                ) : (
                  'Reemplazar credenciales'
                )}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
