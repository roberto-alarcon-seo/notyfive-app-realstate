export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_interaction_logs: {
        Row: {
          ai_response: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          escalation_reason: string | null
          id: string
          inbound_message: string
          knowledge_base_entry_id: string | null
          message_id: string | null
          response_time_ms: number | null
          tenant_id: string
          wallet_debited: boolean
          was_escalated: boolean
        }
        Insert: {
          ai_response?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          escalation_reason?: string | null
          id?: string
          inbound_message: string
          knowledge_base_entry_id?: string | null
          message_id?: string | null
          response_time_ms?: number | null
          tenant_id: string
          wallet_debited?: boolean
          was_escalated?: boolean
        }
        Update: {
          ai_response?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          escalation_reason?: string | null
          id?: string
          inbound_message?: string
          knowledge_base_entry_id?: string | null
          message_id?: string | null
          response_time_ms?: number | null
          tenant_id?: string
          wallet_debited?: boolean
          was_escalated?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ai_interaction_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interaction_logs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interaction_logs_knowledge_base_entry_id_fkey"
            columns: ["knowledge_base_entry_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_base"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interaction_logs_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interaction_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_base: {
        Row: {
          answer: string
          category: Database["public"]["Enums"]["kb_category"]
          created_at: string
          id: string
          is_active: boolean
          question: string
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          category?: Database["public"]["Enums"]["kb_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          question: string
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: Database["public"]["Enums"]["kb_category"]
          created_at?: string
          id?: string
          is_active?: boolean
          question?: string
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_base_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      api_tokens: {
        Row: {
          created_at: string
          description: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          last_used_at: string | null
          name: string
          scopes: string[]
          tenant_id: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name: string
          scopes?: string[]
          tenant_id: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          name?: string
          scopes?: string[]
          tenant_id?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_tokens_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_events: {
        Row: {
          created_at: string
          event_payload: Json
          event_type: string
          id: string
          processed_at: string | null
          tenant_id: string
        }
        Insert: {
          created_at?: string
          event_payload?: Json
          event_type: string
          id?: string
          processed_at?: string | null
          tenant_id: string
        }
        Update: {
          created_at?: string
          event_payload?: Json
          event_type?: string
          id?: string
          processed_at?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_idempotency: {
        Row: {
          automation_id: string
          created_at: string
          id: string
          idempotency_key: string
          tenant_id: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          id?: string
          idempotency_key: string
          tenant_id: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          id?: string
          idempotency_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_idempotency_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_idempotency_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_run_steps: {
        Row: {
          action_payload: Json
          action_type: Database["public"]["Enums"]["automation_action_type"]
          created_at: string
          error_message: string | null
          finished_at: string | null
          id: string
          result: Json | null
          run_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["automation_step_status"]
          step_index: number
          tenant_id: string
        }
        Insert: {
          action_payload?: Json
          action_type: Database["public"]["Enums"]["automation_action_type"]
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          result?: Json | null
          run_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_step_status"]
          step_index: number
          tenant_id: string
        }
        Update: {
          action_payload?: Json
          action_type?: Database["public"]["Enums"]["automation_action_type"]
          created_at?: string
          error_message?: string | null
          finished_at?: string | null
          id?: string
          result?: Json | null
          run_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_step_status"]
          step_index?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "automation_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_run_steps_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          contact_id: string
          conversation_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string | null
          id: string
          metadata: Json | null
          resume_at: string | null
          started_at: string | null
          status: Database["public"]["Enums"]["automation_run_status"]
          tenant_id: string
          trigger_event_id: string | null
          wallet_consumed: number
        }
        Insert: {
          automation_id: string
          contact_id: string
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          resume_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_run_status"]
          tenant_id: string
          trigger_event_id?: string | null
          wallet_consumed?: number
        }
        Update: {
          automation_id?: string
          contact_id?: string
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          metadata?: Json | null
          resume_at?: string | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["automation_run_status"]
          tenant_id?: string
          trigger_event_id?: string | null
          wallet_consumed?: number
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          actions: Json
          allowed_hours: Json | null
          conditions: Json
          cooldown_hours: number | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          rate_limits: Json
          schedule: Json | null
          status: Database["public"]["Enums"]["automation_status"]
          tenant_id: string
          trigger_config: Json
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at: string
        }
        Insert: {
          actions?: Json
          allowed_hours?: Json | null
          conditions?: Json
          cooldown_hours?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          rate_limits?: Json
          schedule?: Json | null
          status?: Database["public"]["Enums"]["automation_status"]
          tenant_id: string
          trigger_config?: Json
          trigger_type: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
        }
        Update: {
          actions?: Json
          allowed_hours?: Json | null
          conditions?: Json
          cooldown_hours?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          rate_limits?: Json
          schedule?: Json | null
          status?: Database["public"]["Enums"]["automation_status"]
          tenant_id?: string
          trigger_config?: Json
          trigger_type?: Database["public"]["Enums"]["automation_trigger_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_contacts: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          delivered_at: string | null
          error_code: string | null
          error_message: string | null
          id: string
          sent_at: string | null
          status: string
          tenant_id: string
          twilio_message_sid: string | null
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          twilio_message_sid?: string | null
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          delivered_at?: string | null
          error_code?: string | null
          error_message?: string | null
          id?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_contacts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_deliveries: {
        Row: {
          campaign_id: string
          contact_id: string
          conversation_id: string | null
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          message_id: string | null
          provider_message_sid: string | null
          skipped_reason: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          provider_message_sid?: string | null
          skipped_reason?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          conversation_id?: string | null
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          provider_message_sid?: string | null
          skipped_reason?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_deliveries_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliveries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliveries_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_deliveries_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_queue: {
        Row: {
          attempts: number
          campaign_id: string
          contact_id: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          max_attempts: number
          phone: string
          scheduled_at: string
          sent_at: string | null
          status: string
          tenant_id: string
          twilio_message_sid: string | null
          updated_at: string
        }
        Insert: {
          attempts?: number
          campaign_id: string
          contact_id: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          phone: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id: string
          twilio_message_sid?: string | null
          updated_at?: string
        }
        Update: {
          attempts?: number
          campaign_id?: string
          contact_id?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          max_attempts?: number
          phone?: string
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          tenant_id?: string
          twilio_message_sid?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_queue_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_queue_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_stats: {
        Row: {
          campaign_id: string
          cost_estimated: number
          created_at: string
          id: string
          messages_delivered: number
          messages_failed: number
          messages_read: number
          messages_sent: number
          opt_outs: number
          responses: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          campaign_id: string
          cost_estimated?: number
          created_at?: string
          id?: string
          messages_delivered?: number
          messages_failed?: number
          messages_read?: number
          messages_sent?: number
          opt_outs?: number
          responses?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          cost_estimated?: number
          created_at?: string
          id?: string
          messages_delivered?: number
          messages_failed?: number
          messages_read?: number
          messages_sent?: number
          opt_outs?: number
          responses?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_stats_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: true
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_stats_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience_filters: Json | null
          audience_type: string
          batch_delay_seconds: number | null
          batch_size: number | null
          campaign_type: string
          completed_at: string | null
          created_at: string
          current_batch: number | null
          delivered_count: number
          description: string | null
          failed_count: number
          id: string
          last_batch_at: string | null
          name: string
          pause_reason: string | null
          paused_at: string | null
          queue_processed: number | null
          queue_total: number | null
          scheduled_at: string | null
          segment_id: string | null
          sent_count: number
          started_at: string | null
          status: string
          template_id: string | null
          tenant_id: string
          total_contacts: number
          updated_at: string
          variable_mapping: Json | null
        }
        Insert: {
          audience_filters?: Json | null
          audience_type?: string
          batch_delay_seconds?: number | null
          batch_size?: number | null
          campaign_type?: string
          completed_at?: string | null
          created_at?: string
          current_batch?: number | null
          delivered_count?: number
          description?: string | null
          failed_count?: number
          id?: string
          last_batch_at?: string | null
          name: string
          pause_reason?: string | null
          paused_at?: string | null
          queue_processed?: number | null
          queue_total?: number | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
          total_contacts?: number
          updated_at?: string
          variable_mapping?: Json | null
        }
        Update: {
          audience_filters?: Json | null
          audience_type?: string
          batch_delay_seconds?: number | null
          batch_size?: number | null
          campaign_type?: string
          completed_at?: string | null
          created_at?: string
          current_batch?: number | null
          delivered_count?: number
          description?: string | null
          failed_count?: number
          id?: string
          last_batch_at?: string | null
          name?: string
          pause_reason?: string | null
          paused_at?: string | null
          queue_processed?: number | null
          queue_total?: number | null
          scheduled_at?: string | null
          segment_id?: string | null
          sent_count?: number
          started_at?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          total_contacts?: number
          updated_at?: string
          variable_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_consent_events: {
        Row: {
          actor_id: string | null
          actor_type: string
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_id: string
          created_at: string
          id: string
          metadata: Json
          new_dnd_until: string | null
          new_status: Database["public"]["Enums"]["consent_status"]
          prev_dnd_until: string | null
          prev_status: Database["public"]["Enums"]["consent_status"] | null
          reason: string | null
          source: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          actor_type?: string
          channel?: Database["public"]["Enums"]["consent_channel"]
          contact_id: string
          created_at?: string
          id?: string
          metadata?: Json
          new_dnd_until?: string | null
          new_status: Database["public"]["Enums"]["consent_status"]
          prev_dnd_until?: string | null
          prev_status?: Database["public"]["Enums"]["consent_status"] | null
          reason?: string | null
          source?: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          actor_type?: string
          channel?: Database["public"]["Enums"]["consent_channel"]
          contact_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          new_dnd_until?: string | null
          new_status?: Database["public"]["Enums"]["consent_status"]
          prev_dnd_until?: string | null
          prev_status?: Database["public"]["Enums"]["consent_status"] | null
          reason?: string | null
          source?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_consent_events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_consent_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_consents: {
        Row: {
          channel: Database["public"]["Enums"]["consent_channel"]
          contact_id: string
          created_at: string
          dnd_until: string | null
          id: string
          note: string | null
          reason: string | null
          source: string
          status: Database["public"]["Enums"]["consent_status"]
          tenant_id: string
          updated_at: string
          updated_by_user_id: string | null
        }
        Insert: {
          channel?: Database["public"]["Enums"]["consent_channel"]
          contact_id: string
          created_at?: string
          dnd_until?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          source?: string
          status?: Database["public"]["Enums"]["consent_status"]
          tenant_id: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Update: {
          channel?: Database["public"]["Enums"]["consent_channel"]
          contact_id?: string
          created_at?: string
          dnd_until?: string | null
          id?: string
          note?: string | null
          reason?: string | null
          source?: string
          status?: Database["public"]["Enums"]["consent_status"]
          tenant_id?: string
          updated_at?: string
          updated_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_consents_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_consents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_consents_updated_by_user_id_fkey"
            columns: ["updated_by_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_custom_field_options: {
        Row: {
          created_at: string
          field_id: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_field_options_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "contact_custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_custom_field_values: {
        Row: {
          contact_id: string
          created_at: string
          field_id: string
          id: string
          updated_at: string
          value_text: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          field_id: string
          id?: string
          updated_at?: string
          value_text?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          field_id?: string
          id?: string
          updated_at?: string
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_field_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "contact_custom_fields"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_custom_fields: {
        Row: {
          category: string | null
          created_at: string
          data_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_required: boolean
          is_visible_in_list: boolean
          key: string
          name: string
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          data_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          is_visible_in_list?: boolean
          key: string
          name: string
          sort_order?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          data_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          is_visible_in_list?: boolean
          key?: string
          name?: string
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_custom_fields_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_opt_out: {
        Row: {
          channel: string
          contact_id: string
          created_at: string
          id: string
          opted_out: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          channel?: string
          contact_id: string
          created_at?: string
          id?: string
          opted_out?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          channel?: string
          contact_id?: string
          created_at?: string
          id?: string
          opted_out?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_opt_out_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_opt_out_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          assigned_agent_id: string | null
          country: string | null
          created_at: string
          email: string | null
          engagement_level: string
          id: string
          intent_detected: string | null
          internal_conversion_count: number
          internal_converted_at: string | null
          internal_converted_stage: string | null
          last_interaction_at: string | null
          lead_score: number
          lead_temperature: string
          name: string
          next_action_at: string | null
          notes: string | null
          operational_status: string
          opt_in_status: string
          phone: string | null
          pipeline_stage: string
          re_accepts_pets: boolean
          re_amenities: string[] | null
          re_bathrooms: number | null
          re_bedrooms: number | null
          re_block_reason: string | null
          re_budget_estimated_mxn: number | null
          re_credit_preapproved: boolean
          re_credit_type: string | null
          re_current_situation: string | null
          re_down_payment_mxn: number | null
          re_monthly_income_mxn: number | null
          re_parking_spots: number | null
          re_properties_viewed_ids: string[] | null
          re_property_followup_status: string | null
          re_property_interest_id: string | null
          re_property_not_interested_reason: string | null
          re_property_types: string[] | null
          re_reason: string | null
          re_requires_parking: boolean
          re_visit_outcome: string | null
          re_zones: string[] | null
          source: string | null
          status: Database["public"]["Enums"]["contact_status"]
          tags: string[] | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_agent_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          engagement_level?: string
          id?: string
          intent_detected?: string | null
          internal_conversion_count?: number
          internal_converted_at?: string | null
          internal_converted_stage?: string | null
          last_interaction_at?: string | null
          lead_score?: number
          lead_temperature?: string
          name: string
          next_action_at?: string | null
          notes?: string | null
          operational_status?: string
          opt_in_status?: string
          phone?: string | null
          pipeline_stage?: string
          re_accepts_pets?: boolean
          re_amenities?: string[] | null
          re_bathrooms?: number | null
          re_bedrooms?: number | null
          re_block_reason?: string | null
          re_budget_estimated_mxn?: number | null
          re_credit_preapproved?: boolean
          re_credit_type?: string | null
          re_current_situation?: string | null
          re_down_payment_mxn?: number | null
          re_monthly_income_mxn?: number | null
          re_parking_spots?: number | null
          re_properties_viewed_ids?: string[] | null
          re_property_followup_status?: string | null
          re_property_interest_id?: string | null
          re_property_not_interested_reason?: string | null
          re_property_types?: string[] | null
          re_reason?: string | null
          re_requires_parking?: boolean
          re_visit_outcome?: string | null
          re_zones?: string[] | null
          source?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_agent_id?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          engagement_level?: string
          id?: string
          intent_detected?: string | null
          internal_conversion_count?: number
          internal_converted_at?: string | null
          internal_converted_stage?: string | null
          last_interaction_at?: string | null
          lead_score?: number
          lead_temperature?: string
          name?: string
          next_action_at?: string | null
          notes?: string | null
          operational_status?: string
          opt_in_status?: string
          phone?: string | null
          pipeline_stage?: string
          re_accepts_pets?: boolean
          re_amenities?: string[] | null
          re_bathrooms?: number | null
          re_bedrooms?: number | null
          re_block_reason?: string | null
          re_budget_estimated_mxn?: number | null
          re_credit_preapproved?: boolean
          re_credit_type?: string | null
          re_current_situation?: string | null
          re_down_payment_mxn?: number | null
          re_monthly_income_mxn?: number | null
          re_parking_spots?: number | null
          re_properties_viewed_ids?: string[] | null
          re_property_followup_status?: string | null
          re_property_interest_id?: string | null
          re_property_not_interested_reason?: string | null
          re_property_types?: string[] | null
          re_reason?: string | null
          re_requires_parking?: boolean
          re_visit_outcome?: string | null
          re_zones?: string[] | null
          source?: string | null
          status?: Database["public"]["Enums"]["contact_status"]
          tags?: string[] | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_assigned_agent_fk"
            columns: ["assigned_agent_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_re_property_interest_id_fkey"
            columns: ["re_property_interest_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_activity: {
        Row: {
          actor_type: string
          actor_user_id: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          event_type: string
          id: string
          payload: Json | null
          tenant_id: string
        }
        Insert: {
          actor_type?: string
          actor_user_id?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          event_type: string
          id?: string
          payload?: Json | null
          tenant_id: string
        }
        Update: {
          actor_type?: string
          actor_user_id?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          event_type?: string
          id?: string
          payload?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_activity_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_activity_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_activity_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_activity_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_followups: {
        Row: {
          assigned_user_id: string | null
          canceled_at: string | null
          completed_at: string | null
          contact_id: string
          conversation_id: string
          created_at: string
          due_at: string
          id: string
          note: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          assigned_user_id?: string | null
          canceled_at?: string | null
          completed_at?: string | null
          contact_id: string
          conversation_id: string
          created_at?: string
          due_at: string
          id?: string
          note?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          assigned_user_id?: string | null
          canceled_at?: string | null
          completed_at?: string | null
          contact_id?: string
          conversation_id?: string
          created_at?: string
          due_at?: string
          id?: string
          note?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_followups_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_followups_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_followups_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_followups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          ai_pause_reason: string | null
          ai_paused_at: string | null
          ai_paused_by: string | null
          ai_state: string | null
          contact_id: string
          created_at: string
          customer_whatsapp: string
          id: string
          last_agent_message_at: string | null
          last_customer_message_at: string | null
          last_message_direction: string | null
          last_message_preview: string | null
          last_message_source: string | null
          needs_human: boolean | null
          status: string
          tenant_id: string
          twilio_subaccount_sid: string | null
          twilio_whatsapp_number: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_pause_reason?: string | null
          ai_paused_at?: string | null
          ai_paused_by?: string | null
          ai_state?: string | null
          contact_id: string
          created_at?: string
          customer_whatsapp: string
          id?: string
          last_agent_message_at?: string | null
          last_customer_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          last_message_source?: string | null
          needs_human?: boolean | null
          status?: string
          tenant_id: string
          twilio_subaccount_sid?: string | null
          twilio_whatsapp_number?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          ai_pause_reason?: string | null
          ai_paused_at?: string | null
          ai_paused_by?: string | null
          ai_state?: string | null
          contact_id?: string
          created_at?: string
          customer_whatsapp?: string
          id?: string
          last_agent_message_at?: string | null
          last_customer_message_at?: string | null
          last_message_direction?: string | null
          last_message_preview?: string | null
          last_message_source?: string | null
          needs_human?: boolean | null
          status?: string
          tenant_id?: string
          twilio_subaccount_sid?: string | null
          twilio_whatsapp_number?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      conversion_event_logs: {
        Row: {
          contact_id: string
          created_at: string
          error_message: string | null
          event_name: string
          id: string
          payload: Json | null
          pipeline_stage: string | null
          source: string
          status: string
          tenant_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          error_message?: string | null
          event_name: string
          id?: string
          payload?: Json | null
          pipeline_stage?: string | null
          source: string
          status?: string
          tenant_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          error_message?: string | null
          event_name?: string
          id?: string
          payload?: Json | null
          pipeline_stage?: string | null
          source?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversion_event_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_event_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      event_audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          diff: Json
          event_id: string
          id: string
          tenant_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json
          event_id: string
          id?: string
          tenant_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          diff?: Json
          event_id?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_audit_logs_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          contact_id: string
          created_at: string
          created_by: string | null
          end_at: string | null
          event_type: string
          id: string
          metadata: Json
          notes: string | null
          source: string
          start_at: string
          status: string
          tenant_id: string
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          notes?: string | null
          source?: string
          start_at: string
          status?: string
          tenant_id: string
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          created_by?: string | null
          end_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json
          notes?: string | null
          source?: string
          start_at?: string
          status?: string
          tenant_id?: string
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          ai_generated: boolean
          body: string | null
          campaign_id: string | null
          channel: string
          contact_id: string | null
          conversation_id: string
          created_at: string
          direction: string
          error_code: string | null
          error_message: string | null
          from_number: string
          id: string
          location_lat: number | null
          location_lng: number | null
          media_duration_sec: number | null
          media_filename: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_type: string | null
          media_urls: string[] | null
          on_behalf_of_user_id: string | null
          provider: string
          sent_by_user_id: string | null
          source: string
          status: string
          template_id: string | null
          tenant_id: string
          to_number: string
          twilio_message_sid: string | null
        }
        Insert: {
          ai_generated?: boolean
          body?: string | null
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          conversation_id: string
          created_at?: string
          direction: string
          error_code?: string | null
          error_message?: string | null
          from_number: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          media_duration_sec?: number | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          media_urls?: string[] | null
          on_behalf_of_user_id?: string | null
          provider?: string
          sent_by_user_id?: string | null
          source?: string
          status?: string
          template_id?: string | null
          tenant_id: string
          to_number: string
          twilio_message_sid?: string | null
        }
        Update: {
          ai_generated?: boolean
          body?: string | null
          campaign_id?: string | null
          channel?: string
          contact_id?: string | null
          conversation_id?: string
          created_at?: string
          direction?: string
          error_code?: string | null
          error_message?: string | null
          from_number?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          media_duration_sec?: number | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_type?: string | null
          media_urls?: string[] | null
          on_behalf_of_user_id?: string | null
          provider?: string
          sent_by_user_id?: string | null
          source?: string
          status?: string
          template_id?: string | null
          tenant_id?: string
          to_number?: string
          twilio_message_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      meta_event_mappings: {
        Row: {
          created_at: string
          event_value: number | null
          id: string
          is_active: boolean
          meta_event_name: string
          meta_event_type: string
          pipeline_stage: string
          send_capi: boolean
          send_pixel: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_value?: number | null
          id?: string
          is_active?: boolean
          meta_event_name: string
          meta_event_type: string
          pipeline_stage: string
          send_capi?: boolean
          send_pixel?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_value?: number | null
          id?: string
          is_active?: boolean
          meta_event_name?: string
          meta_event_type?: string
          pipeline_stage?: string
          send_capi?: boolean
          send_pixel?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meta_event_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      password_resets: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          ip_address: string | null
          request_count: number
          tenant_id: string | null
          token_hash: string
          used_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          ip_address?: string | null
          request_count?: number
          tenant_id?: string | null
          token_hash: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          request_count?: number
          tenant_id?: string | null
          token_hash?: string
          used_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "password_resets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "password_resets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pipeline_stage_suggestions: {
        Row: {
          confidence: number
          contact_id: string
          conversation_id: string
          created_at: string
          current_stage: string
          id: string
          reasoning: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
          suggested_stage: string
          tenant_id: string
        }
        Insert: {
          confidence?: number
          contact_id: string
          conversation_id: string
          created_at?: string
          current_stage: string
          id?: string
          reasoning: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggested_stage: string
          tenant_id: string
        }
        Update: {
          confidence?: number
          contact_id?: string
          conversation_id?: string
          created_at?: string
          current_stage?: string
          id?: string
          reasoning?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          suggested_stage?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pipeline_stage_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_suggestions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pipeline_stage_suggestions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          first_login_required: boolean
          id: string
          invited_at: string | null
          invited_by: string | null
          last_login_at: string | null
          name: string
          password_set_at: string | null
          status: string
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          first_login_required?: boolean
          id: string
          invited_at?: string | null
          invited_by?: string | null
          last_login_at?: string | null
          name: string
          password_set_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          first_login_required?: boolean
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          last_login_at?: string | null
          name?: string
          password_set_at?: string | null
          status?: string
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          accepted_credits: string[] | null
          address: string | null
          ai_prompt: string | null
          assigned_user_id: string | null
          created_at: string
          currency: string
          id: string
          internal_notes: string | null
          is_active: boolean
          maintenance_fee: number | null
          operation_type: string
          price: number
          property_code: string
          property_type: string | null
          status: string
          template_id: string | null
          tenant_id: string
          title: string
          updated_at: string
          visit_availability: string | null
          youtube_url: string | null
          zone: string
        }
        Insert: {
          accepted_credits?: string[] | null
          address?: string | null
          ai_prompt?: string | null
          assigned_user_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          maintenance_fee?: number | null
          operation_type?: string
          price?: number
          property_code: string
          property_type?: string | null
          status?: string
          template_id?: string | null
          tenant_id: string
          title: string
          updated_at?: string
          visit_availability?: string | null
          youtube_url?: string | null
          zone: string
        }
        Update: {
          accepted_credits?: string[] | null
          address?: string | null
          ai_prompt?: string | null
          assigned_user_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          maintenance_fee?: number | null
          operation_type?: string
          price?: number
          property_code?: string
          property_type?: string | null
          status?: string
          template_id?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
          visit_availability?: string | null
          youtube_url?: string | null
          zone?: string
        }
        Relationships: [
          {
            foreignKeyName: "properties_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "properties_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_assignments: {
        Row: {
          assigned_by: string | null
          created_at: string | null
          id: string
          property_id: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          property_id: string
          tenant_id: string
          user_id: string
        }
        Update: {
          assigned_by?: string | null
          created_at?: string | null
          id?: string
          property_id?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_assignments_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string | null
          file_type: string | null
          file_url: string
          id: string
          property_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path?: string | null
          file_type?: string | null
          file_url: string
          id?: string
          property_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string | null
          file_type?: string | null
          file_url?: string
          id?: string
          property_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_documents_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_faq: {
        Row: {
          answer: string
          created_at: string
          id: string
          property_id: string
          question: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          property_id: string
          question: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          property_id?: string
          question?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_faq_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_faq_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      property_images: {
        Row: {
          created_at: string
          file_path: string | null
          file_url: string
          id: string
          is_cover: boolean
          property_id: string
          sort_order: number
          tenant_id: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          file_url: string
          id?: string
          is_cover?: boolean
          property_id: string
          sort_order?: number
          tenant_id: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          file_url?: string
          id?: string
          is_cover?: boolean
          property_id?: string
          sort_order?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "property_images_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "property_images_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      security_events: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          tenant_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          tenant_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "security_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "security_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      segment_contacts: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          segment_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          segment_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          segment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "segment_contacts_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "segment_contacts_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "segments"
            referencedColumns: ["id"]
          },
        ]
      }
      segments: {
        Row: {
          created_at: string
          description: string | null
          fingerprint: string | null
          id: string
          last_calculated_at: string | null
          name: string
          reuse_count: number
          rules_json: Json | null
          status: Database["public"]["Enums"]["segment_status"]
          tenant_id: string
          type: Database["public"]["Enums"]["segment_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          fingerprint?: string | null
          id?: string
          last_calculated_at?: string | null
          name: string
          reuse_count?: number
          rules_json?: Json | null
          status?: Database["public"]["Enums"]["segment_status"]
          tenant_id: string
          type?: Database["public"]["Enums"]["segment_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          fingerprint?: string | null
          id?: string
          last_calculated_at?: string | null
          name?: string
          reuse_count?: number
          rules_json?: Json | null
          status?: Database["public"]["Enums"]["segment_status"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["segment_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "segments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      support_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_path: string | null
          file_size: number | null
          file_type: string
          file_url: string
          id: string
          message_id: string | null
          ticket_id: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path?: string | null
          file_size?: number | null
          file_type: string
          file_url: string
          id?: string
          message_id?: string | null
          ticket_id: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string | null
          file_size?: number | null
          file_type?: string
          file_url?: string
          id?: string
          message_id?: string | null
          ticket_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "support_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_internal_notes: {
        Row: {
          created_at: string
          created_by: string
          id: string
          note: string
          tenant_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          note: string
          tenant_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          note?: string
          tenant_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_internal_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_internal_notes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_internal_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          created_at: string
          has_attachments: boolean
          id: string
          is_internal: boolean
          message: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id: string
        }
        Insert: {
          created_at?: string
          has_attachments?: boolean
          id?: string
          is_internal?: boolean
          message: string
          sender_id: string
          sender_type: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id: string
        }
        Update: {
          created_at?: string
          has_attachments?: boolean
          id?: string
          is_internal?: boolean
          message?: string
          sender_id?: string
          sender_type?: Database["public"]["Enums"]["ticket_sender_type"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_ticket_reads: {
        Row: {
          id: string
          last_read_at: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          id?: string
          last_read_at?: string
          ticket_id: string
          user_id: string
        }
        Update: {
          id?: string
          last_read_at?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_ticket_reads_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_ticket_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["ticket_category"]
          created_at: string
          created_by: string
          id: string
          priority: Database["public"]["Enums"]["ticket_priority"]
          status: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          created_by: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["ticket_category"]
          created_at?: string
          created_by?: string
          id?: string
          priority?: Database["public"]["Enums"]["ticket_priority"]
          status?: Database["public"]["Enums"]["ticket_status"]
          subject?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tickets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alerts: {
        Row: {
          code: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          message: string
          resolved: boolean
          resolved_at: string | null
          severity: number
          tenant_id: string
          title: string
          type: string
        }
        Insert: {
          code: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: number
          tenant_id: string
          title: string
          type: string
        }
        Update: {
          code?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          message?: string
          resolved?: boolean
          resolved_at?: string | null
          severity?: number
          tenant_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_alerts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      system_event_bus: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          error: string | null
          event_name: string
          id: string
          payload: Json
          processed_at: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type?: string
          error?: string | null
          event_name: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          error?: string | null
          event_name?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_event_bus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          ai_conversation_id: string | null
          approval_status: string
          body: string
          buttons: Json | null
          category: string
          created_at: string
          created_by_module: string | null
          created_by_user_id: string | null
          created_source: string
          display_name: string | null
          fingerprint: string | null
          footer: string | null
          header_text: string | null
          header_type: string | null
          id: string
          label: string | null
          last_submit_idempotency_key: string | null
          last_synced_at: string | null
          last_upsert_idempotency_key: string | null
          media_filename: string | null
          media_mime_type: string | null
          media_size_bytes: number | null
          media_url: string | null
          name: string
          rejection_reason: string | null
          tenant_id: string
          twilio_template_sid: string | null
          updated_at: string
          used_count: number
          variables: string[] | null
        }
        Insert: {
          ai_conversation_id?: string | null
          approval_status?: string
          body: string
          buttons?: Json | null
          category?: string
          created_at?: string
          created_by_module?: string | null
          created_by_user_id?: string | null
          created_source?: string
          display_name?: string | null
          fingerprint?: string | null
          footer?: string | null
          header_text?: string | null
          header_type?: string | null
          id?: string
          label?: string | null
          last_submit_idempotency_key?: string | null
          last_synced_at?: string | null
          last_upsert_idempotency_key?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          name: string
          rejection_reason?: string | null
          tenant_id: string
          twilio_template_sid?: string | null
          updated_at?: string
          used_count?: number
          variables?: string[] | null
        }
        Update: {
          ai_conversation_id?: string | null
          approval_status?: string
          body?: string
          buttons?: Json | null
          category?: string
          created_at?: string
          created_by_module?: string | null
          created_by_user_id?: string | null
          created_source?: string
          display_name?: string | null
          fingerprint?: string | null
          footer?: string | null
          header_text?: string | null
          header_type?: string | null
          id?: string
          label?: string | null
          last_submit_idempotency_key?: string | null
          last_synced_at?: string | null
          last_upsert_idempotency_key?: string | null
          media_filename?: string | null
          media_mime_type?: string | null
          media_size_bytes?: number | null
          media_url?: string | null
          name?: string
          rejection_reason?: string | null
          tenant_id?: string
          twilio_template_sid?: string | null
          updated_at?: string
          used_count?: number
          variables?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_ai_settings: {
        Row: {
          agent_name: string
          behavior_prompt: string | null
          company_name: string | null
          created_at: string
          enabled: boolean
          escalate_on_frustration: boolean
          escalate_on_human_request: boolean
          escalate_on_no_answer: boolean
          fallback_message: string | null
          id: string
          max_emojis_per_message: number
          never_reveal_ai: boolean
          response_delay_seconds: number
          tenant_id: string
          timezone: string
          tone: Database["public"]["Enums"]["ai_tone"]
          updated_at: string
          use_customer_name: boolean
          use_emojis: boolean
        }
        Insert: {
          agent_name?: string
          behavior_prompt?: string | null
          company_name?: string | null
          created_at?: string
          enabled?: boolean
          escalate_on_frustration?: boolean
          escalate_on_human_request?: boolean
          escalate_on_no_answer?: boolean
          fallback_message?: string | null
          id?: string
          max_emojis_per_message?: number
          never_reveal_ai?: boolean
          response_delay_seconds?: number
          tenant_id: string
          timezone?: string
          tone?: Database["public"]["Enums"]["ai_tone"]
          updated_at?: string
          use_customer_name?: boolean
          use_emojis?: boolean
        }
        Update: {
          agent_name?: string
          behavior_prompt?: string | null
          company_name?: string | null
          created_at?: string
          enabled?: boolean
          escalate_on_frustration?: boolean
          escalate_on_human_request?: boolean
          escalate_on_no_answer?: boolean
          fallback_message?: string | null
          id?: string
          max_emojis_per_message?: number
          never_reveal_ai?: boolean
          response_delay_seconds?: number
          tenant_id?: string
          timezone?: string
          tone?: Database["public"]["Enums"]["ai_tone"]
          updated_at?: string
          use_customer_name?: boolean
          use_emojis?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "tenant_ai_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_integrations: {
        Row: {
          account_sid: string | null
          api_key: string | null
          auth_token_encrypted: string | null
          balance: number | null
          created_at: string
          currency: string | null
          daily_messages_date: string | null
          daily_messages_sent: number | null
          id: string
          max_messages_per_day: number | null
          messaging_service_sid: string | null
          phone_number: string | null
          phone_number_id: string | null
          phone_number_name: string | null
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          tenant_id: string
          total_messages_sent: number | null
          updated_at: string
          waba_id: string | null
          warmup_level: number | null
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          account_sid?: string | null
          api_key?: string | null
          auth_token_encrypted?: string | null
          balance?: number | null
          created_at?: string
          currency?: string | null
          daily_messages_date?: string | null
          daily_messages_sent?: number | null
          id?: string
          max_messages_per_day?: number | null
          messaging_service_sid?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          phone_number_name?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          tenant_id: string
          total_messages_sent?: number | null
          updated_at?: string
          waba_id?: string | null
          warmup_level?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          account_sid?: string | null
          api_key?: string | null
          auth_token_encrypted?: string | null
          balance?: number | null
          created_at?: string
          currency?: string | null
          daily_messages_date?: string | null
          daily_messages_sent?: number | null
          id?: string
          max_messages_per_day?: number | null
          messaging_service_sid?: string | null
          phone_number?: string | null
          phone_number_id?: string | null
          phone_number_name?: string | null
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          tenant_id?: string
          total_messages_sent?: number | null
          updated_at?: string
          waba_id?: string | null
          warmup_level?: number | null
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_integrations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          created_at: string
          internal_conversion_allow_reversal: boolean
          internal_conversion_first_time_only: boolean
          internal_conversion_stage: string
          meta_capi_access_token: string | null
          meta_enabled: boolean
          meta_pixel_id: string | null
          meta_send_capi: boolean
          meta_send_pixel: boolean
          meta_test_event_code: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          internal_conversion_allow_reversal?: boolean
          internal_conversion_first_time_only?: boolean
          internal_conversion_stage?: string
          meta_capi_access_token?: string | null
          meta_enabled?: boolean
          meta_pixel_id?: string | null
          meta_send_capi?: boolean
          meta_send_pixel?: boolean
          meta_test_event_code?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          internal_conversion_allow_reversal?: boolean
          internal_conversion_first_time_only?: boolean
          internal_conversion_stage?: string
          meta_capi_access_token?: string | null
          meta_enabled?: boolean
          meta_pixel_id?: string | null
          meta_send_capi?: boolean
          meta_send_pixel?: boolean
          meta_test_event_code?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          accumulated_credits: number
          billing_state: Database["public"]["Enums"]["tenant_billing_state"]
          canceled_at: string | null
          cancellation_comment: string | null
          cancellation_reason: string | null
          cancellation_requested_at: string | null
          created_at: string
          current_period_end: string | null
          extra_credits: number
          id: string
          initial_credits_granted: boolean
          last_invoice_id: string | null
          last_payment_at: string | null
          last_refill_at: string | null
          last_upgrade_grant_key: string | null
          max_contacts: number
          max_users: number
          message_credits: number
          monthly_credits_remaining: number
          name: string
          next_refill_at: string | null
          pending_plan: string | null
          pending_plan_effective_at: string | null
          pending_stripe_price_id: string | null
          plan: Database["public"]["Enums"]["tenant_plan"]
          status: Database["public"]["Enums"]["tenant_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          updated_at: string
        }
        Insert: {
          accumulated_credits?: number
          billing_state?: Database["public"]["Enums"]["tenant_billing_state"]
          canceled_at?: string | null
          cancellation_comment?: string | null
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          created_at?: string
          current_period_end?: string | null
          extra_credits?: number
          id?: string
          initial_credits_granted?: boolean
          last_invoice_id?: string | null
          last_payment_at?: string | null
          last_refill_at?: string | null
          last_upgrade_grant_key?: string | null
          max_contacts?: number
          max_users?: number
          message_credits?: number
          monthly_credits_remaining?: number
          name: string
          next_refill_at?: string | null
          pending_plan?: string | null
          pending_plan_effective_at?: string | null
          pending_stripe_price_id?: string | null
          plan?: Database["public"]["Enums"]["tenant_plan"]
          status?: Database["public"]["Enums"]["tenant_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Update: {
          accumulated_credits?: number
          billing_state?: Database["public"]["Enums"]["tenant_billing_state"]
          canceled_at?: string | null
          cancellation_comment?: string | null
          cancellation_reason?: string | null
          cancellation_requested_at?: string | null
          created_at?: string
          current_period_end?: string | null
          extra_credits?: number
          id?: string
          initial_credits_granted?: boolean
          last_invoice_id?: string | null
          last_payment_at?: string | null
          last_refill_at?: string | null
          last_upgrade_grant_key?: string | null
          max_contacts?: number
          max_users?: number
          message_credits?: number
          monthly_credits_remaining?: number
          name?: string
          next_refill_at?: string | null
          pending_plan?: string | null
          pending_plan_effective_at?: string | null
          pending_stripe_price_id?: string | null
          plan?: Database["public"]["Enums"]["tenant_plan"]
          status?: Database["public"]["Enums"]["tenant_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          global_role: Database["public"]["Enums"]["global_role"]
          id: string
          tenant_role: Database["public"]["Enums"]["tenant_role"] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          global_role?: Database["public"]["Enums"]["global_role"]
          id?: string
          tenant_role?: Database["public"]["Enums"]["tenant_role"] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          global_role?: Database["public"]["Enums"]["global_role"]
          id?: string
          tenant_role?: Database["public"]["Enums"]["tenant_role"] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_idempotency: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_idempotency_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_ledger: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          bucket: string | null
          created_at: string
          id: string
          idempotency_key: string | null
          movement_type: string
          reason: string
          source_id: string | null
          source_table: string | null
          tenant_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          bucket?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          movement_type: string
          reason: string
          source_id?: string | null
          source_table?: string | null
          tenant_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          bucket?: string | null
          created_at?: string
          id?: string
          idempotency_key?: string | null
          movement_type?: string
          reason?: string
          source_id?: string | null
          source_table?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_ledger_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          created_at: string
          id: string
          messages: number
          meta: Json | null
          reason: Database["public"]["Enums"]["wallet_transaction_reason"]
          tenant_id: string
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages: number
          meta?: Json | null
          reason: Database["public"]["Enums"]["wallet_transaction_reason"]
          tenant_id: string
          type: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: number
          meta?: Json | null
          reason?: Database["public"]["Enums"]["wallet_transaction_reason"]
          tenant_id?: string
          type?: Database["public"]["Enums"]["wallet_transaction_type"]
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance_messages: number
          balance_monthly: number
          balance_rollover: number
          created_at: string
          id: string
          low_threshold: number
          status: Database["public"]["Enums"]["wallet_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance_messages?: number
          balance_monthly?: number
          balance_rollover?: number
          created_at?: string
          id?: string
          low_threshold?: number
          status?: Database["public"]["Enums"]["wallet_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance_messages?: number
          balance_monthly?: number
          balance_rollover?: number
          created_at?: string
          id?: string
          low_threshold?: number
          status?: Database["public"]["Enums"]["wallet_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_tenant_subscription: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      can_access_conversation: {
        Args: { _conversation_id: string; _user_id: string }
        Returns: boolean
      }
      can_send_message: { Args: { p_tenant_id: string }; Returns: boolean }
      can_tenant_send_message: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      complete_tenant_onboarding: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      deduct_message_credit: {
        Args: { p_tenant_id: string }
        Returns: {
          billing_state: Database["public"]["Enums"]["tenant_billing_state"]
          remaining_credits: number
          success: boolean
        }[]
      }
      fn_add_extra_credits: {
        Args: {
          p_amount: number
          p_idempotency_key?: string
          p_reason?: string
          p_source_id?: string
          p_source_table?: string
          p_tenant_id: string
        }
        Returns: {
          error_code: string
          new_extra: number
          new_total: number
          success: boolean
        }[]
      }
      fn_apply_credit_movement: {
        Args: {
          p_amount: number
          p_idempotency_key?: string
          p_movement_type: string
          p_reason?: string
          p_source_id?: string
          p_source_table?: string
          p_tenant_id: string
        }
        Returns: {
          billing_state: Database["public"]["Enums"]["tenant_billing_state"]
          error_code: string
          new_balance: number
          success: boolean
        }[]
      }
      fn_debit_credits: {
        Args: {
          p_amount?: number
          p_idempotency_key?: string
          p_reason?: string
          p_source_id?: string
          p_source_table?: string
          p_tenant_id: string
        }
        Returns: {
          accumulated: number
          billing_state: Database["public"]["Enums"]["tenant_billing_state"]
          error_code: string
          extra: number
          monthly_remaining: number
          success: boolean
          total_remaining: number
        }[]
      }
      fn_get_tenant_credits: {
        Args: { p_tenant_id: string }
        Returns: {
          accumulated: number
          billing_state: Database["public"]["Enums"]["tenant_billing_state"]
          extra: number
          last_refill_at: string
          monthly_remaining: number
          next_refill_at: string
          total: number
        }[]
      }
      fn_get_wallet_balances: {
        Args: { p_tenant_id: string }
        Returns: {
          balance_monthly: number
          balance_rollover: number
          status: Database["public"]["Enums"]["wallet_status"]
          total: number
        }[]
      }
      fn_refill_monthly_credits: {
        Args: {
          p_idempotency_key?: string
          p_refill_at?: string
          p_tenant_id: string
        }
        Returns: {
          accumulated: number
          error_code: string
          monthly_remaining: number
          success: boolean
          total_credits: number
        }[]
      }
      fn_wallet_debit_credits: {
        Args: {
          p_amount?: number
          p_idempotency_key?: string
          p_reason?: string
          p_related_entity_id?: string
          p_related_entity_type?: string
          p_tenant_id: string
        }
        Returns: {
          balance_monthly_after: number
          balance_rollover_after: number
          debited_monthly: number
          debited_rollover: number
          duplicated: boolean
          error_code: string
          success: boolean
          total_after: number
        }[]
      }
      get_plan_monthly_credits: { Args: { plan_name: string }; Returns: number }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      has_any_tenant_role: {
        Args: {
          _roles: Database["public"]["Enums"]["tenant_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_property_assignment: {
        Args: { _property_id: string; _user_id: string }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["tenant_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_manager_or_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ai_tone: "cordial" | "professional" | "friendly" | "adaptive"
      automation_action_type:
        | "send_message"
        | "send_template"
        | "delay"
        | "assign_agent"
        | "add_tag"
        | "remove_tag"
        | "update_field"
        | "create_note"
        | "notify_agent"
      automation_run_status:
        | "queued"
        | "running"
        | "success"
        | "failed"
        | "skipped_condition"
        | "blocked_wallet"
        | "blocked_rate"
        | "blocked_window"
        | "blocked_optout"
        | "blocked_template"
        | "paused"
      automation_status: "draft" | "active" | "paused"
      automation_step_status:
        | "queued"
        | "running"
        | "success"
        | "failed"
        | "skipped"
        | "blocked"
      automation_trigger_type:
        | "inbound_message"
        | "window_expiring"
        | "window_expired"
        | "campaign_touched"
        | "campaign_replied"
        | "field_changed"
        | "tag_changed"
        | "scheduled"
        | "event.created"
        | "event.upcoming"
        | "event.canceled"
        | "event.completed"
        | "event.no_show"
        | "event.confirmed"
      consent_channel: "whatsapp"
      consent_status: "allowed" | "opted_out" | "dnd" | "blocked"
      contact_status: "active" | "archived" | "deleted"
      custom_field_type:
        | "short_text"
        | "long_text"
        | "number"
        | "decimal"
        | "boolean"
        | "date"
        | "datetime"
        | "url"
        | "select"
      global_role: "super_admin" | "user"
      integration_status:
        | "pending_setup"
        | "connected"
        | "error"
        | "disconnected"
      kb_category:
        | "general_info"
        | "products"
        | "services"
        | "pricing"
        | "purchase_process"
        | "payments"
        | "policies"
        | "schedules"
        | "other"
        | "properties"
        | "financing"
        | "visits"
        | "legal"
        | "location"
        | "construction"
        | "post_sale"
        | "objections"
      segment_status: "active" | "archived"
      segment_type: "static" | "dynamic"
      tenant_billing_state:
        | "ONBOARDING_PAID"
        | "ACTIVE_WITH_CREDITS"
        | "CREDITS_EXHAUSTED"
        | "SUBSCRIPTION_REQUIRED"
        | "SUBSCRIBED_ACTIVE"
      tenant_plan:
        | "trial"
        | "basic"
        | "pro"
        | "enterprise"
        | "starter"
        | "growth"
        | "scale"
      tenant_role:
        | "owner"
        | "marketer"
        | "readonly"
        | "administrador"
        | "manager"
        | "asesor"
      tenant_status: "active" | "suspended" | "trial"
      ticket_category:
        | "bug"
        | "campaign_error"
        | "billing"
        | "whatsapp_twilio"
        | "ux_ui"
        | "other"
      ticket_priority: "low" | "medium" | "high" | "critical"
      ticket_sender_type: "owner" | "admin" | "system"
      ticket_status:
        | "open"
        | "in_progress"
        | "waiting_customer"
        | "resolved"
        | "closed"
      wallet_status: "active" | "low" | "blocked"
      wallet_transaction_reason:
        | "inbound_message"
        | "outbound_message"
        | "campaign_message"
        | "template_message"
        | "manual_adjustment"
      wallet_transaction_type: "topup" | "debit"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_tone: ["cordial", "professional", "friendly", "adaptive"],
      automation_action_type: [
        "send_message",
        "send_template",
        "delay",
        "assign_agent",
        "add_tag",
        "remove_tag",
        "update_field",
        "create_note",
        "notify_agent",
      ],
      automation_run_status: [
        "queued",
        "running",
        "success",
        "failed",
        "skipped_condition",
        "blocked_wallet",
        "blocked_rate",
        "blocked_window",
        "blocked_optout",
        "blocked_template",
        "paused",
      ],
      automation_status: ["draft", "active", "paused"],
      automation_step_status: [
        "queued",
        "running",
        "success",
        "failed",
        "skipped",
        "blocked",
      ],
      automation_trigger_type: [
        "inbound_message",
        "window_expiring",
        "window_expired",
        "campaign_touched",
        "campaign_replied",
        "field_changed",
        "tag_changed",
        "scheduled",
        "event.created",
        "event.upcoming",
        "event.canceled",
        "event.completed",
        "event.no_show",
        "event.confirmed",
      ],
      consent_channel: ["whatsapp"],
      consent_status: ["allowed", "opted_out", "dnd", "blocked"],
      contact_status: ["active", "archived", "deleted"],
      custom_field_type: [
        "short_text",
        "long_text",
        "number",
        "decimal",
        "boolean",
        "date",
        "datetime",
        "url",
        "select",
      ],
      global_role: ["super_admin", "user"],
      integration_status: [
        "pending_setup",
        "connected",
        "error",
        "disconnected",
      ],
      kb_category: [
        "general_info",
        "products",
        "services",
        "pricing",
        "purchase_process",
        "payments",
        "policies",
        "schedules",
        "other",
        "properties",
        "financing",
        "visits",
        "legal",
        "location",
        "construction",
        "post_sale",
        "objections",
      ],
      segment_status: ["active", "archived"],
      segment_type: ["static", "dynamic"],
      tenant_billing_state: [
        "ONBOARDING_PAID",
        "ACTIVE_WITH_CREDITS",
        "CREDITS_EXHAUSTED",
        "SUBSCRIPTION_REQUIRED",
        "SUBSCRIBED_ACTIVE",
      ],
      tenant_plan: [
        "trial",
        "basic",
        "pro",
        "enterprise",
        "starter",
        "growth",
        "scale",
      ],
      tenant_role: [
        "owner",
        "marketer",
        "readonly",
        "administrador",
        "manager",
        "asesor",
      ],
      tenant_status: ["active", "suspended", "trial"],
      ticket_category: [
        "bug",
        "campaign_error",
        "billing",
        "whatsapp_twilio",
        "ux_ui",
        "other",
      ],
      ticket_priority: ["low", "medium", "high", "critical"],
      ticket_sender_type: ["owner", "admin", "system"],
      ticket_status: [
        "open",
        "in_progress",
        "waiting_customer",
        "resolved",
        "closed",
      ],
      wallet_status: ["active", "low", "blocked"],
      wallet_transaction_reason: [
        "inbound_message",
        "outbound_message",
        "campaign_message",
        "template_message",
        "manual_adjustment",
      ],
      wallet_transaction_type: ["topup", "debit"],
    },
  },
} as const
