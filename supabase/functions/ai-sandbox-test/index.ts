import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REGION_CONTEXT: Record<string, { country: string; currency: string; modismos: string }> = {
  MX: { country: "México", currency: "MXN ($)", modismos: 'Términos: "departamento", "recámara", "Infonavit/Fovissste", "enganche". Evita "piso", "habitación".' },
  CO: { country: "Colombia", currency: "COP ($)", modismos: 'Términos: "apartamento", "habitación", "subsidio MiCasaYa", "cuota inicial". Evita "departamento".' },
  PE: { country: "Perú", currency: "PEN (S/)", modismos: 'Términos: "departamento", "dormitorio", "crédito Mivivienda".' },
  AR: { country: "Argentina", currency: "ARS ($)", modismos: 'Términos: "departamento", "ambientes", "expensas". Trato con "vos" si aplica.' },
  CL: { country: "Chile", currency: "CLP ($)", modismos: 'Términos: "departamento", "dormitorio", "UF", "pie".' },
  ES: { country: "España", currency: "EUR (€)", modismos: 'Términos: "piso", "habitación", "hipoteca", "comunidad", "IBI", "arras".' },
  US: { country: "Estados Unidos (hispano)", currency: "USD ($)", modismos: "Términos bilingües si aplica." },
};

const FORMALITY_TEXT: Record<string, string> = {
  tu: 'Trata al cliente de "tú" (informal cercano).',
  usted: 'Trata al cliente de "usted" (formal y respetuoso). Nunca uses "tú".',
  vos: 'Trata al cliente de "vos" (informal rioplatense).',
};

const LANGUAGE_TEXT: Record<string, string> = {
  es: "Responde SIEMPRE en español.",
  en: "Responde SIEMPRE en inglés.",
  pt: "Responde SIEMPRE en portugués.",
};

function stripEmojis(text: string): string {
  return text
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F2FF}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function enforceMaxLength(text: string, maxLen: number): string {
  if (!maxLen || text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > maxLen * 0.7 ? cut.slice(0, lastSpace) : cut).trim() + "…";
}

function buildSystemPrompt(s: any) {
  const region = REGION_CONTEXT[(s.region_code || "MX").toUpperCase()] || REGION_CONTEXT.MX;
  const formality = FORMALITY_TEXT[s.formality || "tu"] || FORMALITY_TEXT.tu;
  const language = LANGUAGE_TEXT[s.language || "es"] || LANGUAGE_TEXT.es;
  const maxLen = s.max_message_length || 320;

  const tone: Record<string, string> = {
    cordial: "Sé amable y respetuoso en todo momento.",
    professional: "Mantén un tono profesional y directo.",
    friendly: "Sé casual y cercano, como si hablaras con un amigo.",
    adaptive: "Adapta tu tono al estilo del cliente.",
  };
  const emojiInstr = s.use_emojis
    ? `Puedes usar hasta ${s.max_emojis_per_message || 2} emoji(s) por mensaje. NUNCA superes ese límite.`
    : "PROHIBIDO usar emojis. No incluyas ningún emoji bajo ninguna circunstancia.";
  const identity = s.never_reveal_ai
    ? "NUNCA reveles que eres una IA. Actúa como un asistente humano."
    : "";

  return `Eres ${s.agent_name || "Asistente"}, asistente de ${s.company_name || "la empresa"}.

CONTEXTO REGIONAL (OBLIGATORIO):
- País del cliente: ${region.country}
- Moneda local: ${region.currency}
- ${region.modismos}
- ${formality}
- ${language}
- LONGITUD MÁXIMA: cada mensaje debe tener máximo ${maxLen} caracteres. Sé breve y directo.

INSTRUCCIONES DE ESTILO:
- ${tone[s.tone] || tone.professional}
- ${emojiInstr}
- ${identity}

MODO SANDBOX: Esta es una conversación de prueba para validar el comportamiento configurado. Responde como lo harías con un cliente real, respetando todas las reglas.

COMPORTAMIENTO DEL NEGOCIO:
${s.behavior_prompt || "(sin instrucciones específicas)"}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { settings, messages } = await req.json();
    if (!settings || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "settings y messages requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Auth: require any authenticated tenant user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) throw new Error("LOVABLE_API_KEY missing");

    const systemPrompt = buildSystemPrompt(settings);

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    if (aiResp.status === 429) {
      return new Response(JSON.stringify({ error: "Límite de solicitudes excedido. Intenta de nuevo en unos segundos." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (aiResp.status === 402) {
      return new Response(JSON.stringify({ error: "Sin créditos de IA. Recarga tu workspace." }), {
        status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("AI gateway error", aiResp.status, t);
      return new Response(JSON.stringify({ error: "Error en el modelo de IA" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    let text: string = data.choices?.[0]?.message?.content || "";

    // Post-processing same as production
    if (!settings.use_emojis) text = stripEmojis(text);
    text = enforceMaxLength(text, settings.max_message_length || 320);

    // Strip internal markers from sandbox preview
    const markers = {
      escalar: /\[ESCALAR\]/g,
      seguimiento: /\[SEGUIMIENTO_HUMANO\]/g,
      fotos: /\[FOTOS:[^\]]+\]/g,
      interes: /\[PROPIEDAD_INTERES:[^\]]+\]/g,
    };
    const detected = {
      escalar: markers.escalar.test(text),
      seguimiento: markers.seguimiento.test(text),
    };
    let clean = text;
    for (const re of Object.values(markers)) clean = clean.replace(re, "").trim();

    return new Response(
      JSON.stringify({ response: clean, raw: text, detected, system_prompt_preview: systemPrompt.slice(0, 600) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("sandbox error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
