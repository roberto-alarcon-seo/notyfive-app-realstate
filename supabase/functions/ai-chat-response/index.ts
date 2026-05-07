import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration for timeout and retry handling
const CONFIG = {
  AI_API_TIMEOUT_MS: 12000,
  AI_MAX_RETRIES: 2,
  AI_RETRY_DELAY_MS: 500,
  DB_TIMEOUT_MS: 5000,
};

// Helper for timeout wrapper
async function withTimeout<T>(promise: Promise<T>, ms: number, errorMsg: string): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(errorMsg)), ms)
  );
  return Promise.race([promise, timeout]);
}

// Helper for exponential backoff delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Trigger automatic agent assignment after AI handoff
async function triggerAssignment(
  supabase: any,
  conversationId: string,
  reason: string
) {
  try {
    const { data, error } = await supabase.rpc('fn_assign_conversation', {
      p_conversation_id: conversationId,
      p_force_strategy: null,
      p_force_agent_id: null,
      p_assigned_by: null,
      p_reason: `ai_handoff:${reason}`,
    });
    if (error) console.warn('⚠️ assignment error:', error);
    else console.log('🎯 AI handoff assignment:', data?.[0]);
  } catch (e) {
    console.warn('⚠️ assignment skipped:', e);
  }
}

interface AISettings {
  enabled: boolean;
  agent_name: string;
  company_name: string | null;
  timezone: string;
  response_delay_seconds: number;
  tone: string;
  use_emojis: boolean;
  max_emojis_per_message: number;
  never_reveal_ai: boolean;
  use_customer_name: boolean;
  escalate_on_frustration: boolean;
  escalate_on_no_answer: boolean;
  escalate_on_human_request: boolean;
  behavior_prompt: string | null;
  fallback_message: string | null;
  region_code?: string;
  language?: string;
  formality?: string;
  max_message_length?: number;
  max_ai_turns_before_handoff?: number;
  business_hours?: any;
  out_of_hours_message?: string | null;
  handoff_triggers?: any;
}

interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
}

// ===== Regional / conversation helpers =====
const REGION_CONTEXT: Record<string, { country: string; currency: string; modismos: string }> = {
  MX: { country: 'México', currency: 'MXN ($)', modismos: 'Español de México. USA: "departamento", "recámara", "alberca", "cochera", "Infonavit/Fovissste", "enganche", "mensualidades", "ahorita", "platicar". EVITA: "piso", "habitación", "vale", "vosotros", "tío/tía".' },
  CO: { country: 'Colombia', currency: 'COP ($)', modismos: 'Español colombiano. USA: "apartamento", "habitación/alcoba", "parqueadero", "subsidio MiCasaYa", "cuota inicial", "arriendo", "chévere", "con mucho gusto", "le cuento que…". EVITA: "departamento", "recámara", "piso", "vale", "vosotros".' },
  PE: { country: 'Perú', currency: 'PEN (S/)', modismos: 'Español peruano. USA: "departamento", "dormitorio", "cochera", "crédito Mivivienda/Techo Propio", "inicial", "chévere", "bacán". EVITA: "piso", "vale", "vosotros".' },
  AR: { country: 'Argentina', currency: 'ARS ($)', modismos: 'Español rioplatense. USA "vos" y conjugación voseante (tenés, querés, podés). USA: "departamento", "ambientes", "expensas", "cochera", "che", "dale". EVITA: "tú", "vosotros", "piso".' },
  CL: { country: 'Chile', currency: 'CLP ($)', modismos: 'Español chileno. USA: "departamento", "dormitorio", "estacionamiento", "UF", "pie", "bacán". EVITA: "piso", "recámara", "vale", "vosotros".' },
  ES: { country: 'España', currency: 'EUR (€)', modismos: 'OBLIGATORIO ESPAÑOL DE ESPAÑA (castellano peninsular). USA SIEMPRE: "piso" (NUNCA "departamento" ni "apartamento"), "habitación" (NUNCA "recámara"/"dormitorio" como término principal), "salón", "cuarto de baño/aseo", "plaza de garaje", "trastero", "comunidad de propietarios", "IBI", "arras", "hipoteca", "ascensor". USA expresiones locales: "vale", "venga", "estupendo", "genial", "qué tal", "encantado/a", "un saludo cordial". USA "coger", "ordenador", "móvil", "coche". PROHIBIDO: "ahorita", "platicar", "departamento", "recámara", "carro", "celular", "computadora", "okey", "sale", "chévere", "parqueadero", "alberca" (di "piscina"), "cochera" (di "garaje"), "enganche" (di "entrada"), "mensualidades" (di "cuota mensual/letra").' },
  US: { country: 'Estados Unidos (hispano)', currency: 'USD ($)', modismos: 'Español neutro latino, términos bilingües si aplica.' },
};

const FORMALITY_TEXT: Record<string, string> = {
  tu: 'Trata al cliente de "tú" (informal cercano).',
  usted: 'Trata al cliente de "usted" (formal y respetuoso). Nunca uses "tú".',
  vos: 'Trata al cliente de "vos" (informal rioplatense).',
};

