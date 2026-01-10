import { useState, useEffect } from "react";
import { SettingsLayout } from "@/components/settings/SettingsLayout";
import { BarChart3 } from "lucide-react";
import { InternalConversionCard } from "@/components/settings/conversions/InternalConversionCard";
import { MetaIntegrationCard } from "@/components/settings/conversions/MetaIntegrationCard";
import { useConversionSettings } from "@/hooks/useConversionSettings";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsConversions() {
  const { settings, mappings, isLoading, saveSettings, saveMappings, resetMappingsToDefault } = useConversionSettings();

  if (isLoading) {
    return (
      <SettingsLayout
        title="Conversiones"
        description="Define tu conversión principal y envía señales a Meta"
        icon={BarChart3}
      >
        <div className="space-y-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout
      title="Conversiones"
      description="Define tu conversión principal y envía señales a Meta"
      icon={BarChart3}
    >
      <div className="space-y-8">
        <InternalConversionCard 
          settings={settings} 
          onSave={saveSettings} 
        />
        
        <MetaIntegrationCard 
          settings={settings}
          mappings={mappings}
          onSaveSettings={saveSettings}
          onSaveMappings={saveMappings}
          onResetMappings={resetMappingsToDefault}
        />
      </div>
    </SettingsLayout>
  );
}
