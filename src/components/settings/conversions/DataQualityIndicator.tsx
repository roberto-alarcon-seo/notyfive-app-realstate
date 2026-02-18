import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, AlertTriangle, Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";

export function DataQualityIndicator() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const { data: stats } = useQuery({
    queryKey: ['contact-data-quality', tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const { count: total } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      const { count: withPhone } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .not('phone', 'is', null)
        .neq('phone', '');

      const { count: withEmail } = await supabase
        .from('contacts')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .not('email', 'is', null)
        .neq('email', '');

      return {
        total: total || 0,
        withPhone: withPhone || 0,
        withEmail: withEmail || 0,
      };
    },
    enabled: !!tenantId,
  });

  if (!stats || stats.total === 0) return null;

  const phonePct = Math.round((stats.withPhone / stats.total) * 100);
  const emailPct = Math.round((stats.withEmail / stats.total) * 100);
  const isLowQuality = phonePct < 50 || emailPct < 30;

  return (
    <div className="space-y-3">
      {isLowQuality && (
        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>La calidad de datos de tus contactos es baja. Esto impacta el matching en Meta.</span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Phone className="h-3.5 w-3.5" /> Teléfono válido
            </span>
            <span className="font-medium">{phonePct}%</span>
          </div>
          <Progress value={phonePct} className="h-2" />
          <span className="text-xs text-muted-foreground">{stats.withPhone} de {stats.total}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Mail className="h-3.5 w-3.5" /> Email válido
            </span>
            <span className="font-medium">{emailPct}%</span>
          </div>
          <Progress value={emailPct} className="h-2" />
          <span className="text-xs text-muted-foreground">{stats.withEmail} de {stats.total}</span>
        </div>
      </div>
    </div>
  );
}
