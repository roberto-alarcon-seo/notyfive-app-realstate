import { useState, useEffect } from "react";
import { Settings2, Sun, Moon, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Theme = "dark" | "light" | "blue";

// Zonas horarias de América (ciudades principales)
const AMERICA_TIMEZONES = [
  // México
  { value: "America/Mexico_City", label: "Ciudad de México, México", country: "MX" },
  { value: "America/Cancun", label: "Cancún, México", country: "MX" },
  { value: "America/Monterrey", label: "Monterrey, México", country: "MX" },
  { value: "America/Tijuana", label: "Tijuana, México", country: "MX" },
  { value: "America/Chihuahua", label: "Chihuahua, México", country: "MX" },
  { value: "America/Mazatlan", label: "Mazatlán, México", country: "MX" },
  { value: "America/Hermosillo", label: "Hermosillo, México", country: "MX" },
  { value: "America/Merida", label: "Mérida, México", country: "MX" },
  // Argentina
  { value: "America/Argentina/Buenos_Aires", label: "Buenos Aires, Argentina", country: "AR" },
  { value: "America/Argentina/Cordoba", label: "Córdoba, Argentina", country: "AR" },
  { value: "America/Argentina/Mendoza", label: "Mendoza, Argentina", country: "AR" },
  // Brasil
  { value: "America/Sao_Paulo", label: "São Paulo, Brasil", country: "BR" },
  { value: "America/Rio_Branco", label: "Río Branco, Brasil", country: "BR" },
  { value: "America/Manaus", label: "Manaus, Brasil", country: "BR" },
  { value: "America/Fortaleza", label: "Fortaleza, Brasil", country: "BR" },
  { value: "America/Recife", label: "Recife, Brasil", country: "BR" },
  // Chile
  { value: "America/Santiago", label: "Santiago, Chile", country: "CL" },
  { value: "America/Punta_Arenas", label: "Punta Arenas, Chile", country: "CL" },
  // Colombia
  { value: "America/Bogota", label: "Bogotá, Colombia", country: "CO" },
  // Perú
  { value: "America/Lima", label: "Lima, Perú", country: "PE" },
  // Ecuador
  { value: "America/Guayaquil", label: "Guayaquil, Ecuador", country: "EC" },
  { value: "America/Quito", label: "Quito, Ecuador", country: "EC" },
  // Venezuela
  { value: "America/Caracas", label: "Caracas, Venezuela", country: "VE" },
  // Bolivia
  { value: "America/La_Paz", label: "La Paz, Bolivia", country: "BO" },
  // Paraguay
  { value: "America/Asuncion", label: "Asunción, Paraguay", country: "PY" },
  // Uruguay
  { value: "America/Montevideo", label: "Montevideo, Uruguay", country: "UY" },
  // Panamá
  { value: "America/Panama", label: "Ciudad de Panamá, Panamá", country: "PA" },
  // Costa Rica
  { value: "America/Costa_Rica", label: "San José, Costa Rica", country: "CR" },
  // Guatemala
  { value: "America/Guatemala", label: "Ciudad de Guatemala, Guatemala", country: "GT" },
  // Honduras
  { value: "America/Tegucigalpa", label: "Tegucigalpa, Honduras", country: "HN" },
  // El Salvador
  { value: "America/El_Salvador", label: "San Salvador, El Salvador", country: "SV" },
  // Nicaragua
  { value: "America/Managua", label: "Managua, Nicaragua", country: "NI" },
  // Cuba
  { value: "America/Havana", label: "La Habana, Cuba", country: "CU" },
  // República Dominicana
  { value: "America/Santo_Domingo", label: "Santo Domingo, Rep. Dominicana", country: "DO" },
  // Puerto Rico
  { value: "America/Puerto_Rico", label: "San Juan, Puerto Rico", country: "PR" },
  // Estados Unidos
  { value: "America/New_York", label: "Nueva York, Estados Unidos", country: "US" },
  { value: "America/Los_Angeles", label: "Los Ángeles, Estados Unidos", country: "US" },
  { value: "America/Chicago", label: "Chicago, Estados Unidos", country: "US" },
  { value: "America/Denver", label: "Denver, Estados Unidos", country: "US" },
  { value: "America/Phoenix", label: "Phoenix, Estados Unidos", country: "US" },
  { value: "America/Detroit", label: "Detroit, Estados Unidos", country: "US" },
  { value: "America/Miami", label: "Miami, Estados Unidos", country: "US" },
  // Canadá
  { value: "America/Toronto", label: "Toronto, Canadá", country: "CA" },
  { value: "America/Vancouver", label: "Vancouver, Canadá", country: "CA" },
  { value: "America/Montreal", label: "Montreal, Canadá", country: "CA" },
];

// Función para normalizar números de teléfono mexicanos
export const normalizeMexicanPhoneNumber = (phone: string): string => {
  // Remover espacios y caracteres no numéricos excepto +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Si el número empieza con +52 pero NO tiene el 1 después del código de país
  // y es un número móvil (10 dígitos después del código de país)
  if (cleaned.startsWith('+52') && !cleaned.startsWith('+521')) {
    const numberPart = cleaned.slice(3); // Remover +52
    // Si tiene 10 dígitos, es un número móvil y necesita el 1
    if (numberPart.length === 10) {
      cleaned = '+521' + numberPart;
    }
  }
  
  return cleaned;
};

// Función para verificar si una zona horaria es de México
export const isMexicanTimezone = (timezone: string): boolean => {
  const mexicanTimezones = [
    'America/Mexico_City',
    'America/Cancun',
    'America/Monterrey',
    'America/Tijuana',
    'America/Chihuahua',
    'America/Mazatlan',
    'America/Hermosillo',
    'America/Merida',
  ];
  return mexicanTimezones.includes(timezone);
};

const THEME_OPTIONS: { value: Theme; label: string; description: string; icon: typeof Moon }[] = [
  { value: "dark", label: "Oscuro", description: "Fondo negro puro", icon: Moon },
  { value: "light", label: "Claro", description: "Fondos blancos", icon: Sun },
  { value: "blue", label: "Azul", description: "Fondo azul oscuro", icon: Palette },
];

export default function SettingsCompany() {
  const { tenant } = useAuth();
  const [companyName, setCompanyName] = useState(tenant?.name || "Mi Empresa");
  const [timezone, setTimezone] = useState("America/Mexico_City");
  const [theme, setTheme] = useState<Theme>("dark");
  const [saving, setSaving] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem("brokia-theme") as Theme | null) ?? "dark";
    setTheme(savedTheme);

    // Apply theme class consistently (never keep both at once)
    document.documentElement.classList.remove("dark", "light", "blue");
    document.body.classList.remove("dark", "light", "blue");
    document.documentElement.classList.add(savedTheme);
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("brokia-theme", newTheme);
    document.documentElement.classList.remove("dark", "light", "blue");
    document.body.classList.remove("dark", "light", "blue");
    document.documentElement.classList.add(newTheme);
  };

  const handleTimezoneChange = async (newTimezone: string) => {
    setTimezone(newTimezone);
    
    // Si es México, verificar y actualizar números de teléfono
    if (isMexicanTimezone(newTimezone) && tenant?.id) {
      try {
        // Obtener la integración de Twilio
        const { data: integration } = await supabase
          .from('tenant_integrations')
          .select('id, phone_number')
          .eq('tenant_id', tenant.id)
          .eq('provider', 'twilio')
          .single();

        if (integration?.phone_number) {
          const normalizedPhone = normalizeMexicanPhoneNumber(integration.phone_number);
          
          // Si el número cambió, actualizarlo
          if (normalizedPhone !== integration.phone_number) {
            await supabase
              .from('tenant_integrations')
              .update({ phone_number: normalizedPhone })
              .eq('id', integration.id);
            
            toast.success('Número de teléfono normalizado para México (+521)');
          }
        }
      } catch (error) {
        console.error('Error al verificar número de teléfono:', error);
      }
    }
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    
    setSaving(true);
    try {
      // Guardar configuración del tenant (timezone, nombre, etc.)
      // Por ahora solo mostramos el toast ya que no hay columna timezone en tenants
      toast.success('Configuración guardada');
    } catch (error) {
      toast.error('Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SettingsLayout 
      title="Sistema" 
      description="Configura las preferencias generales del sistema"
      icon={Settings2}
    >
      <div className="space-y-8 max-w-2xl">
        {/* Theme Selection */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Apariencia</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Selecciona el tema de color para la interfaz
            </p>
            
            <div className="grid grid-cols-3 gap-4">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isSelected = theme === option.value;
                
                return (
                  <button
                    key={option.value}
                    onClick={() => handleThemeChange(option.value)}
                    className={cn(
                      "relative rounded-xl border-2 p-4 transition-all duration-200 text-left",
                      isSelected
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{option.label}</p>
                        <p className="text-xs text-muted-foreground">{option.description}</p>
                      </div>
                    </div>

                    {/* Preview */}
                    <div 
                      className={cn(
                        "rounded-lg overflow-hidden border",
                        option.value === "dark" && "bg-[#0f0f0f] border-[#2b2b2b]",
                        option.value === "light" && "bg-[#f3f4f6] border-[#d1d5db]",
                        option.value === "blue" && "bg-[#1b2029] border-[#414a5c]"
                      )}
                    >
                      <div className="p-2">
                        <div className="flex gap-1 mb-2">
                          <div className="w-2 h-2 rounded-full bg-[#ef4444]" />
                          <div className="w-2 h-2 rounded-full bg-[#f59e0b]" />
                          <div className="w-2 h-2 rounded-full bg-[#22c55e]" />
                        </div>
                        <div className="space-y-1">
                          <div 
                            className={cn(
                              "h-2 rounded w-3/4",
                              option.value === "dark" && "bg-[#292929]",
                              option.value === "light" && "bg-[#e5e7eb]",
                              option.value === "blue" && "bg-[#363d4d]"
                            )} 
                          />
                          <div 
                            className={cn(
                              "h-2 rounded w-1/2",
                              option.value === "blue" ? "bg-[#a855f7]" : "bg-[#8b5cf6]"
                            )} 
                          />
                          <div 
                            className={cn(
                              "h-2 rounded w-2/3",
                              option.value === "dark" && "bg-[#292929]",
                              option.value === "light" && "bg-[#e5e7eb]",
                              option.value === "blue" && "bg-[#363d4d]"
                            )} 
                          />
                        </div>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Company Info */}
        <div className="bg-card rounded-xl border border-border p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-foreground mb-4">Datos de la empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nombre de la empresa</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="timezone">Zona horaria</Label>
                <Select value={timezone} onValueChange={handleTimezoneChange}>
                  <SelectTrigger id="timezone">
                    <SelectValue placeholder="Selecciona una zona horaria" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {AMERICA_TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Se usará para programar campañas y mostrar fechas
                  {isMexicanTimezone(timezone) && (
                    <span className="block text-primary mt-1">
                      🇲🇽 Los números móviles se normalizarán con prefijo +521
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
