import { Code2 } from "lucide-react";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { DeveloperTokensCard } from "@/components/settings/DeveloperTokensCard";
import DeveloperApiDocsTrigger from "@/components/settings/DeveloperApiDocsTrigger";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";
import { PremiumGate } from "@/components/settings/PremiumGate";

export default function SettingsDeveloper() {
  const { tenantRole, isSuperAdmin } = useAuth();
  const isOwner = tenantRole === "administrador" || isSuperAdmin;

  return (
    <SettingsLayout
      title="Desarrollador"
      description="API Tokens y documentación para integraciones externas"
      icon={Code2}
    >
      <PremiumGate
        requiredFlags={["api_access"]}
        featureName="API & Webhooks"
        description="Genera tokens de API, configura webhooks y conecta Brokia24 con tus sistemas externos. Disponible en planes Pro."
      >
        <div className="space-y-6 max-w-4xl">
          {!isOwner && (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertDescription>
                Solo los propietarios pueden gestionar los tokens de API. Contacta al administrador de tu cuenta.
              </AlertDescription>
            </Alert>
          )}

          <DeveloperTokensCard disabled={!isOwner} />
          <DeveloperApiDocsTrigger />
        </div>
      </PremiumGate>
    </SettingsLayout>
  );
}
