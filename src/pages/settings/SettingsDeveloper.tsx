import { Code2 } from "lucide-react";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { DeveloperTokensCard } from "@/components/settings/DeveloperTokensCard";
import DeveloperApiDocsTrigger from "@/components/settings/DeveloperApiDocsTrigger";
import { useAuth } from "@/contexts/AuthContext";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ShieldAlert } from "lucide-react";

export default function SettingsDeveloper() {
  const { tenantRole, isSuperAdmin } = useAuth();
  const isOwner = tenantRole === "owner" || isSuperAdmin;

  return (
    <SettingsLayout
      title="Desarrollador"
      description="API Tokens y documentación para integraciones externas"
      icon={Code2}
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
    </SettingsLayout>
  );
}
