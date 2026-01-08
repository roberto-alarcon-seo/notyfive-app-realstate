import { useState, useEffect } from "react";
import { 
  Eye, EyeOff, Loader2, Check, Copy, ExternalLink, 
  Phone, Webhook, AlertTriangle, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MessagingService {
  sid: string;
  name: string;
  dateCreated: string;
}

interface PhoneNumber {
  sid: string;
  phoneNumber: string;
  friendlyName: string;
}

interface TenantIntegration {
  id: string;
  tenant_id: string;
  provider: string;
  status: string;
  account_sid: string | null;
  phone_number: string | null;
  phone_number_name: string | null;
  messaging_service_sid: string | null;
  webhook_url: string | null;
}

interface TwilioConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  onSuccess?: () => void;
}

export function TwilioConfigDialog({ 
  open, 
  onOpenChange, 
  tenantId, 
  tenantName,
  onSuccess 
}: TwilioConfigDialogProps) {
  // Existing integration
  const [existingIntegration, setExistingIntegration] = useState<TenantIntegration | null>(null);
  const [isLoadingIntegration, setIsLoadingIntegration] = useState(false);

  // Wizard state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [accountSid, setAccountSid] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [showAuthToken, setShowAuthToken] = useState(false);
  const [messagingServices, setMessagingServices] = useState<MessagingService[]>([]);
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumber[]>([]);
  const [accountInfo, setAccountInfo] = useState<{ name: string; status: string } | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Loading states
  const [isValidating, setIsValidating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Selection state
  const [selectionType, setSelectionType] = useState<'service' | 'number' | 'sandbox'>('service');
  const [selectedServiceSid, setSelectedServiceSid] = useState<string>("");
  const [selectedNumberSid, setSelectedNumberSid] = useState<string>("");
  const [manualPhoneNumber, setManualPhoneNumber] = useState<string>("+1 415 523 8886"); // Default Sandbox number

  const isConnected = existingIntegration?.status === 'connected';

  // Fetch existing integration when dialog opens
  useEffect(() => {
    if (open && tenantId) {
      fetchExistingIntegration();
    }
  }, [open, tenantId]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setAccountSid("");
      setAuthToken("");
      setMessagingServices([]);
      setPhoneNumbers([]);
      setAccountInfo(null);
      setWarning(null);
      setSelectedServiceSid("");
      setSelectedNumberSid("");
    }
  }, [open]);

  const fetchExistingIntegration = async () => {
    setIsLoadingIntegration(true);
    try {
      const { data, error } = await supabase
        .from('tenant_integrations')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('provider', 'twilio')
        .maybeSingle();

      if (error) throw error;
      setExistingIntegration(data);
      
      // If connected, show step 3 (status view)
      if (data?.status === 'connected') {
        setStep(3);
      }
    } catch (error) {
      console.error('Error fetching integration:', error);
    } finally {
      setIsLoadingIntegration(false);
    }
  };

  const handleValidate = async () => {
    if (!accountSid.trim() || !authToken.trim()) {
      toast.error("Ingresa el Account SID y Auth Token");
      return;
    }

    setIsValidating(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-twilio-credentials', {
        body: { accountSid, authToken }
      });

      if (error) throw error;
      
      if (!data.isValid) {
        toast.error(data.error || "Credenciales inválidas");
        return;
      }

      setAccountInfo(data.account || null);
      setWarning(data.warning || null);
      setMessagingServices(data.messagingServices || []);
      setPhoneNumbers(data.phoneNumbers || []);

      // Detect if no resources are available (Sandbox mode)
      const hasResources = (data.messagingServices?.length > 0) || (data.phoneNumbers?.length > 0);
      
      if (!hasResources) {
        // No resources found - likely Sandbox mode
        setSelectionType('sandbox');
      } else if (data.messagingServices && data.messagingServices.length > 0) {
        setSelectionType('service');
      } else if (data.phoneNumbers && data.phoneNumbers.length > 0) {
        setSelectionType('number');
      }

      setStep(2);
      toast.success("Credenciales válidas. Selecciona tu configuración.");
    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error(error.message || "Error al validar credenciales");
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    const selectedService = selectionType === 'service' 
      ? messagingServices.find(s => s.sid === selectedServiceSid)
      : null;
    const selectedNumber = selectionType === 'number'
      ? phoneNumbers.find(n => n.sid === selectedNumberSid)
      : null;
    
    // For sandbox mode, create a manual number object
    const sandboxNumber = selectionType === 'sandbox' && manualPhoneNumber.trim()
      ? { sid: 'SANDBOX', phoneNumber: manualPhoneNumber.trim(), friendlyName: 'WhatsApp Sandbox' }
      : null;

    if (!selectedService && !selectedNumber && !sandboxNumber) {
      toast.error("Selecciona o ingresa un número");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('validate-twilio-credentials', {
        body: { 
          accountSid, 
          authToken,
          action: 'save',
          tenantId,
          selectedService,
          selectedNumber: selectedNumber || sandboxNumber
        }
      });

      if (error) throw error;
      
      if (!data.success) {
        toast.error(data.error || "Error al guardar la integración");
        return;
      }

      toast.success("Integración guardada correctamente");
      await fetchExistingIntegration();
      setStep(3);
      onSuccess?.();
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(error.message || "Error al guardar la integración");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Estás seguro de desconectar Twilio para este tenant?")) {
      return;
    }

    setIsDisconnecting(true);
    try {
      const { error } = await supabase
        .from('tenant_integrations')
        .update({ status: 'disconnected' })
        .eq('tenant_id', tenantId)
        .eq('provider', 'twilio');

      if (error) throw error;
      
      toast.success("Integración desconectada");
      setExistingIntegration(null);
      setStep(1);
      onSuccess?.();
    } catch (error: any) {
      console.error('Disconnect error:', error);
      toast.error(error.message || "Error al desconectar");
    } finally {
      setIsDisconnecting(false);
    }
  };

  const handleCopyWebhook = () => {
    if (existingIntegration?.webhook_url) {
      navigator.clipboard.writeText(existingIntegration.webhook_url);
      setCopied(true);
      toast.success("URL copiada al portapapeles");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReconfigure = () => {
    setExistingIntegration(null);
    setStep(1);
  };

  if (isLoadingIntegration) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            WhatsApp (Twilio) - {tenantName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {isConnected && step === 3 ? (
            /* Connected State */
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">Conectado</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Account SID</p>
                    <p className="font-mono text-xs truncate">{existingIntegration?.account_sid}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">
                      {existingIntegration?.messaging_service_sid ? 'Messaging Service' : 'Número'}
                    </p>
                    <p className="text-xs">
                      {existingIntegration?.messaging_service_sid 
                        ? existingIntegration.phone_number_name 
                        : existingIntegration?.phone_number}
                    </p>
                  </div>
                </div>
              </div>

              {/* Webhook */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Webhook className="h-4 w-4" />
                  Webhook URL
                </Label>
                <div className="flex gap-2">
                  <Input 
                    value={existingIntegration?.webhook_url || ''} 
                    readOnly 
                    className="font-mono text-xs"
                  />
                  <Button variant="outline" size="icon" onClick={handleCopyWebhook}>
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-border">
                <Button variant="outline" onClick={handleReconfigure} className="flex-1">
                  Reconfigurar
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="flex-1"
                >
                  {isDisconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desconectar"}
                </Button>
              </div>
            </div>
          ) : (
            /* Setup Wizard */
            <>
              {/* Progress indicator */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > 1 ? <Check className="h-4 w-4" /> : '1'}
                </div>
                <div className={`flex-1 h-1 rounded ${step > 1 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step >= 2 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > 2 ? <Check className="h-4 w-4" /> : '2'}
                </div>
                <div className={`flex-1 h-1 rounded ${step > 2 ? 'bg-primary' : 'bg-muted'}`} />
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step >= 3 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  3
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="accountSid">Account SID</Label>
                    <Input
                      id="accountSid"
                      type="text"
                      value={accountSid}
                      onChange={(e) => setAccountSid(e.target.value)}
                      placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      className="font-mono"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="authToken">Auth Token</Label>
                    <div className="relative">
                      <Input
                        id="authToken"
                        type={showAuthToken ? "text" : "password"}
                        value={authToken}
                        onChange={(e) => setAuthToken(e.target.value)}
                        placeholder="Ingresa tu Auth Token"
                        className="pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3"
                        onClick={() => setShowAuthToken(!showAuthToken)}
                      >
                        {showAuthToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      <a 
                        href="https://console.twilio.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        Abrir Twilio Console
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>

                  <Button 
                    onClick={handleValidate} 
                    disabled={isValidating || !accountSid.trim() || !authToken.trim()}
                    className="w-full"
                  >
                    {isValidating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Validando...
                      </>
                    ) : (
                      "Validar y Continuar"
                    )}
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  {accountInfo && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-2 text-green-600 text-sm">
                        <Check className="h-4 w-4" />
                        <span>Cuenta: {accountInfo.name}</span>
                        <Badge variant="secondary" className="text-xs">{accountInfo.status}</Badge>
                      </div>
                    </div>
                  )}

                  {warning && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription className="text-sm">{warning}</AlertDescription>
                    </Alert>
                  )}

                  <RadioGroup
                    value={selectionType}
                    onValueChange={(v) => setSelectionType(v as 'service' | 'number' | 'sandbox')}
                    className="space-y-3"
                  >
                    {messagingServices.length > 0 && (
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <RadioGroupItem value="service" id="service" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="service" className="font-medium cursor-pointer">
                            Messaging Service (Recomendado)
                          </Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Usa un servicio configurado en Twilio
                          </p>
                          {selectionType === 'service' && (
                            <Select value={selectedServiceSid} onValueChange={setSelectedServiceSid}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un servicio" />
                              </SelectTrigger>
                              <SelectContent>
                                {messagingServices.map((service) => (
                                  <SelectItem key={service.sid} value={service.sid}>
                                    {service.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    )}

                    {phoneNumbers.length > 0 && (
                      <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
                        <RadioGroupItem value="number" id="number" className="mt-1" />
                        <div className="flex-1">
                          <Label htmlFor="number" className="font-medium cursor-pointer">
                            Número WhatsApp
                          </Label>
                          <p className="text-xs text-muted-foreground mb-2">
                            Envía directamente desde un número
                          </p>
                          {selectionType === 'number' && (
                            <Select value={selectedNumberSid} onValueChange={setSelectedNumberSid}>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecciona un número" />
                              </SelectTrigger>
                              <SelectContent>
                                {phoneNumbers.map((number) => (
                                  <SelectItem key={number.sid} value={number.sid}>
                                    <div className="flex items-center gap-2">
                                      <Phone className="h-4 w-4" />
                                      {number.friendlyName || number.phoneNumber}
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sandbox/Manual mode - shown when no resources or always as option */}
                    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
                      selectionType === 'sandbox' ? 'border-primary bg-primary/5' : 'border-border'
                    }`}>
                      <RadioGroupItem value="sandbox" id="sandbox" className="mt-1" />
                      <div className="flex-1">
                        <Label htmlFor="sandbox" className="font-medium cursor-pointer flex items-center gap-2">
                          {messagingServices.length === 0 && phoneNumbers.length === 0 ? (
                            <>
                              <Badge variant="secondary" className="text-xs">Sandbox</Badge>
                              Número Manual / Sandbox
                            </>
                          ) : (
                            'Ingresar número manualmente'
                          )}
                        </Label>
                        <p className="text-xs text-muted-foreground mb-2">
                          {messagingServices.length === 0 && phoneNumbers.length === 0 
                            ? 'No se detectaron números. Ingresa el número del Sandbox de Twilio.'
                            : 'Ingresa un número WhatsApp manualmente'}
                        </p>
                        {selectionType === 'sandbox' && (
                          <Input
                            value={manualPhoneNumber}
                            onChange={(e) => setManualPhoneNumber(e.target.value)}
                            placeholder="+1 415 523 8886"
                            className="font-mono"
                          />
                        )}
                      </div>
                    </div>
                  </RadioGroup>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                      Atrás
                    </Button>
                    <Button 
                      onClick={handleSave} 
                      disabled={isSaving || (
                        selectionType === 'service' ? !selectedServiceSid : 
                        selectionType === 'number' ? !selectedNumberSid :
                        !manualPhoneNumber.trim()
                      )}
                      className="flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Guardando...
                        </>
                      ) : (
                        "Guardar y Continuar"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
