import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect } from 'react';

export interface ContactNote {
  id: string;
  tenant_id: string;
  contact_id: string;
  conversation_id: string | null;
  author_id: string;
  content: string;
  is_pinned: boolean;
  note_type: string;
  source_entity_id: string | null;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string;
  };
}

export function useContactNotes(contactId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['contact-notes', contactId],
    queryFn: async () => {
      if (!contactId) return [];
      const { data, error } = await supabase
        .from('contact_notes')
        .select(`*, author:profiles!contact_notes_author_id_fkey(id, name)`)
        .eq('contact_id', contactId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ContactNote[];
    },
    enabled: !!contactId,
  });

  // Realtime
  useEffect(() => {
    if (!contactId) return;
    const channel = supabase
      .channel(`contact-notes-${contactId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'contact_notes',
        filter: `contact_id=eq.${contactId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['contact-notes', contactId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contactId, queryClient]);

  return query;
}

export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      contact_id: string;
      content: string;
      conversation_id?: string | null;
      note_type?: string;
      source_entity_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('tenant_id')
        .eq('id', user.id)
        .single();
      if (!profile?.tenant_id) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('contact_notes')
        .insert({
          tenant_id: profile.tenant_id,
          contact_id: params.contact_id,
          conversation_id: params.conversation_id || null,
          author_id: user.id,
          content: params.content,
          note_type: params.note_type || 'manual',
          source_entity_id: params.source_entity_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', data.contact_id] });
    },
  });
}

export function useTogglePinNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, isPinned, contactId }: { noteId: string; isPinned: boolean; contactId: string }) => {
      const { error } = await supabase
        .from('contact_notes')
        .update({ is_pinned: !isPinned, updated_at: new Date().toISOString() })
        .eq('id', noteId);
      if (error) throw error;
      return contactId;
    },
    onSuccess: (contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', contactId] });
    },
  });
}

export function useDeleteNote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ noteId, contactId }: { noteId: string; contactId: string }) => {
      const { error } = await supabase
        .from('contact_notes')
        .delete()
        .eq('id', noteId);
      if (error) throw error;
      return contactId;
    },
    onSuccess: (contactId) => {
      queryClient.invalidateQueries({ queryKey: ['contact-notes', contactId] });
    },
  });
}