const LANGUAGE_TEXT: Record<string, string> = {
  es: 'Responde SIEMPRE en español.',
  en: 'Responde SIEMPRE en inglés.',
  pt: 'Responde SIEMPRE en portugués.',
};

function stripEmojis(text: string): string {
  return text.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, '').replace(/\s+/g, ' ').trim();
}

function enforceMaxLength(text: string, maxLen: number): string {
  if (!maxLen || text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxLen * 0.7 ? cut.slice(0, lastSpace) : cut).trim() + '…';
}

function isWithinBusinessHours(bh: any): { open: boolean; configured: boolean } {
  if (!bh || !bh.enabled) return { open: true, configured: false };
  try {
    const tz = bh.timezone || 'America/Mexico_City';
    const now = new Date();
    const fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
    const parts = fmt.formatToParts(now);
    const wd = parts.find(p => p.type === 'weekday')?.value?.toLowerCase().slice(0,3) || '';
    const hh = parts.find(p => p.type === 'hour')?.value || '00';
    const mm = parts.find(p => p.type === 'minute')?.value || '00';
    const dayKey: Record<string,string> = { mon:'mon', tue:'tue', wed:'wed', thu:'thu', fri:'fri', sat:'sat', sun:'sun' };
    const day = bh.days?.[dayKey[wd]];
    if (!day || !day.open || !day.close) return { open: false, configured: true };
    const cur = `${hh}:${mm}`;
    return { open: cur >= day.open && cur <= day.close, configured: true };
  } catch (e) {
    console.warn('business hours check failed', e);
    return { open: true, configured: false };
  }
}

