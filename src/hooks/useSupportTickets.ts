import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export type TicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';
export type TicketCategory = 'bug' | 'campaign_error' | 'billing' | 'whatsapp_twilio' | 'ux_ui' | 'other';
export type SenderType = 'owner' | 'admin' | 'system';

export interface SupportTicket {
  id: string;
  tenant_id: string;
  created_by: string;
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  tenant?: { name: string };
  creator?: { name: string; email: string };
  assignee?: { name: string };
}

export interface SupportMessage {
  id: string;
  ticket_id: string;
  sender_type: SenderType;
  sender_id: string;
  message: string;
  is_internal: boolean;
  has_attachments?: boolean;
  created_at: string;
  sender?: { name: string; email: string };
}

export interface SupportAttachment {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  file_path: string;
  uploaded_by: string;
  created_at: string;
  signed_url?: string; // Generated client-side for rendering
}

export interface CreateTicketData {
  subject: string;
  category: TicketCategory;
  priority: TicketPriority;
  description: string;
  attachments?: File[];
}

export function useSupportTickets() {
  const { profile, tenant, isSuperAdmin } = useAuth();
  const tenantId = tenant?.id;
  const queryClient = useQueryClient();

  // Upload file to storage (private bucket - use signed URLs to view)
  const uploadAttachment = async (
    ticketId: string,
    file: File,
    messageId?: string
  ): Promise<{ path: string }> => {
    if (!tenantId || !profile) throw new Error('No tenant or profile');

    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const filePath = `${tenantId}/${ticketId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('support-attachments')
      .upload(filePath, file);

    if (uploadError) throw uploadError;

    // Insert attachment record - store file_path only, NOT public URL
    // file_url is kept for backward compatibility but will use signed URL for rendering
    const { error: insertError } = await supabase
      .from('support_attachments')
      .insert({
        ticket_id: ticketId,
        message_id: messageId || null,
        file_url: filePath, // Store path as file_url for backward compatibility
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        file_path: filePath,
        uploaded_by: profile.id,
      });

    if (insertError) throw insertError;

    return { path: filePath };
  };

  // Fetch tickets for owner (their tenant only) or all for super admin
  const ticketsQuery = useQuery({
    queryKey: ['support-tickets', tenantId, isSuperAdmin],
    queryFn: async () => {
      let query = supabase
        .from('support_tickets')
        .select(`
          *,
          tenant:tenants(name),
          creator:profiles!support_tickets_created_by_fkey(name, email),
          assignee:profiles!support_tickets_assigned_to_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (!isSuperAdmin && tenantId) {
        query = query.eq('tenant_id', tenantId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as SupportTicket[];
    },
    enabled: !!profile,
  });

  // Fetch single ticket with messages and generate signed URLs for attachments
  const useTicketDetail = (ticketId: string | null) => {
    return useQuery({
      queryKey: ['support-ticket', ticketId],
      queryFn: async () => {
        if (!ticketId) return null;

        const { data: ticket, error: ticketError } = await supabase
          .from('support_tickets')
          .select(`
            *,
            tenant:tenants(name),
            creator:profiles!support_tickets_created_by_fkey(name, email),
            assignee:profiles!support_tickets_assigned_to_fkey(name)
          `)
          .eq('id', ticketId)
          .single();

        if (ticketError) throw ticketError;

        const { data: messages, error: messagesError } = await supabase
          .from('support_messages')
          .select(`
            *,
            sender:profiles!support_messages_sender_id_fkey(name, email)
          `)
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (messagesError) throw messagesError;

        const { data: attachments, error: attachmentsError } = await supabase
          .from('support_attachments')
          .select('*')
          .eq('ticket_id', ticketId);

        if (attachmentsError) throw attachmentsError;

        // Generate signed URLs for all attachments (1 hour expiry)
        const attachmentsWithUrls = await Promise.all(
          (attachments || []).map(async (att) => {
            const filePath = att.file_path || att.file_url;
            if (!filePath) return { ...att, signed_url: undefined };
            
            const { data } = await supabase.storage
              .from('support-attachments')
              .createSignedUrl(filePath, 3600); // 1 hour TTL
            
            return {
              ...att,
              file_path: filePath,
              signed_url: data?.signedUrl,
            } as SupportAttachment;
          })
        );

        return {
          ticket: ticket as SupportTicket,
          messages: messages as SupportMessage[],
          attachments: attachmentsWithUrls,
        };
      },
      enabled: !!ticketId && !!profile,
    });
  };

  // Create ticket
  const createTicketMutation = useMutation({
    mutationFn: async (data: CreateTicketData) => {
      if (!tenantId || !profile) throw new Error('No tenant or profile');

      // Create ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('support_tickets')
        .insert({
          tenant_id: tenantId,
          created_by: profile.id,
          subject: data.subject,
          category: data.category,
          priority: data.priority,
          status: 'open',
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Create initial message with description
      const { data: message, error: messageError } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticket.id,
          sender_type: 'owner',
          sender_id: profile.id,
          message: data.description,
          is_internal: false,
          has_attachments: (data.attachments?.length || 0) > 0,
        })
        .select()
        .single();

      if (messageError) throw messageError;

      // Upload attachments if any
      if (data.attachments && data.attachments.length > 0) {
        for (const file of data.attachments) {
          await uploadAttachment(ticket.id, file, message.id);
        }
      }

      return ticket;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket creado exitosamente');
    },
    onError: (error) => {
      console.error('Error creating ticket:', error);
      toast.error('Error al crear el ticket');
    },
  });

  // Add message to ticket
  const addMessageMutation = useMutation({
    mutationFn: async ({
      ticketId,
      message,
      isInternal = false,
      attachments,
    }: {
      ticketId: string;
      message: string;
      isInternal?: boolean;
      attachments?: File[];
    }) => {
      if (!profile) throw new Error('No profile');

      const senderType: SenderType = isSuperAdmin ? 'admin' : 'owner';

      const { data, error } = await supabase
        .from('support_messages')
        .insert({
          ticket_id: ticketId,
          sender_type: senderType,
          sender_id: profile.id,
          message,
          is_internal: isInternal,
          has_attachments: (attachments?.length || 0) > 0,
        })
        .select()
        .single();

      if (error) throw error;

      // Upload attachments if any
      if (attachments && attachments.length > 0) {
        for (const file of attachments) {
          await uploadAttachment(ticketId, file, data.id);
        }
      }

      // Update ticket updated_at
      await supabase
        .from('support_tickets')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Mensaje enviado');
    },
    onError: (error) => {
      console.error('Error adding message:', error);
      toast.error('Error al enviar mensaje');
    },
  });

  // Update ticket status (super admin only)
  const updateStatusMutation = useMutation({
    mutationFn: async ({
      ticketId,
      status,
    }: {
      ticketId: string;
      status: TicketStatus;
    }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      // Add system message for status change
      if (profile) {
        await supabase.from('support_messages').insert({
          ticket_id: ticketId,
          sender_type: 'system',
          sender_id: profile.id,
          message: `Estado cambiado a: ${getStatusLabel(status)}`,
          is_internal: false,
        });
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Estado actualizado');
    },
    onError: (error) => {
      console.error('Error updating status:', error);
      toast.error('Error al actualizar estado');
    },
  });

  // Assign ticket (super admin only)
  const assignTicketMutation = useMutation({
    mutationFn: async ({
      ticketId,
      assignedTo,
    }: {
      ticketId: string;
      assignedTo: string | null;
    }) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ assigned_to: assignedTo, updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', variables.ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket asignado');
    },
    onError: (error) => {
      console.error('Error assigning ticket:', error);
      toast.error('Error al asignar ticket');
    },
  });

  // Close ticket (owner can only close resolved tickets)
  const closeTicketMutation = useMutation({
    mutationFn: async (ticketId: string) => {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'closed', updated_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;
    },
    onSuccess: (_, ticketId) => {
      queryClient.invalidateQueries({ queryKey: ['support-ticket', ticketId] });
      queryClient.invalidateQueries({ queryKey: ['support-tickets'] });
      toast.success('Ticket cerrado');
    },
    onError: (error) => {
      console.error('Error closing ticket:', error);
      toast.error('Error al cerrar ticket');
    },
  });

  return {
    tickets: ticketsQuery.data || [],
    isLoading: ticketsQuery.isLoading,
    useTicketDetail,
    createTicket: createTicketMutation.mutateAsync,
    isCreating: createTicketMutation.isPending,
    addMessage: addMessageMutation.mutateAsync,
    isAddingMessage: addMessageMutation.isPending,
    updateStatus: updateStatusMutation.mutateAsync,
    assignTicket: assignTicketMutation.mutateAsync,
    closeTicket: closeTicketMutation.mutateAsync,
  };
}

