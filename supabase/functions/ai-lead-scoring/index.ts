import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { tenant_id, contact_id } = await req.json();

    if (!tenant_id || !contact_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id and contact_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lovableApiKey) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gather contact data
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .select("*")
      .eq("id", contact_id)
      .eq("tenant_id", tenant_id)
      .single();

    if (contactError || !contact) {
      return new Response(
        JSON.stringify({ error: "Contact not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get conversation stats
    const { data: conversations } = await supabase
      .from("conversations")
      .select("id, status, ai_enabled, needs_human, last_customer_message_at, last_agent_message_at, unread_count")
      .eq("contact_id", contact_id)
      .eq("tenant_id", tenant_id);

    // Get recent messages (last 20)
    const conversationIds = (conversations || []).map((c) => c.id);
    let recentMessages: any[] = [];
    if (conversationIds.length > 0) {
      const { data: msgs } = await supabase
        .from("messages")
        .select("direction, body, created_at, ai_generated, media_type")
        .in("conversation_id", conversationIds)
        .order("created_at", { ascending: false })
        .limit(20);
      recentMessages = msgs || [];
    }

    // Get events (visits)
    const { data: events } = await supabase
      .from("events")
      .select("event_type, status, start_at")
      .eq("contact_id", contact_id)
      .eq("tenant_id", tenant_id)
      .order("start_at", { ascending: false })
      .limit(10);

    // Get followups
    const { data: followups } = await supabase
      .from("conversation_followups")
      .select("status, due_at, completed_at")
      .eq("contact_id", contact_id)
      .eq("tenant_id", tenant_id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Build context for AI
    const contactSummary = {
      name: contact.name,
      pipeline_stage: contact.pipeline_stage,
      operational_status: contact.operational_status,
      engagement_level: contact.engagement_level,
      source: contact.source,
      created_at: contact.created_at,
      last_interaction_at: contact.last_interaction_at,
      re_credit_preapproved: contact.re_credit_preapproved,
      re_credit_type: contact.re_credit_type,
      re_budget_estimated_mxn: contact.re_budget_estimated_mxn,
      re_property_interest_id: contact.re_property_interest_id,
      re_block_reason: contact.re_block_reason,
      re_visit_outcome: contact.re_visit_outcome,
      re_current_situation: contact.re_current_situation,
      tags: contact.tags,
      has_email: !!contact.email,
      has_phone: !!contact.phone,
    };

    const messagesSummary = recentMessages.map((m) => ({
      direction: m.direction,
      has_text: !!m.body,
      text_preview: m.body?.substring(0, 100) || null,
      has_media: !!m.media_type,
      ai_generated: m.ai_generated,
      created_at: m.created_at,
    }));

    const eventsSummary = (events || []).map((e) => ({
      type: e.event_type,
      status: e.status,
      date: e.start_at,
    }));

    const followupsSummary = (followups || []).map((f) => ({
      status: f.status,
      due_at: f.due_at,
      completed: !!f.completed_at,
    }));

    const totalInbound = recentMessages.filter((m) => m.direction === "inbound").length;
    const totalOutbound = recentMessages.filter((m) => m.direction === "outbound").length;

    const prompt = `Eres un experto en lead scoring para bienes raíces en México. Analiza los siguientes datos de un lead y calcula:

1. **lead_score** (0-100): Puntuación de calidad del lead.
2. **lead_temperature** ("cold", "warm", "hot"): Temperatura que indica urgencia/interés.

## Criterios de scoring:

### Engagement (0-30 pts)
- Mensajes recientes del cliente: más mensajes = más puntos
- Frecuencia de interacción: interacciones recientes suman más
- Respuesta a mensajes del agente: si responde rápido = más puntos
- Ratio inbound/outbound: más inbound = lead más activo

### Cualificación (0-35 pts)
- Tiene crédito preaprobado: +15 pts
- Tiene tipo de crédito definido: +5 pts
- Tiene presupuesto definido: +5 pts
- Tiene propiedad de interés: +5 pts
- Tiene email registrado: +3 pts
- Tags relevantes: +2 pts

### Avance en pipeline (0-25 pts)
- Etapa avanzada (visita_programada, negociacion, etc.): más puntos
- Visita completada con resultado positivo: +10 pts
- Sin razón de bloqueo: +5 pts

### Señales de urgencia (0-10 pts)
- Mensajes con palabras clave de urgencia: precio, comprar, visitar, enganche, crédito
- Follow-ups completados: indica compromiso

### Penalizaciones
- Ghosting / sin respuesta reciente: -20 pts
- Block reason activo: -15 pts
- Visita con no-show: -10 pts
- Solo mensajes AI sin respuesta humana necesaria: -5 pts

## Temperatura:
- **hot** (score ≥ 65): Lead activo, cualificado, en etapa avanzada
- **warm** (35-64): Lead con interés pero falta cualificación o actividad
- **cold** (< 35): Lead nuevo, sin engagement, o ghosting

## Datos del lead:

**Contacto:**
${JSON.stringify(contactSummary, null, 2)}

**Mensajes recientes (${totalInbound} inbound, ${totalOutbound} outbound):**
${JSON.stringify(messagesSummary, null, 2)}

**Eventos/Visitas:**
${JSON.stringify(eventsSummary, null, 2)}

**Follow-ups:**
${JSON.stringify(followupsSummary, null, 2)}

**Conversaciones:** ${conversations?.length || 0} total

Responde SOLO usando la función suggest_lead_score.`;

    // Call Lovable AI with tool calling for structured output
    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: "Eres un sistema de lead scoring para inmobiliarias en México. Analiza datos y devuelve puntuaciones precisas usando la función proporcionada.",
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "suggest_lead_score",
                description: "Return the calculated lead score and temperature",
                parameters: {
                  type: "object",
                  properties: {
                    lead_score: {
                      type: "number",
                      description: "Score from 0 to 100",
                    },
                    lead_temperature: {
                      type: "string",
                      enum: ["cold", "warm", "hot"],
                      description: "Temperature classification",
                    },
                    reasoning: {
                      type: "string",
                      description: "Brief explanation in Spanish of the scoring (max 150 chars)",
                    },
                  },
                  required: ["lead_score", "lead_temperature", "reasoning"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "suggest_lead_score" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: "AI scoring failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiResult = await aiResponse.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiResult));
      return new Response(
        JSON.stringify({ error: "Invalid AI response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const scoring = JSON.parse(toolCall.function.arguments);
    const newScore = Math.max(0, Math.min(100, Math.round(scoring.lead_score)));
    const newTemp = ["cold", "warm", "hot"].includes(scoring.lead_temperature)
      ? scoring.lead_temperature
      : "cold";

    console.log(
      `🎯 Lead scoring for ${contact.name}: score=${newScore}, temp=${newTemp}, reason="${scoring.reasoning}"`
    );

    // Update contact
    const { error: updateError } = await supabase
      .from("contacts")
      .update({
        lead_score: newScore,
        lead_temperature: newTemp,
        updated_at: new Date().toISOString(),
      })
      .eq("id", contact_id)
      .eq("tenant_id", tenant_id);

    if (updateError) {
      console.error("Failed to update contact scoring:", updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update scoring" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_score: newScore,
        lead_temperature: newTemp,
        reasoning: scoring.reasoning,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Lead scoring error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
