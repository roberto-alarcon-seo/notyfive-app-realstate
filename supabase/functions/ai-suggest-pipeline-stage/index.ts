import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PIPELINE_STAGES = [
  { value: 'new_lead', label: 'Nuevo lead', signals: ['primer contacto', 'hola', 'información'] },
  { value: 'interest_confirmed', label: 'Interés confirmado', signals: ['me interesa', 'quiero saber más', 'precio', 'ubicación', 'fotos'] },
  { value: 'financial_validation', label: 'Validación financiera', signals: ['crédito', 'infonavit', 'cofinavit', 'banco', 'enganche', 'presupuesto', 'mensualidad', 'financiamiento'] },
  { value: 'searching', label: 'En búsqueda activa', signals: ['otra opción', 'más propiedades', 'comparar', 'diferentes zonas'] },
  { value: 'visit_done', label: 'Visita realizada', signals: ['ya fui', 'visité', 'vi la propiedad', 'me gustó la casa', 'fui a ver'] },
  { value: 'follow_up', label: 'Seguimiento', signals: ['lo voy a pensar', 'después te confirmo', 'necesito consultarlo'] },
  { value: 'negotiation', label: 'Oferta / Negociación', signals: ['oferta', 'apartado', 'contrato', 'escrituras', 'firma', 'negociar'] },
  { value: 'closed_won', label: 'Cerrado ganado', signals: ['compré', 'firmé', 'escrituré', 'ya es mía'] },
  { value: 'closed_lost', label: 'Perdido', signals: ['no me interesa', 'ya no', 'compré en otro lado', 'ya no busco'] },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, conversation_id, contact_id } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ action: 'skip', reason: 'no_api_key' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current contact pipeline stage
    const { data: contact } = await supabase
      .from('contacts')
      .select('pipeline_stage, name')
      .eq('id', contact_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({ action: 'skip', reason: 'no_contact' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if there's already a pending suggestion for this conversation
    const { data: existingSuggestion } = await supabase
      .from('pipeline_stage_suggestions')
      .select('id, suggested_stage')
      .eq('conversation_id', conversation_id)
      .eq('status', 'pending')
      .maybeSingle();

    // Get recent messages for analysis
    const { data: messages } = await supabase
      .from('messages')
      .select('direction, body, created_at')
      .eq('conversation_id', conversation_id)
      .order('created_at', { ascending: false })
      .limit(15);

    if (!messages || messages.length < 2) {
      return new Response(JSON.stringify({ action: 'skip', reason: 'insufficient_messages' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const conversationText = messages
      .reverse()
      .filter(m => m.body)
      .map(m => `${m.direction === 'inbound' ? 'CLIENTE' : 'ASESOR'}: ${m.body}`)
      .join('\n');

    const stagesDescription = PIPELINE_STAGES.map(s => 
      `- ${s.value}: ${s.label}`
    ).join('\n');

    const systemPrompt = `Eres un analista experto en ventas inmobiliarias. Tu tarea es analizar una conversación de WhatsApp entre un asesor y un cliente potencial, y determinar en qué etapa del pipeline de ventas se encuentra el cliente.

ETAPAS DEL PIPELINE (en orden de avance):
${stagesDescription}

ETAPA ACTUAL DEL CLIENTE: ${contact.pipeline_stage}

REGLAS:
1. Solo sugiere un cambio de etapa si hay evidencia CLARA en la conversación de que el cliente ha avanzado (o retrocedido).
2. No sugieras la misma etapa en la que ya se encuentra.
3. Sé conservador: es mejor NO sugerir un cambio que sugerir uno incorrecto.
4. Analiza los mensajes del CLIENTE, no los del asesor.
5. Responde ÚNICAMENTE con una llamada a la función suggest_stage_change.
6. Si no hay evidencia suficiente para cambiar de etapa, usa should_change: false.

SEÑALES CLAVE:
- new_lead → interest_confirmed: El cliente pregunta por precios, ubicación, fotos, detalles de una propiedad específica.
- interest_confirmed → financial_validation: El cliente menciona crédito, presupuesto, enganche, tipo de financiamiento.
- financial_validation → searching: El cliente pide ver más opciones, comparar propiedades.
- searching → visit_done: El cliente confirma que visitó o quiere agendar visita.
- visit_done → follow_up: El cliente dice que lo va a pensar, necesita consultarlo.
- follow_up → negotiation: El cliente hace oferta, pregunta por apartado, contrato.
- negotiation → closed_won: El cliente confirma la compra.
- Cualquier etapa → closed_lost: El cliente rechaza, ya compró en otro lado, no le interesa.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analiza esta conversación y determina si el cliente debería cambiar de etapa:\n\n${conversationText}` },
        ],
        tools: [{
          type: 'function',
          function: {
            name: 'suggest_stage_change',
            description: 'Suggest a pipeline stage change based on conversation analysis',
            parameters: {
              type: 'object',
              properties: {
                should_change: { type: 'boolean', description: 'Whether a stage change is recommended' },
                suggested_stage: { 
                  type: 'string', 
                  enum: PIPELINE_STAGES.map(s => s.value),
                  description: 'The suggested new pipeline stage' 
                },
                confidence: { type: 'number', description: 'Confidence score from 0.0 to 1.0' },
                reasoning: { type: 'string', description: 'Brief explanation in Spanish of why this change is suggested (max 100 chars)' },
              },
              required: ['should_change', 'suggested_stage', 'confidence', 'reasoning'],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: 'function', function: { name: 'suggest_stage_change' } },
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI gateway error:', aiResponse.status);
      return new Response(JSON.stringify({ action: 'error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ action: 'skip', reason: 'no_tool_call' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const suggestion = JSON.parse(toolCall.function.arguments);
    console.log('AI Pipeline Suggestion:', suggestion);

    if (!suggestion.should_change || suggestion.suggested_stage === contact.pipeline_stage || suggestion.confidence < 0.6) {
      // If there's an existing suggestion that's now outdated, dismiss it
      if (existingSuggestion) {
        await supabase
          .from('pipeline_stage_suggestions')
          .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
          .eq('id', existingSuggestion.id);
      }
      return new Response(JSON.stringify({ action: 'no_change' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If there's already a pending suggestion with the same stage, skip
    if (existingSuggestion?.suggested_stage === suggestion.suggested_stage) {
      return new Response(JSON.stringify({ action: 'already_suggested' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Dismiss old suggestion if different stage
    if (existingSuggestion) {
      await supabase
        .from('pipeline_stage_suggestions')
        .update({ status: 'dismissed', resolved_at: new Date().toISOString() })
        .eq('id', existingSuggestion.id);
    }

    // Insert new suggestion
    const { data: newSuggestion, error: insertError } = await supabase
      .from('pipeline_stage_suggestions')
      .insert({
        tenant_id,
        conversation_id,
        contact_id,
        current_stage: contact.pipeline_stage,
        suggested_stage: suggestion.suggested_stage,
        confidence: Math.min(suggestion.confidence, 0.99),
        reasoning: suggestion.reasoning?.substring(0, 200) || 'Análisis de conversación',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting suggestion:', insertError);
      return new Response(JSON.stringify({ action: 'error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      action: 'suggested',
      suggestion: newSuggestion,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Pipeline suggestion error:', error);
    return new Response(JSON.stringify({ action: 'error', error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
