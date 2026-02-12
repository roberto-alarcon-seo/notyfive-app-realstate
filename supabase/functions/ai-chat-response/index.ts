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
}

interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
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
          .insert({
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
          })
          .select()
          .single();

        if (createError) {
          console.error('Error creating AI settings:', createError);
          return new Response(JSON.stringify({ 
            action: 'error',
            reason: 'settings_creation_failed' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        settings = newSettings as AISettings;
        console.log('Created default AI settings for tenant');
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
      .select('id, title, property_code, zone, price, currency, operation_type, property_type, status, address, accepted_credits, maintenance_fee, ai_prompt, visit_availability, youtube_url')
      .eq('tenant_id', tenant_id)
      .eq('is_active', true);

    const properties = propertiesData || [];

    // Get FAQs for all active properties
    let propertyFaqs: { property_id: string; question: string; answer: string }[] = [];
    if (properties.length > 0) {
      const propertyIds = properties.map(p => p.id);
      const { data: faqData } = await supabase
        .from('property_faq')
        .select('property_id, question, answer')
        .in('property_id', propertyIds)
        .order('sort_order', { ascending: true });
      propertyFaqs = faqData || [];
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
        
        return `- ${p.title} (Código: ${p.property_code})
  Zona: ${p.zone} | Precio: $${p.price.toLocaleString()} ${p.currency} | Tipo: ${p.operation_type}
  Tipo de propiedad: ${p.property_type || 'No especificado'} | Estatus: ${p.status}
  ${p.address ? `Dirección: ${p.address}` : ''}
  ${creditText}${maintenanceText ? ` | ${maintenanceText}` : ''}
  ${visitText ? `Disponibilidad de visitas: ${visitText}` : ''}
  ${p.youtube_url ? `Video: ${p.youtube_url}` : ''}${aiPromptText}${faqText}`;
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
      'esto no sirve', 'no me ayudas', 'eres inutil', 'incompetente',
      'urgente', 'es una emergencia', 'llevo horas', 'llevo días'
    ];

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

    // Build the AI prompt
    const toneInstructions = {
      cordial: 'Sé amable y respetuoso en todo momento.',
      professional: 'Mantén un tono profesional y directo.',
      friendly: 'Sé casual y cercano, como si hablaras con un amigo.',
      adaptive: 'Adapta tu tono al estilo del cliente.',
    };

    const emojiInstruction = aiSettings.use_emojis 
      ? `Puedes usar hasta ${aiSettings.max_emojis_per_message} emoji(s) por mensaje.`
      : 'No uses emojis.';

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

    const systemPrompt = `Eres ${aiSettings.agent_name}, asistente de ${aiSettings.company_name || 'la empresa'}.

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
- Mantén las respuestas concisas y útiles.
- Zona horaria: ${aiSettings.timezone}
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
      response: generatedText,
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