serve(async (req) => {
  const startTime = Date.now();
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      tenant_id, 
      conversation_id, 
      contact_id, 
      inbound_message, 
      contact_name 
    } = await req.json();

    console.log('AI Chat Request:', { tenant_id, conversation_id, inbound_message });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      console.error('❌ LOVABLE_API_KEY not configured');
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get AI settings for tenant (or create default if not exists)
    let settings: AISettings | null = null;
    
    try {
      const { data, error: settingsError } = await supabase
        .from('tenant_ai_settings')
        .select('*')
        .eq('tenant_id', tenant_id)
        .single();

      if (settingsError?.code === 'PGRST116' || !data) {
        console.log('No AI settings found, creating default settings with AI enabled');
        const { data: newSettings, error: createError } = await supabase
          .from('tenant_ai_settings')
          .upsert({
            tenant_id,
            enabled: true,
            agent_name: 'Asistente',
            company_name: null,
            timezone: 'America/Mexico_City',
            response_delay_seconds: 2,
            tone: 'professional',
            use_emojis: true,
            max_emojis_per_message: 2,
            never_reveal_ai: true,
            use_customer_name: true,
            escalate_on_frustration: true,
            escalate_on_no_answer: true,
            escalate_on_human_request: true,
          }, { onConflict: 'tenant_id' })
          .select()
          .single();

        if (createError) {
          console.error('Error creating AI settings:', createError);
          // Retry fetching in case another request created it concurrently
          const { data: retryData } = await supabase
            .from('tenant_ai_settings')
            .select('*')
            .eq('tenant_id', tenant_id)
            .single();
          if (retryData) {
            settings = retryData as AISettings;
            console.log('Retrieved AI settings on retry after conflict');
          } else {
            return new Response(JSON.stringify({ 
              action: 'error',
              reason: 'settings_creation_failed' 
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
        } else {
          settings = newSettings as AISettings;
          console.log('Created default AI settings for tenant');
        }
      } else {
        settings = data as AISettings;
      }
    } catch (dbError) {
      console.error('Database error fetching settings:', dbError);
      return new Response(JSON.stringify({ 
        action: 'error',
        reason: 'database_error',
        error: dbError instanceof Error ? dbError.message : 'Unknown DB error'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!settings?.enabled) {
      console.log('AI is disabled for tenant');
      return new Response(JSON.stringify({ 
        action: 'skip',
        reason: 'ai_disabled' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiSettings = settings;

    // ===== Business hours check =====
    const bhCheck = isWithinBusinessHours(aiSettings.business_hours);
    const handoffTriggers = aiSettings.handoff_triggers || {};
    if (bhCheck.configured && !bhCheck.open && handoffTriggers.on_after_hours !== false) {
      console.log('⏰ Out of business hours, sending OOH message');
      const oohMsg = aiSettings.out_of_hours_message
        || 'Gracias por escribirnos. Te responderemos en cuanto abramos.';
      const customerOoh = aiSettings.use_customer_name && contact_name
        ? `Hola ${contact_name}. ${oohMsg}`
        : oohMsg;
      await supabase.from('conversations').update({
        ai_state: 'paused',
        needs_human: true,
        ai_pause_reason: 'after_hours',
        ai_paused_at: new Date().toISOString(),
      }).eq('id', conversation_id);
      await supabase.from('ai_interaction_logs').insert({
        tenant_id, conversation_id, contact_id, inbound_message,
        was_escalated: true, escalation_reason: 'after_hours',
      });
      return new Response(JSON.stringify({
        action: 'respond',
        response: customerOoh,
        delay_seconds: aiSettings.response_delay_seconds,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check if tenant can send using centralized function
    const { data: canSendResult } = await supabase.rpc('can_send_message', { p_tenant_id: tenant_id });

    if (!canSendResult) {
      console.log('Cannot send - marking needs_human');
      
      // Mark conversation as needs_human due to no balance
      await supabase
        .from('conversations')
        .update({
          ai_enabled: false,  // Force disable AI
          ai_state: 'paused',
          needs_human: true,
          ai_pause_reason: 'no_balance',
          ai_paused_at: new Date().toISOString()
        })
        .eq('id', conversation_id);
      await triggerAssignment(supabase, conversation_id, 'no_balance');

      // Log the interaction
      await supabase.from('ai_interaction_logs').insert({
        tenant_id,
        conversation_id,
        contact_id,
        inbound_message,
        was_escalated: true,
        escalation_reason: 'no_balance',
        wallet_debited: false,
      });

      return new Response(JSON.stringify({ 
        action: 'skip',
        reason: 'no_balance' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get knowledge base entries
    const { data: kbEntries } = await supabase
      .from('ai_knowledge_base')
      .select('id, question, answer, category')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    const knowledgeBase = (kbEntries || []) as KnowledgeEntry[];

    // Get active properties with their FAQs as additional knowledge
    const { data: propertiesData } = await supabase
      .from('properties')
      .select('id, title, property_code, zone, price, currency, operation_type, property_type, status, address, description, location_url, metadata, accepted_credits, maintenance_fee, ai_prompt, visit_availability, youtube_url')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    const properties = propertiesData || [];

    // Get FAQs for all active properties
    let propertyFaqs: { property_id: string; question: string; answer: string }[] = [];
    let propertyImages: { property_id: string; file_url: string; is_cover: boolean; sort_order: number }[] = [];
    if (properties.length > 0) {
      const propertyIds = properties.map(p => p.id);
      const [faqResult, imagesResult] = await Promise.all([
        supabase
          .from('property_faq')
          .select('property_id, question, answer')
          .in('property_id', propertyIds)
          .order('sort_order', { ascending: true }),
        supabase
          .from('property_images')
          .select('property_id, file_url, is_cover, sort_order')
          .in('property_id', propertyIds)
          .order('sort_order', { ascending: true }),
      ]);
      propertyFaqs = faqResult.data || [];
      propertyImages = imagesResult.data || [];
    }

    // Fetch recent conversation history for context
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('direction, body, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(10);

    const conversationHistory = (recentMessages || [])
      .reverse()
      .filter(m => m.body)
      .map(m => ({
        role: m.direction === 'inbound' ? 'user' as const : 'assistant' as const,
        content: m.body!,
      }));

    // ===== Max AI turns handoff =====
    const maxTurns = aiSettings.max_ai_turns_before_handoff || 8;
    if (handoffTriggers.on_max_turns !== false) {
      const aiTurns = conversationHistory.filter(m => m.role === 'assistant').length;
      if (aiTurns >= maxTurns) {
        console.log(`🤝 Max AI turns reached (${aiTurns}/${maxTurns}), escalating`);
        await supabase.from('conversations').update({
          ai_enabled: false,
          ai_state: 'escalated',
          needs_human: true,
          ai_pause_reason: 'max_turns',
          ai_paused_at: new Date().toISOString(),
        }).eq('id', conversation_id);
        await triggerAssignment(supabase, conversation_id, 'max_turns');
        await supabase.from('ai_interaction_logs').insert({
          tenant_id, conversation_id, contact_id, inbound_message,
          was_escalated: true, escalation_reason: 'max_turns',
        });
        const fallbackText = aiSettings.fallback_message || 'Enseguida te atiende un asesor.';
        const customerMsg = aiSettings.use_customer_name && contact_name
          ? `Hola ${contact_name}. ${fallbackText}`
          : fallbackText;
        return new Response(JSON.stringify({
          action: 'escalate', reason: 'max_turns', message: customerMsg,
          delay_seconds: aiSettings.response_delay_seconds,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Build properties context for AI
    let propertiesContext = '';
    if (properties.length > 0) {
      const propertyDetails = properties.map(p => {
        const faqs = propertyFaqs.filter(f => f.property_id === p.id);
        const faqText = faqs.length > 0
          ? `\n  Preguntas frecuentes:\n${faqs.map(f => `    P: ${f.question}\n    R: ${f.answer}`).join('\n')}`
          : '';
        const creditText = p.accepted_credits?.length ? `Créditos aceptados: ${p.accepted_credits.join(', ')}` : '';
        const maintenanceText = p.maintenance_fee ? `Mantenimiento: $${p.maintenance_fee.toLocaleString()} ${p.currency}/mes` : '';
        const visitText = p.visit_availability || '';
        const aiPromptText = p.ai_prompt ? `\n  Instrucciones especiales: ${p.ai_prompt}` : '';
        
        // Include image info (max 5)
        const uniqueImages = propertyImages
          .filter(img => img.property_id === p.id)
          .filter((img, idx, arr) => arr.findIndex(i => i.file_url === img.file_url) === idx)
          .slice(0, 10);
        const hasPhotos = uniqueImages.length > 0;
        const photosText = hasPhotos 
          ? `\n  Fotos disponibles: Sí (${uniqueImages.length} fotos). Si el cliente pide fotos, responde con el texto [FOTOS:${p.property_code}] en tu mensaje.`
          : '\n  Fotos disponibles: No';
        
        const meta = (p as any).metadata || {};
        const constructionYear = meta.construction_year ?? null;
        const estrato = meta.estrato ?? null;
        const descriptionText = (p as any).description ? `\n  Descripción: ${(p as any).description}` : '';
        const locationUrlText = (p as any).location_url ? `\n  Ubicación (mapa): ${(p as any).location_url}` : '';
        const constructionYearText = constructionYear ? `\n  Año de construcción: ${constructionYear}` : '';
        const estratoText = estrato !== null && estrato !== undefined ? `\n  Estrato: ${estrato}` : '';

        return `- ${p.title} (Código: ${p.property_code})
   Zona: ${p.zone} | Precio: $${p.price.toLocaleString()} ${p.currency} | Tipo: ${p.operation_type}
   Tipo de propiedad: ${p.property_type || 'No especificado'} | Estatus: ${p.status}
   ${p.address ? `Dirección: ${p.address}` : ''}${descriptionText}${locationUrlText}${constructionYearText}${estratoText}
   ${creditText}${maintenanceText ? ` | ${maintenanceText}` : ''}
   ${visitText ? `Disponibilidad de visitas: ${visitText}` : ''}
   ${p.youtube_url ? `Video de YouTube disponible: Sí — Enlace: ${p.youtube_url}` : 'Video de YouTube disponible: No'}${aiPromptText}${photosText}${faqText}`;
      }).join('\n\n');

      propertiesContext = `\nPROPIEDADES DISPONIBLES:\n${propertyDetails}`;
    }

    // Check for escalation triggers first
    const lowerMessage = inbound_message.toLowerCase();
    const humanRequestTriggers = [
      'hablar con persona', 'agente humano', 'representante', 
      'persona real', 'no quiero bot', 'quiero hablar con alguien',
      'asesor', 'ejecutivo'
    ];
    const frustrationTriggers = [
      'esto no sirve', 'no me ayudas', 'eres inutil', 'eres inútil', 'incompetente',
      'urgente', 'es una emergencia', 'llevo horas', 'llevo días', 'llevo dias',
      'estoy enojado', 'estoy enojada', 'estoy molesto', 'estoy molesta',
      'estoy harto', 'estoy harta', 'estoy furioso', 'estoy furiosa',
      'estoy cabreado', 'estoy cabreada', 'qué frustrante', 'que frustrante',
      'me tienen harto', 'me tienen harta', 'esto es ridículo', 'esto es ridiculo',
      'pésimo servicio', 'pesimo servicio', 'mal servicio', 'una vergüenza', 'una verguenza',
      'no me sirve', 'estoy frustrado', 'estoy frustrada', 'no entiendes nada',
      'coño', 'joder', 'mierda', 'estafa', 'estafadores'
    ];
    const humanRequestExtras = [
      'hablar con humano', 'hablar con un humano', 'una persona', 'con una persona',
      'eres una maquina', 'eres una máquina', 'eres un bot', 'eres robot',
      'quiero un humano', 'pasame con', 'pásame con', 'comunicame con', 'comunícame con',
      'me atienda alguien', 'que me atienda', 'alguien que me atienda'
    ];
    humanRequestTriggers.push(...humanRequestExtras);

    // Check if customer wants human
    if (aiSettings.escalate_on_human_request) {
      const wantsHuman = humanRequestTriggers.some(t => lowerMessage.includes(t));
      if (wantsHuman) {
        console.log('Customer requested human, escalating');
        
        await supabase
          .from('conversations')
          .update({
            ai_enabled: false,
            ai_state: 'escalated',
            needs_human: true,
            ai_pause_reason: 'human_request',
            ai_paused_at: new Date().toISOString()
          })
          .eq('id', conversation_id);
      await triggerAssignment(supabase, conversation_id, 'human_request');

        await supabase.from('ai_interaction_logs').insert({
          tenant_id,
          conversation_id,
          contact_id,
          inbound_message,
          was_escalated: true,
          escalation_reason: 'human_request',
        });

        const fallbackText = aiSettings.fallback_message || 'Enseguida te atiende un asesor.';
        const customerMessage = aiSettings.use_customer_name && contact_name
          ? `Hola ${contact_name}. ${fallbackText}`
          : fallbackText;

        return new Response(JSON.stringify({
          action: 'escalate',
          reason: 'human_request',
          message: customerMessage,
          delay_seconds: aiSettings.response_delay_seconds,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check for frustration
    if (aiSettings.escalate_on_frustration) {
      const isFrustrated = frustrationTriggers.some(t => lowerMessage.includes(t));
      if (isFrustrated) {
        console.log('Frustration detected, escalating');
        
        await supabase
          .from('conversations')
          .update({
            ai_enabled: false,
            ai_state: 'escalated',
            needs_human: true,
            ai_pause_reason: 'frustration',
            ai_paused_at: new Date().toISOString()
          })
          .eq('id', conversation_id);
      await triggerAssignment(supabase, conversation_id, 'frustration');

        await supabase.from('ai_interaction_logs').insert({
          tenant_id,
          conversation_id,
          contact_id,
          inbound_message,
          was_escalated: true,
          escalation_reason: 'frustration_detected',
        });

        const fallbackText = aiSettings.fallback_message || 'Enseguida te atiende un asesor.';
        const customerMessage = aiSettings.use_customer_name && contact_name
          ? `Hola ${contact_name}. ${fallbackText}`
          : fallbackText;

        return new Response(JSON.stringify({
          action: 'escalate',
          reason: 'frustration',
          message: customerMessage,
          delay_seconds: aiSettings.response_delay_seconds,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Check for visit/appointment request — escalate immediately without AI response
    const visitTriggers = [
      'agendar visita', 'agendar cita', 'agendar una visita', 'agendar una cita',
      'quiero visitar', 'quiero ver el', 'quiero ver la', 'quiero conocer el', 'quiero conocer la',
      'puedo ir a ver', 'puedo visitarla', 'puedo visitarlo', 'puedo verla', 'puedo verlo',
      'ir a verla', 'ir a verlo', 'ir a conocer',
      'espacio para ver', 'espacio para visitar',
      'visitar el inmueble', 'visitar la propiedad', 'visitar la casa', 'visitar el depa',
      'ver el inmueble', 'ver la propiedad', 'ver la casa', 'ver el departamento',
      'conocer el inmueble', 'conocer la propiedad', 'conocer la casa',
      'tendrias espacio', 'tendrías espacio', 'tendrian espacio', 'tendrían espacio',
      'tienen espacio', 'tienen disponibilidad',
      'cuando puedo ir', 'cuándo puedo ir', 'cuando puedo pasar', 'cuándo puedo pasar',
      'me gustaria visitarla', 'me gustaría visitarla', 'me gustaria verla', 'me gustaría verla',
      'horario para visita', 'horario para ver',
      'dia para visitar', 'día para visitar', 'dia para ver', 'día para ver',
      'podemos agendar', 'podríamos agendar', 'podriamos agendar',
      'hacer una cita', 'programar una visita', 'programar visita',
      'quiero ir a ver', 'quisiera visitar', 'quisiera ver',
    ];
    const wantsVisit = visitTriggers.some(t => lowerMessage.includes(t));
    if (wantsVisit) {
      console.log('🏠 Visit request detected pre-AI, escalating immediately');
      
      await supabase
        .from('conversations')
        .update({
          ai_enabled: false,
          ai_state: 'escalated',
          needs_human: true,
          ai_pause_reason: 'visit_request',
          ai_paused_at: new Date().toISOString()
        })
        .eq('id', conversation_id);
      await triggerAssignment(supabase, conversation_id, 'visit_request');

      await supabase.from('ai_interaction_logs').insert({
        tenant_id,
        conversation_id,
        contact_id,
        inbound_message,
        was_escalated: true,
        escalation_reason: 'visit_request',
        wallet_debited: false,
      });

      const visitMessage = aiSettings.use_customer_name && contact_name
        ? `¡Con gusto, ${contact_name}! Un asesor se pondrá en contacto contigo en breve para coordinar tu visita. 🏠`
        : '¡Con gusto! Un asesor se pondrá en contacto contigo en breve para coordinar tu visita. 🏠';

      return new Response(JSON.stringify({
        action: 'escalate',
        reason: 'visit_request',
        message: visitMessage,
        delay_seconds: aiSettings.response_delay_seconds,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the AI prompt
    const toneInstructions = {
      cordial: 'Sé amable y respetuoso en todo momento.',
      professional: 'Mantén un tono profesional y directo.',
      friendly: 'Sé casual y cercano, como si hablaras con un amigo.',
      adaptive: 'Adapta tu tono al estilo del cliente.',
    };

    const emojiInstruction = aiSettings.use_emojis 
      ? `Puedes usar hasta ${aiSettings.max_emojis_per_message} emoji(s) por mensaje. NUNCA superes ese límite.`
      : 'PROHIBIDO usar emojis. No incluyas ningún emoji en tu respuesta bajo ninguna circunstancia.';

    const nameInstruction = aiSettings.use_customer_name && contact_name
      ? `El nombre del cliente es ${contact_name}. Úsalo cuando sea natural.`
      : '';

    const identityInstruction = aiSettings.never_reveal_ai
      ? 'NUNCA reveles que eres una IA o asistente virtual. Siempre actúa como un asistente humano.'
      : '';

    const knowledgeContext = knowledgeBase.length > 0
      ? `BASE DE CONOCIMIENTO GENERAL:\n${knowledgeBase.map(e => `Q: ${e.question}\nA: ${e.answer}`).join('\n\n')}`
      : '';

    const behaviorInstruction = aiSettings.behavior_prompt 
      ? `\nCOMPORTAMIENTO DEL NEGOCIO:\n${aiSettings.behavior_prompt}`
      : '';

    // Regional context block
    const regionInfo = REGION_CONTEXT[(aiSettings.region_code || 'MX').toUpperCase()] || REGION_CONTEXT.MX;
    const formalityInstr = FORMALITY_TEXT[aiSettings.formality || 'tu'] || FORMALITY_TEXT.tu;
    const languageInstr = LANGUAGE_TEXT[aiSettings.language || 'es'] || LANGUAGE_TEXT.es;
    const maxLen = aiSettings.max_message_length || 320;
    const regionalBlock = `\nCONTEXTO REGIONAL (OBLIGATORIO):
- País del cliente: ${regionInfo.country}
- Moneda local: ${regionInfo.currency}
- ${regionInfo.modismos}
- ${formalityInstr}
- ${languageInstr}
- LONGITUD MÁXIMA: cada mensaje debe tener máximo ${maxLen} caracteres. Sé breve, claro y directo.`;

    const systemPrompt = `Eres ${aiSettings.agent_name}, asistente de ${aiSettings.company_name || 'la empresa'}.
${regionalBlock}

REGLA CRÍTICA: NUNCA inventes, supongas o alucines información que no esté EXACTAMENTE en los datos proporcionados abajo. Si un dato no aparece explícitamente (como metros cuadrados, número de recámaras, precio, amenidades), NO lo menciones. Solo comparte la información que aparece textualmente en este prompt.

INSTRUCCIONES:
- ${toneInstructions[aiSettings.tone as keyof typeof toneInstructions] || toneInstructions.professional}
- ${emojiInstruction}
- ${nameInstruction}
- ${identityInstruction}
- Responde ÚNICAMENTE con información que aparezca textualmente en la BASE DE CONOCIMIENTO o en las PROPIEDADES DISPONIBLES de este prompt.
- Si el cliente pregunta por una propiedad, busca en PROPIEDADES DISPONIBLES. Si la propiedad tiene un campo "Instrucciones especiales" o "ai_prompt", usa ESA información como la descripción principal de la propiedad.
- NUNCA inventes características, precios, medidas o amenidades que no estén en los datos.
- Si no encuentras la respuesta exacta en los datos proporcionados, responde con la frase exacta: "[ESCALAR]"
- FOTOS DE PROPIEDADES: Si el cliente pide fotos/imágenes de una propiedad y la propiedad tiene "Fotos disponibles: Sí", incluye el marcador [FOTOS:CÓDIGO_PROPIEDAD] en tu respuesta (ejemplo: [FOTOS:RVTMYA-EMX-0001]). Si NO tiene fotos, indica que por el momento no tienes fotos disponibles pero puedes agendar una visita. NUNCA incluyas el marcador [FOTOS:...] si la propiedad no tiene fotos.
- VIDEOS DE PROPIEDADES: Si el cliente pregunta por videos de una propiedad y la propiedad tiene un campo "Video" con un enlace de YouTube, DEBES compartir ese enlace al cliente. Ejemplo: "¡Claro! Aquí tienes el video de la propiedad: [URL del video]". Si NO tiene video, indica que por el momento no cuentas con video pero ofrece enviar fotos (si las tiene) o agendar una visita.
- DETECCIÓN DE PROPIEDAD DE INTERÉS (OBLIGATORIO): SIEMPRE que tu respuesta mencione, describa o proporcione información sobre una propiedad específica, DEBES incluir el marcador [PROPIEDAD_INTERES:CÓDIGO_PROPIEDAD] al final de tu mensaje. Esto es OBLIGATORIO sin excepción. Ejemplos de cuándo incluirlo: el cliente pregunta por una propiedad, tú describes una propiedad, envías fotos de una propiedad, compartes precio/ubicación de una propiedad. Si mencionas varias propiedades, usa el código de la propiedad principal de la conversación.
- Mantén las respuestas concisas y útiles.
- Zona horaria: ${aiSettings.timezone}

REGLAS DE HANDOFF A ASESOR HUMANO:
Cuando se cumpla CUALQUIERA de estas condiciones, DEBES incluir el marcador [SEGUIMIENTO_HUMANO] al final de tu respuesta:

1. **VISITA SOLICITADA**: Si el cliente indica que quiere visitar una propiedad, agendar una cita, o ver un inmueble en persona:
   - Pídele su NOMBRE COMPLETO si no lo tienes.
   - Confirma la propiedad de interés.
   - Dile: "En breve un asesor se pondrá en contacto contigo para coordinar los detalles de tu visita."
   - Incluye [SEGUIMIENTO_HUMANO] al final.

2. **INFORMACIÓN DE CRÉDITO/FINANCIERA RECOPILADA**: Si ya tienes información suficiente del cliente sobre su situación crediticia (tipo de crédito, presupuesto, enganche, ingresos) o si el cliente necesita una evaluación crediticia personalizada:
   - Agradece la información proporcionada.
   - Dile: "Con esta información, un asesor especializado se pondrá en contacto contigo para darte una atención personalizada."
   - Incluye [SEGUIMIENTO_HUMANO] al final.

3. **NEGOCIACIÓN DE PRECIO**: Si el cliente quiere negociar precio, descuentos o condiciones especiales:
   - Dile: "Ese tema lo maneja directamente nuestro equipo comercial. Un asesor se pondrá en contacto contigo en breve."
   - Incluye [SEGUIMIENTO_HUMANO] al final.

IMPORTANTE: Los marcadores [SEGUIMIENTO_HUMANO], [FOTOS:...] y [PROPIEDAD_INTERES:...] NO deben ser visibles para el cliente. Solo inclúyelos al final de tu mensaje como instrucciones internas.
${behaviorInstruction}

${knowledgeContext}
${propertiesContext}`;

    // Call Lovable AI with retry logic
    let generatedText = '';
    let aiCallSuccess = false;
    
    for (let attempt = 0; attempt <= CONFIG.AI_MAX_RETRIES; attempt++) {
      try {
        console.log(`🤖 AI API call attempt ${attempt + 1}...`);
        
        const aiResponse = await withTimeout(
          fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${lovableApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'google/gemini-2.5-flash',
              messages: [
                { role: 'system', content: systemPrompt },
                ...conversationHistory,
                { role: 'user', content: inbound_message }
              ],
            }),
          }),
          CONFIG.AI_API_TIMEOUT_MS,
          'AI API request timed out'
        );

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI Gateway error (attempt ${attempt + 1}):`, aiResponse.status, errorText);
          
          if (aiResponse.status === 429) {
            // Rate limit - wait longer before retry
            if (attempt < CONFIG.AI_MAX_RETRIES) {
              await delay(CONFIG.AI_RETRY_DELAY_MS * 4);
              continue;
            }
            
            return new Response(JSON.stringify({ 
              action: 'error',
              error: 'rate_limit',
              message: 'Límite de solicitudes excedido' 
            }), {
              status: 429,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
          }
          
          throw new Error(`AI Gateway error: ${aiResponse.status}`);
        }

        const aiData = await aiResponse.json();
        generatedText = aiData.choices?.[0]?.message?.content || '';
        aiCallSuccess = true;
        console.log('✅ AI Response received:', generatedText.substring(0, 100) + '...');
        break;
        
      } catch (aiError) {
        console.warn(`⚠️ AI call attempt ${attempt + 1} failed:`, aiError);
        
        if (attempt < CONFIG.AI_MAX_RETRIES) {
          const backoff = CONFIG.AI_RETRY_DELAY_MS * Math.pow(2, attempt);
          console.log(`⏳ Retrying AI call in ${backoff}ms...`);
          await delay(backoff);
        }
      }
    }

    // If AI call failed after retries
    if (!aiCallSuccess) {
      console.error('❌ AI call failed after all retries');
      
      // Mark as error and needs_human
      await supabase
        .from('conversations')
        .update({
          ai_enabled: false,
          ai_state: 'paused',
          needs_human: true,
          ai_pause_reason: 'error',
          ai_paused_at: new Date().toISOString()
        })
        .eq('id', conversation_id);
      await triggerAssignment(supabase, conversation_id, 'ai_error');

      await supabase.from('ai_interaction_logs').insert({
        tenant_id,
        conversation_id,
        contact_id,
        inbound_message,
        was_escalated: true,
        escalation_reason: 'ai_api_error',
        wallet_debited: false,
      });

      return new Response(JSON.stringify({ 
        action: 'error',
        error: 'AI API failed after retries'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const responseTime = Date.now() - startTime;
    console.log(`AI processing completed in ${responseTime}ms`);

    // Check if AI indicated it couldn't find an answer
    if (generatedText.includes('[ESCALAR]') && aiSettings.escalate_on_no_answer) {
      console.log('AI could not find answer, escalating');
      
      // Update conversation state for handoff
      await supabase
        .from('conversations')
        .update({
          ai_enabled: false,
          ai_state: 'escalated',
          needs_human: true,
          ai_pause_reason: 'no_answer',
          ai_paused_at: new Date().toISOString()
        })
        .eq('id', conversation_id);
      await triggerAssignment(supabase, conversation_id, 'no_answer');

      await supabase.from('ai_interaction_logs').insert({
        tenant_id,
        conversation_id,
        contact_id,
        inbound_message,
        ai_response: generatedText,
        was_escalated: true,
        escalation_reason: 'no_knowledge_match',
        response_time_ms: responseTime,
      });

      // Return an escalation signal BUT with a user-facing message from settings
      const fallbackText = aiSettings.fallback_message || 'Enseguida te atiende un asesor.';
      const customerMessage = aiSettings.use_customer_name && contact_name
        ? `Hola ${contact_name}. ${fallbackText}`
        : fallbackText;

      return new Response(JSON.stringify({
        action: 'escalate',
        reason: 'no_answer',
        message: customerMessage,
        delay_seconds: aiSettings.response_delay_seconds,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for [SEGUIMIENTO_HUMANO] marker — AI determined handoff is needed
    const needsHandoff = generatedText.includes('[SEGUIMIENTO_HUMANO]');

    // Parse [FOTOS:CODE] markers and extract image URLs
    const fotosMatch = generatedText.match(/\[FOTOS:([^\]]+)\]/);
    let mediaUrls: string[] = [];
    let cleanResponse = generatedText;
    
    if (fotosMatch) {
      const propertyCode = fotosMatch[1];
      const matchedProperty = properties.find(p => p.property_code === propertyCode);
      if (matchedProperty) {
        const images = propertyImages
          .filter(img => img.property_id === matchedProperty.id)
          .filter((img, idx, arr) => arr.findIndex(i => i.file_url === img.file_url) === idx)
          .slice(0, 10);
        mediaUrls = images.map(img => img.file_url);
      }
      cleanResponse = cleanResponse.replace(/\[FOTOS:[^\]]+\]/g, '').trim();
    }

    // Parse [PROPIEDAD_INTERES:CODE] marker and auto-assign property to contact
    const propInteresMatch = generatedText.match(/\[PROPIEDAD_INTERES:([^\]]+)\]/);
    let propertyAssigned = false;
    if (propInteresMatch && contact_id) {
      const propertyCode = propInteresMatch[1].trim();
      const matchedProperty = properties.find(p => p.property_code === propertyCode);
      if (matchedProperty) {
        console.log(`🏠 Auto-assigning property ${propertyCode} (${matchedProperty.id}) to contact ${contact_id}`);
        await supabase
          .from('contacts')
          .update({ re_property_interest_id: matchedProperty.id })
          .eq('id', contact_id);
        propertyAssigned = true;
      }
      cleanResponse = cleanResponse.replace(/\[PROPIEDAD_INTERES:[^\]]+\]/g, '').trim();
    }

    // Fallback: if AI didn't include [PROPIEDAD_INTERES:...] marker, scan the response for known property codes
    if (!propertyAssigned && contact_id && properties.length > 0) {
      for (const prop of properties) {
        if (generatedText.includes(prop.property_code)) {
          console.log(`🏠 Fallback: detected property code ${prop.property_code} in AI response, assigning to contact ${contact_id}`);
          await supabase
            .from('contacts')
            .update({ re_property_interest_id: prop.id })
            .eq('id', contact_id);
          break;
        }
      }
    }

    // Remove internal markers from response
    cleanResponse = cleanResponse.replace(/\[SEGUIMIENTO_HUMANO\]/g, '').trim();

    // Enforce style settings post-LLM
    if (!aiSettings.use_emojis) {
      cleanResponse = stripEmojis(cleanResponse);
    }
    cleanResponse = enforceMaxLength(cleanResponse, aiSettings.max_message_length || 320);

    // If handoff is needed, send the AI's final message AND escalate
    if (needsHandoff) {
      console.log('🤝 AI triggered human handoff via [SEGUIMIENTO_HUMANO]');
      
      await supabase
        .from('conversations')
        .update({
          ai_enabled: false,
          ai_state: 'escalated',
          needs_human: true,
          ai_pause_reason: 'qualification_complete',
          ai_paused_at: new Date().toISOString()
        })
        .eq('id', conversation_id);
      await triggerAssignment(supabase, conversation_id, 'qualification_handoff');

      await supabase.from('ai_interaction_logs').insert({
        tenant_id,
        conversation_id,
        contact_id,
        inbound_message,
        ai_response: generatedText,
        was_escalated: true,
        escalation_reason: 'qualification_handoff',
        response_time_ms: responseTime,
      });

      // Return the AI's composed farewell message (not the fallback)
      return new Response(JSON.stringify({
        action: 'escalate',
        reason: 'qualification_handoff',
        message: cleanResponse,
        media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
        delay_seconds: aiSettings.response_delay_seconds,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Log successful AI response
    await supabase.from('ai_interaction_logs').insert({
      tenant_id,
      conversation_id,
      contact_id,
      inbound_message,
      ai_response: generatedText,
      was_escalated: false,
      response_time_ms: responseTime,
    });

    return new Response(JSON.stringify({
      action: 'respond',
      response: cleanResponse,
      media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
      delay_seconds: aiSettings.response_delay_seconds,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(`AI Chat Error after ${totalTime}ms:`, error);
    return new Response(JSON.stringify({ 
      action: 'error',
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