// Helper functions
export function getStatusLabel(status: TicketStatus): string {
  const labels: Record<TicketStatus, string> = {
    open: 'Abierto',
    in_progress: 'En progreso',
    waiting_customer: 'Esperando cliente',
    resolved: 'Resuelto',
    closed: 'Cerrado',
  };
  return labels[status];
}

export function getStatusColor(status: TicketStatus): string {
  const colors: Record<TicketStatus, string> = {
    open: 'bg-primary text-primary-foreground',
    in_progress: 'bg-blue-500 text-white',
    waiting_customer: 'bg-orange-500 text-white',
    resolved: 'bg-green-500 text-white',
    closed: 'bg-muted text-muted-foreground',
  };
  return colors[status];
}

export function getPriorityLabel(priority: TicketPriority): string {
  const labels: Record<TicketPriority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    critical: 'Crítica',
  };
  return labels[priority];
}

export function getPriorityColor(priority: TicketPriority): string {
  const colors: Record<TicketPriority, string> = {
    low: 'bg-muted text-muted-foreground',
    medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    critical: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };
  return colors[priority];
}

export function getCategoryLabel(category: TicketCategory): string {
  const labels: Record<TicketCategory, string> = {
    bug: 'Bug',
    campaign_error: 'Error en campañas',
    billing: 'Facturación',
    whatsapp_twilio: 'WhatsApp (Conexión / Mensajes)',
    ux_ui: 'UX / UI',
    other: 'Otro',
  };
  return labels[category];
}