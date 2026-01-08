import { useState, useEffect } from "react";
import { Settings2, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type Theme = "dark" | "light";

export default function SettingsCompany() {
  const { tenant } = useAuth();
  const [companyName, setCompanyName] = useState(tenant?.name || "Mi Empresa");
  const [timezone, setTimezone] = useState("America/Mexico_City");
  const [theme, setTheme] = useState<Theme>("dark");

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = (localStorage.getItem("notyfive-theme") as Theme | null) ?? "dark";
    setTheme(savedTheme);

    // Apply theme class consistently (never keep both at once)
    document.documentElement.classList.remove("dark", "light");
    document.body.classList.remove("dark", "light");
    document.documentElement.classList.add(savedTheme);
  }, []);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    localStorage.setItem("notyfive-theme", newTheme);
    document.documentElement.classList.remove("dark", "light");
    document.body.classList.remove("dark", "light");
    document.documentElement.classList.add(newTheme);
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
            
            <div className="grid grid-cols-2 gap-4">
              {/* Dark Theme Option */}
              <button
                onClick={() => handleThemeChange("dark")}
                className={cn(
                  "relative rounded-xl border-2 p-4 transition-all duration-200 text-left",
                  theme === "dark"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center">
                    <Moon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Oscuro</p>
                    <p className="text-xs text-muted-foreground">Tema actual</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-lg overflow-hidden border border-border bg-background">
                  <div className="p-2">
                    <div className="flex gap-1 mb-2">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 bg-muted rounded w-3/4" />
                      <div className="h-2 bg-primary rounded w-1/2" />
                      <div className="h-2 bg-muted rounded w-2/3" />
                    </div>
                  </div>
                </div>

                {theme === "dark" && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>

              {/* Light Theme Option */}
              <button
                onClick={() => handleThemeChange("light")}
                className={cn(
                  "relative rounded-xl border-2 p-4 transition-all duration-200 text-left",
                  theme === "light"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-card border border-border flex items-center justify-center">
                    <Sun className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Claro</p>
                    <p className="text-xs text-muted-foreground">Fondos blancos</p>
                  </div>
                </div>

                {/* Preview */}
                <div className="rounded-lg overflow-hidden border border-border bg-card">
                  <div className="p-2">
                    <div className="flex gap-1 mb-2">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      <div className="w-2 h-2 rounded-full bg-success" />
                    </div>
                    <div className="space-y-1">
                      <div className="h-2 bg-muted rounded w-3/4" />
                      <div className="h-2 bg-primary rounded w-1/2" />
                      <div className="h-2 bg-muted rounded w-2/3" />
                    </div>
                  </div>
                </div>

                {theme === "light" && (
                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-white" />
                  </div>
                )}
              </button>
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
                <Input
                  id="timezone"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Se usará para programar campañas y mostrar fechas
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button>Guardar cambios</Button>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
