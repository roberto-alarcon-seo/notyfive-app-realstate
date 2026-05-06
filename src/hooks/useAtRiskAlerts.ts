import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Plays a notification chime for "at risk" alerts.
 */
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const now = ctx.currentTime;
    const tones = [659, 523, 659]; // E5 - C5 - E5 (urgent feel)
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.25, now + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.001, now + i * 0.18 + 0.16);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(now + i * 0.18);
      osc.stop(now + i * 0.18 + 0.18);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    /* noop */
  }
}

/**
 * Subscribes to conversation updates and alerts (toast + sound) the user
 * when a conversation enters "at risk" state. RLS already restricts which
 * conversations the user receives — agents only see their own, managers
 * and admin see all tenant conversations.
 */
export function useAtRiskAlerts() {
  const { profile, tenantRole, isSuperAdmin } = useAuth();
  const tenantId = profile?.tenant_id ?? null;
  const navigate = useNavigate();
  const qc = useQueryClient();
  const seenRef = useRef<Set<string>>(new Set());

  const eligible =
    isSuperAdmin ||
    ["administrador", "manager", "asesor"].includes(tenantRole || "");

  useEffect(() => {
    if (!tenantId || !eligible) return;
    const channel = supabase
      .channel("at-risk-alerts")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload) => {
          const next = payload.new as any;
          const prev = payload.old as any;
          if (!next?.risk_flagged_at) return;
          if (prev?.risk_flagged_at) return; // already flagged
          if (seenRef.current.has(next.id)) return;
          seenRef.current.add(next.id);

          playAlertSound();
          toast.warning("Lead en riesgo de timeout", {
            description: "Una conversación lleva demasiado tiempo sin respuesta.",
            action: {
              label: "Abrir",
              onClick: () => navigate(`/inbox?conversation=${next.id}`),
            },
            duration: 10_000,
          });
          qc.invalidateQueries({ queryKey: ["at-risk-count", tenantId] });
          qc.invalidateQueries({ queryKey: ["admin-leads", tenantId] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, eligible, navigate, qc]);
}
