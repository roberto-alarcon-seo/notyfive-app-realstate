import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CampaignContext {
  objective?: string;
  clientType?: string;
  timePeriod?: string;
  promotionType?: string;
  tone?: string;
  urgency?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenant_id, messages, context } = await req.json();

    console.log('AI Campaign Copilot Request:', { tenant_id, context });

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');

    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get tenant's AI settings for tone preferences
    const { data: aiSettings } = await supabase
      .from('tenant_ai_settings')
      .select('tone, use_emojis, max_emojis_per_message')
      .eq('tenant_id', tenant_id)
      .single();

    // Fetch contacts for analysis
    const { data: contacts, count: totalContacts } = await supabase
      .from('contacts')
      .select('id, name, email, phone, country, tags, status, created_at', { count: 'exact' })
      .eq('tenant_id', tenant_id)
      .eq('status', 'active');

    // Fetch custom fields
    const { data: customFields } = await supabase
      .from('contact_custom_fields')
      .select('id, key, name, data_type')
      .eq('tenant_id', tenant_id);

    // Fetch custom field values to get actual counts
    const { data: customFieldValues } = await supabase
      .from('contact_custom_field_values')
      .select('field_id, value_text, contact_id')
      .in('field_id', (customFields || []).map(f => f.id));

    // Build field value statistics
    const fieldStats: Record<string, Record<string, number>> = {};
    if (customFieldValues && customFields) {
      for (const cfv of customFieldValues) {
        const field = customFields.find(f => f.id === cfv.field_id);
        if (field && cfv.value_text) {
          if (!fieldStats[field.key]) {
            fieldStats[field.key] = {};
          }
          const value = cfv.value_text.toLowerCase();
          fieldStats[field.key][value] = (fieldStats[field.key][value] || 0) + 1;
        }
      }
    }

    // Fetch existing segments
    const { data: segments } = await supabase
      .from('segments')
      .select('id, name, description, type, rules_json')
      .eq('tenant_id', tenant_id)
      .eq('status', 'active');

    // Fetch approved templates
    const { data: templates } = await supabase
      .from('templates')
      .select('id, name, category, body, variables, approval_status')
      .eq('tenant_id', tenant_id)
      .eq('approval_status', 'approved');

    // Fetch recent campaigns for context
    const { data: recentCampaigns } = await supabase
      .from('campaigns')
      .select('id, name, status, sent_count, delivered_count, created_at')
      .eq('tenant_id', tenant_id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Build list of ALL available fields for segmentation
    const baseContactFields = [
      { key: 'name', name: 'Nombre', type: 'text' },
      { key: 'email', name: 'Email', type: 'text' },
      { key: 'phone', name: 'Teléfono', type: 'text' },
      { key: 'country', name: 'País', type: 'text' },
      { key: 'tags', name: 'Etiquetas', type: 'array' },
      { key: 'status', name: 'Estado', type: 'enum', values: ['active', 'archived', 'deleted'] },
      { key: 'created_at', name: 'Fecha de creación', type: 'datetime' },
    ];

    const allAvailableFields = [
      ...baseContactFields,
      ...(customFields || []).map(f => ({ key: f.key, name: f.name, type: f.data_type }))
    ];

    // Build data context for AI with REAL counts
    const fieldStatsDisplay = Object.entries(fieldStats)
      .map(([fieldKey, values]) => {
        const valuesStr = Object.entries(values)
          .map(([val, count]) => `"${val}": ${count} contactos`)
          .join(', ');
        return `  ${fieldKey}: { ${valuesStr} }`;
      })
      .join('\n');

    const dataContext = `
=== DATOS REALES DEL TENANT ===
- Total de contactos activos: ${totalContacts || 0}
- Segmentos existentes: ${segments?.length || 0}
- Plantillas aprobadas: ${templates?.length || 0}

=== ESTADÍSTICAS REALES DE CAMPOS PERSONALIZADOS ===
${fieldStatsDisplay || 'Sin datos de campos personalizados'}

=== CAMPOS DISPONIBLES PARA SEGMENTACIÓN ===
SOLO puedes usar estos campos en las reglas de segmentos:

CAMPOS BASE:
${baseContactFields.map(f => `- ${f.key} (${f.name}, tipo: ${f.type})`).join('\n')}

CAMPOS PERSONALIZADOS DEL TENANT:
${customFields && customFields.length > 0 
  ? customFields.map(f => `- ${f.key} (${f.name}, tipo: ${f.data_type})`).join('\n') 
  : '⚠️ NO HAY CAMPOS PERSONALIZADOS CONFIGURADOS - NO INVENTES CAMPOS'}

=== REGLA CRÍTICA ===
- USA LOS CONTEOS REALES de "ESTADÍSTICAS REALES DE CAMPOS PERSONALIZADOS" para estimatedCount
- NUNCA inventes números, usa los datos reales
- Si el usuario menciona un criterio y existe el campo, usa el conteo real

SEGMENTOS EXISTENTES:
${segments?.map(s => `- ${s.name}: ${s.description || ''}`).join('\n') || 'Ninguno'}

PLANTILLAS APROBADAS:
${templates?.map(t => `- ${t.name} (${t.category})`).join('\n') || 'Ninguna'}`;

    // Build conversation history
    const conversationHistory = messages || [];
    const messageCount = conversationHistory.filter((m: Message) => m.role === 'user').length;

    // Determine context completeness - NEED MORE INFO before generating proposal
    const hasObjective = context?.objective;
    const hasClientType = context?.clientType;
    const hasPromotion = context?.promotionType || context?.promotionDetails;
    
    // Only generate proposal when we have enough info OR user explicitly asks
    const userAsksForProposal = conversationHistory.some((m: Message) => 
      m.role === 'user' && (
        m.content.toLowerCase().includes('genera') ||
        m.content.toLowerCase().includes('propuesta') ||
        m.content.toLowerCase().includes('crea la') ||
        m.content.toLowerCase().includes('hazlo')
      )
    );
    
    const contextComplete = hasObjective && hasClientType && hasPromotion;
    const shouldGenerateProposal = contextComplete || messageCount >= 4 || userAsksForProposal;

    // Check if this is a copy adjustment request
    const lastUserMessage = conversationHistory.length > 0 
      ? conversationHistory[conversationHistory.length - 1]?.content?.toLowerCase() || ''
      : '';
    const isCopyAdjustment = lastUserMessage.includes('ajust') || 
      lastUserMessage.includes('mejor') ||
      lastUserMessage.includes('más corto') ||
      lastUserMessage.includes('más largo') ||
      lastUserMessage.includes('más agresivo') ||
      lastUserMessage.includes('tono') ||
      lastUserMessage.includes('variante') ||
      lastUserMessage.includes('cambia el') ||
      lastUserMessage.includes('modifica');

    const systemPrompt = `Eres un copiloto de campañas de WhatsApp. Tu interfaz tiene DOS paneles:
- Panel IZQUIERDO: Chat conversacional (donde responderás)
- Panel DERECHO: Constructor de campaña (donde el usuario ve segmentos y copys)

=== REGLA ABSOLUTA DE CANALES DE SALIDA ===

El chat es SOLO un canal de coordinación. NUNCA debes mostrar en el chat:
- Copys completos o parciales
- Variantes de copys
- Segmentos con sus reglas
- JSON o estructuras técnicas
- Explicaciones detalladas de contenido

=== BLOQUEO DE ECHO ===
Si un copy ya existe en el panel derecho, NUNCA lo repitas en el chat bajo ninguna circunstancia.

=== MENSAJES PERMITIDOS EN CHAT ===
✓ "¡Entendido! ¿A qué tipo de clientes quieres llegar?"
✓ "Perfecto 🎯 Ya preparé una propuesta en el panel derecho"
✓ "Listo 👍 Actualicé el copy con un tono más directo."
✓ "Ya dejé una versión más corta en el panel derecho."
✓ "¿Quieres ajustar algo más?"

=== MENSAJES PROHIBIDOS ===
✗ Listar segmentos con detalles
✗ Mostrar copys completos o parciales
✗ Mostrar variantes de texto
✗ Explicar reglas técnicas
✗ Usar Markdown con estructuras
✗ Mostrar JSON directamente
✗ Repetir contenido que ya está en el panel

=== ${aiSettings?.use_emojis ? `Usar máximo ${aiSettings?.max_emojis_per_message || 2} emojis` : 'No usar emojis'} ===

${dataContext}

=== FLUJO DE TRABAJO ===

${isCopyAdjustment ? `
FASE ACTUAL: AJUSTE DE COPY

El usuario quiere modificar un copy existente. DEBES:
1. NO escribir el copy en el chat
2. Generar la nueva versión internamente
3. Responder ÚNICAMENTE con JSON de actualización
4. Confirmar con mensaje muy corto

Responde SOLO con este JSON:
{
  "phase": "update_copy",
  "chat_message": "Listo 👍 Ya apliqué el ajuste en el panel derecho.",
  "panel_propuestas": {
    "accion": "update_copy",
    "copy_id": "copy_1",
    "nuevo_contenido": "El nuevo texto del copy con {{variables}} si aplica",
    "cambios": {
      "tipo": "tono|longitud|enfoque|CTA",
      "descripcion": "Descripción breve del cambio realizado"
    }
  }
}
` : !shouldGenerateProposal ? `
FASE ACTUAL: DESCUBRIMIENTO
Preguntas del usuario: ${messageCount}

Necesitas saber (en este orden de prioridad):
${!hasObjective ? '- Objetivo (vender, informar, reactivar, recordar)' : '✓ Objetivo: ' + context?.objective}
${!hasClientType ? '- Tipo de cliente objetivo (a quién va dirigido)' : '✓ Tipo cliente: ' + context?.clientType}
${!hasPromotion ? '- Detalles de la oferta/promoción (descuento %, precio, beneficio específico)' : '✓ Promoción definida'}

IMPORTANTE: SIEMPRE pregunta sobre la OFERTA o DESCUENTO específico antes de generar propuesta.
Ejemplo: "¿Qué descuento o beneficio quieres ofrecer?"

Haz UNA pregunta corta y natural. No expliques opciones técnicas.
NUNCA generes JSON ni propuestas en esta fase. Solo texto conversacional.
` : `
FASE ACTUAL: GENERACIÓN DE PROPUESTA
Contexto confirmado: ${JSON.stringify(context)}

DEBES responder ÚNICAMENTE con un objeto JSON válido:

{
  "phase": "proposal",
  "chat_message": "Mensaje MUY corto (ej: 'Te preparé una propuesta 👉')",
  "panel_propuestas": {
    "estado": "generada",
    "campaña": {
      "nombre_sugerido": "string",
      "descripcion": "string",
      "objetivo": "ventas|reactivacion|informativa|recordatorio",
      "prioridad": "alta|media|baja"
    }
  },
  "segments": [
    {
      "name": "Nombre descriptivo",
      "description": "Para qué sirve este segmento",
      "rules": [{"field": "CAMPO_EXISTENTE_DEL_LISTADO", "operator": "equals|contains|greater_than|less_than", "value": "valor"}],
      "estimatedCount": numero_basado_en_datos,
      "saturationRisk": "bajo|medio|alto",
      "recommended": true_o_false
    }
  ],
  "copies": [
    {
      "id": "copy_1",
      "segmentName": "Nombre del segmento",
      "content": "Texto del copy con {{nombre}} si aplica",
      "main": "Mismo texto que content (para compatibilidad)",
      "intent": "conversacional|urgencia|beneficio",
      "recommended": true,
      "recommendation_reason": "Una línea breve explicando por qué es el mejor",
      "requiresTemplate": true_si_fuera_de_ventana,
      "templateSuggestion": "plantilla_si_existe"
    },
    {
      "id": "copy_2",
      "segmentName": "Nombre del segmento",
      "content": "Segunda variante del copy",
      "main": "Segunda variante del copy",
      "intent": "urgencia",
      "recommended": false,
      "requiresTemplate": true_si_fuera_de_ventana
    },
    {
      "id": "copy_3",
      "segmentName": "Nombre del segmento",
      "content": "Tercera variante del copy",
      "main": "Tercera variante del copy",
      "intent": "beneficio",
      "recommended": false,
      "requiresTemplate": true_si_fuera_de_ventana
    }
  ],
  "validation": {
    "whatsappCompliant": true,
    "cooldownRespected": true,
    "notes": ["Notas importantes"]
  }
}

=== REGLA CRÍTICA DE COPYS ===
SIEMPRE genera EXACTAMENTE 3 variantes de copy con diferentes intenciones:
- 1 copy "conversacional" (amigable, cercano)
- 1 copy "urgencia" (sentido de urgencia, acción inmediata)
- 1 copy "beneficio" (enfocado en el valor/beneficio para el cliente)

SOLO UNA variante debe tener "recommended": true con su "recommendation_reason".
El "intent" debe coincidir con el tono del mensaje.
El campo "main" debe ser IGUAL a "content" (para compatibilidad).

=== REGLA CRÍTICA DE CAMPOS ===
SOLO puedes usar en "rules.field" los campos listados en "CAMPOS DISPONIBLES PARA SEGMENTACIÓN".
Si el usuario pide segmentar por algo que NO existe como campo:
- NO generes el segmento
- En chat_message indica: "Para segmentar por [X], primero necesitas crear un campo personalizado en Configuración > Campos de contacto."
- Deja el array "segments" vacío o usa solo campos que SÍ existen

IMPORTANTE:
- El "chat_message" debe ser MUY breve, solo confirma que hay propuesta lista
- NUNCA incluyas el contenido de copys o segmentos en chat_message
- Los segmentos SOLO pueden usar campos del listado "CAMPOS DISPONIBLES"
- Estima contactos basándote en los ${totalContacts || 0} contactos activos
- Si no hay campos personalizados y el usuario pide algo específico, indica que necesita crearlos primero
`}

=== FALLBACK ===
Si no puedes generar o actualizar propuestas, responde:
"No pude aplicar ese cambio automáticamente. ¿Quieres que regenere la propuesta?"`;

    const callAi = async (extraSystem?: string) => {
      const mergedSystem = extraSystem ? `${systemPrompt}\n\n${extraSystem}` : systemPrompt;
      const resp = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${lovableApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: mergedSystem },
            ...conversationHistory.map((m: Message) => ({ role: m.role, content: m.content })),
          ],
          temperature: 0.2,
        }),
      });

      if (!resp.ok) {
        const errorText = await resp.text();
        console.error('AI Gateway error:', resp.status, errorText);

        if (resp.status === 429) {
          return {
            ok: false as const,
            status: 429,
            data: { error: 'rate_limit', message: 'Límite de solicitudes excedido. Por favor, espera un momento.' },
          };
        }

        if (resp.status === 402) {
          return {
            ok: false as const,
            status: 402,
            data: { error: 'payment_required', message: 'Créditos de IA agotados. Contacta al administrador.' },
          };
        }

        return { ok: false as const, status: resp.status, data: { error: `ai_gateway_${resp.status}` } };
      }

      const json = await resp.json();
      return { ok: true as const, status: 200, data: json };
    };

    const parseModelResponse = (responseTextRaw: string) => {
      const responseText = responseTextRaw || '';
      console.log('AI Response:', responseText.substring(0, 500));

      let parsedProposal: any = null;
      let parsedChatMessage: string = responseText;

      const cleanedResponse = responseText.trim();
      if (cleanedResponse.startsWith('{') || cleanedResponse.includes('"phase"')) {
        try {
          let jsonStr = cleanedResponse;
          if (cleanedResponse.includes('```json')) {
            const match = cleanedResponse.match(/```json\s*([\s\S]*?)\s*```/);
            if (match) jsonStr = match[1];
          } else if (cleanedResponse.includes('```')) {
            const match = cleanedResponse.match(/```\s*([\s\S]*?)\s*```/);
            if (match) jsonStr = match[1];
          }

          const parsed = JSON.parse(jsonStr.trim());

          if (parsed.phase === 'proposal') {
            parsedProposal = {
              phase: 'proposal',
              segments: parsed.segments || [],
              copies: parsed.copies || [],
              validation: parsed.validation || {
                whatsappCompliant: true,
                cooldownRespected: true,
                notes: [],
              },
              message: parsed.chat_message || 'Tengo una propuesta lista en el panel derecho 👉',
            };
            parsedChatMessage = parsed.chat_message || 'Tengo una propuesta lista en el panel derecho 👉';
          } else if (parsed.phase === 'update_copy') {
            parsedProposal = {
              phase: 'update_copy',
              copyUpdate: parsed.panel_propuestas || {},
              message: parsed.chat_message || 'Listo 👍 Ya apliqué el ajuste en el panel derecho.',
            };
            parsedChatMessage = parsed.chat_message || 'Listo 👍 Ya apliqué el ajuste en el panel derecho.';
          }
        } catch (e) {
          console.log('Response is not valid JSON, treating as conversation:', e);
        }
      }

      return { parsedProposal, parsedChatMessage, raw: responseText };
    };

    // 1) First attempt
    const first = await callAi();
    if (!first.ok) {
      return new Response(JSON.stringify(first.data), {
        status: first.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const firstText = first.data.choices?.[0]?.message?.content || '';
    let { parsedProposal: proposal, parsedChatMessage: chatMessage } = parseModelResponse(firstText);

    // 2) Retry once when we EXPECT a structured payload but got plain text
    const expectsStructured = Boolean(isCopyAdjustment || shouldGenerateProposal);
    if (expectsStructured && !proposal) {
      const retry = await callAi(
        'REINTENTO OBLIGATORIO: Tu respuesta ANTERIOR no fue un JSON válido. Ahora responde SOLO con un objeto JSON válido, sin texto extra, sin Markdown, sin backticks. Debe seguir exactamente el esquema de la fase actual.'
      );

      if (retry.ok) {
        const retryText = retry.data.choices?.[0]?.message?.content || '';
        const parsedRetry = parseModelResponse(retryText);
        proposal = parsedRetry.parsedProposal;
        chatMessage = parsedRetry.parsedChatMessage;
      }
    }

    // Safety: if still no proposal, never claim the right panel has content
    if (!proposal && expectsStructured) {
      chatMessage = 'No pude generar la propuesta automáticamente. ¿Quieres que lo intente de nuevo si escribes “Genera propuesta”?' ;
    }

    return new Response(
      JSON.stringify({
        response: chatMessage,
        proposal,
        // backwards-compatible flag for any UI that might use it
        contextComplete: Boolean(contextComplete),
        dataStats: {
          totalContacts: totalContacts || 0,
          segmentsCount: segments?.length || 0,
          templatesCount: templates?.length || 0,
          campaignsCount: recentCampaigns?.length || 0,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('AI Campaign Copilot Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
