import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type ConsentStatus = 'allowed' | 'opted_out' | 'dnd' | 'blocked';
export type ConsentChannel = 'whatsapp';

export interface ContactConsent {
  id: string;
  tenant_id: string;
  contact_id: string;
  channel: ConsentChannel;
  status: ConsentStatus;
  dnd_until: string | null;
  reason: string | null;
  source: string;
  note: string | null;
  updated_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentEvent {
  id: string;
  tenant_id: string;
  contact_id: string;
  channel: ConsentChannel;
  prev_status: ConsentStatus | null;
  new_status: ConsentStatus;
  prev_dnd_until: string | null;
  new_dnd_until: string | null;
  reason: string | null;
  source: string;
  metadata: Record<string, unknown>;
  actor_type: string;
  actor_id: string | null;
  created_at: string;
}

export function getEffectiveStatus(consent: ContactConsent | null): {
  status: ConsentStatus;
  effective: 'allowed' | 'opted_out' | 'dnd_active' | 'dnd_expired' | 'blocked';
  dnd_until: string | null;
} {
  if (!consent) {
    return { status: 'allowed', effective: 'allowed', dnd_until: null };
  }

  if (consent.status !== 'dnd') {
    return { 
      status: consent.status, 
      effective: consent.status, 
      dnd_until: consent.dnd_until 
    };
  }

  // DND status - check if expired
  if (!consent.dnd_until) {
    return { status: 'dnd', effective: 'dnd_active', dnd_until: null };
  }

  const until = new Date(consent.dnd_until).getTime();
  const now = Date.now();

  return now >= until
    ? { status: 'dnd', effective: 'dnd_expired', dnd_until: consent.dnd_until }
    : { status: 'dnd', effective: 'dnd_active', dnd_until: consent.dnd_until };
}

export function useContactConsent(contactId: string | undefined, channel: ConsentChannel = 'whatsapp') {
  const { profile } = useAuth();
  const [consent, setConsent] = useState<ContactConsent | null>(null);
  const [events, setEvents] = useState<ConsentEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchConsent = useCallback(async () => {
    if (!contactId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contact_consents')
        .select('*')
        .eq('contact_id', contactId)
        .eq('channel', channel)
        .maybeSingle();

      if (error) throw error;
      setConsent(data as ContactConsent | null);
    } catch (err) {
      console.error('Error fetching consent:', err);
    } finally {
      setLoading(false);
    }
  }, [contactId, channel]);

  const fetchEvents = useCallback(async () => {
    if (!contactId) return;

    try {
      const { data, error } = await supabase
        .from('contact_consent_events')
        .select('*')
        .eq('contact_id', contactId)
        .eq('channel', channel)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setEvents((data || []) as ConsentEvent[]);
    } catch (err) {
      console.error('Error fetching consent events:', err);
    }
  }, [contactId, channel]);

  const updateConsent = useCallback(async (
    newStatus: ConsentStatus,
    options: {
      dnd_until?: string | null;
      reason?: string;
      note?: string;
      source?: string;
    } = {}
  ) => {
    if (!contactId || !profile?.tenant_id) {
      toast.error('Datos inválidos');
      return false;
    }

    setSaving(true);
    try {
      const prevStatus = consent?.status || 'allowed';
      const prevDndUntil = consent?.dnd_until || null;

      const payload = {
        tenant_id: profile.tenant_id,
        contact_id: contactId,
        channel,
        status: newStatus,
        dnd_until: newStatus === 'dnd' ? (options.dnd_until || null) : null,
        reason: options.reason || null,
        source: options.source || 'ui',
        note: options.note || null,
        updated_by_user_id: profile.id,
      };

      const { data: updated, error: upsertErr } = await supabase
        .from('contact_consents')
        .upsert(payload, { onConflict: 'tenant_id,contact_id,channel' })
        .select()
        .single();

      if (upsertErr) throw upsertErr;

      // Insert audit event
      await supabase.from('contact_consent_events').insert({
        tenant_id: profile.tenant_id,
        contact_id: contactId,
        channel,
        prev_status: prevStatus,
        new_status: newStatus,
        prev_dnd_until: prevDndUntil,
        new_dnd_until: newStatus === 'dnd' ? (options.dnd_until || null) : null,
        reason: options.reason || null,
        source: options.source || 'ui',
        metadata: {},
        actor_type: 'user',
        actor_id: profile.id,
      });

      setConsent(updated as ContactConsent);
      await fetchEvents();
      toast.success('Consentimiento actualizado');
      return true;
    } catch (err) {
      console.error('Error updating consent:', err);
      toast.error('Error al actualizar consentimiento');
      return false;
    } finally {
      setSaving(false);
    }
  }, [contactId, profile, consent, channel, fetchEvents]);

  useEffect(() => {
    fetchConsent();
    fetchEvents();
  }, [fetchConsent, fetchEvents]);

  const effectiveStatus = getEffectiveStatus(consent);

  return {
    consent,
    events,
    loading,
    saving,
    effectiveStatus,
    updateConsent,
    refetch: fetchConsent,
  };
}
