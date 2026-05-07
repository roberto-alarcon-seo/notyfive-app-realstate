import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const REGION_CONTEXT: Record<string, { country: string; currency: string; modismos: string }> = {
  MX: { country: "México", currency: "MXN ($)", modismos: 'Español de México neutral. USA: "departamento", "recámara", "alberca", "cochera", "Infonavit/Fovissste", "enganche", "mensualidades", "ahorita", "platicar". EVITA: "piso" (usa departamento), "habitación" (usa recámara), "coche" (usa carro/auto), "vale" (usa "ok/sale"), "vosotros", "tío/tía".' },
  CO: { country: "Colombia", currency: "COP ($)", modismos: 'Español colombiano (acento bogotano neutro). USA: "apartamento", "habitación/alcoba", "parqueadero", "subsidio MiCasaYa", "cuota inicial", "arriendo", "chévere", "parcero" (informal), "¿cómo le va?", "le cuento que…", "con mucho gusto". EVITA: "departamento", "recámara", "piso", "vale", "guay", "tío/tía", "vosotros".' },
  PE: { country: "Perú", currency: "PEN (S/)", modismos: 'Español peruano. USA: "departamento", "dormitorio", "cochera", "crédito Mivivienda/Techo Propio", "inicial", "cuotas", "chévere", "bacán". EVITA: "piso", "vale", "vosotros".' },
  AR: { country: "Argentina", currency: "ARS ($)", modismos: 'Español rioplatense. USA "vos" y conjugación voseante (tenés, querés, podés, sabés). USA: "departamento", "ambientes" (no "recámaras"), "expensas", "cochera", "che", "dale", "barbaro". EVITA: "tú", "vosotros", "piso".' },
  CL: { country: "Chile", currency: "CLP ($)", modismos: 'Español chileno. USA: "departamento", "dormitorio", "estacionamiento", "UF", "pie" (enganche), "bacán", "cachái". EVITA: "piso", "recámara", "vale", "vosotros".' },
  ES: { country: "España", currency: "EUR (€)", modismos: 'OBLIGATORIO ESPAÑOL DE ESPAÑA (castellano peninsular). USA SIEMPRE: "piso" (NUNCA "departamento" ni "apartamento" salvo unifamiliar pequeño), "habitación" (NUNCA "recámara" ni "dormitorio" como término principal), "salón", "cocina", "cuarto de baño/aseo", "plaza de garaje", "trastero", "comunidad de propietarios", "IBI", "arras", "hipoteca", "nómina", "Hacienda", "ascensor". USA expresiones locales: "vale", "venga", "estupendo", "genial", "que tal", "perfecto", "encantado/a", "un saludo cordial". USA "coger" (tomar), "ordenador" (no "computadora"), "móvil" (no "celular"), "coche" (no "carro/auto"). PROHIBIDO: "ahorita", "platicar", "departamento", "recámara", "carro", "celular", "computadora", "okey", "sale", "chévere", "bacán", "parqueadero", "alberca" (di "piscina"), "cochera" (di "garaje"), "enganche" (di "entrada"), "mensualidades" (di "cuota mensual/letra"). NO uses "vosotros" salvo para grupo informal; con cliente usa "usted" o "tú" según formalidad.' },
  US: { country: "Estados Unidos (hispano)", currency: "USD ($)", modismos: "Español neutro latino, términos bilingües si el cliente cambia de idioma." },
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

// === Trigger lists (must match ai-chat-response) ===
const HUMAN_REQUEST_TRIGGERS = [
  "hablar con persona", "agente humano", "representante", "persona real",
  "no quiero bot", "quiero hablar con alguien", "asesor", "ejecutivo",
  "hablar con humano", "hablar con un humano", "una persona", "con una persona",
  "eres una maquina", "eres una máquina", "eres un bot", "eres robot",
  "quiero un humano", "pasame con", "pásame con", "comunicame con", "comunícame con",
  "me atienda alguien", "que me atienda", "alguien que me atienda",
];
const FRUSTRATION_TRIGGERS = [
  "esto no sirve", "no me ayudas", "eres inutil", "eres inútil", "incompetente",
  "urgente", "es una emergencia", "llevo horas", "llevo días", "llevo dias",
  "estoy enojado", "estoy enojada", "estoy molesto", "estoy molesta",
  "estoy harto", "estoy harta", "estoy furioso", "estoy furiosa",
  "estoy cabreado", "estoy cabreada", "qué frustrante", "que frustrante",
  "me tienen harto", "me tienen harta", "esto es ridículo", "esto es ridiculo",
  "pésimo servicio", "pesimo servicio", "mal servicio", "una vergüenza", "una verguenza",
  "no me sirve", "estoy frustrado", "estoy frustrada", "no entiendes nada",
  "coño", "joder", "mierda", "estafa", "estafadores",
];
const VISIT_TRIGGERS = [
  "agendar visita", "agendar cita", "quiero visitar", "quiero ver el", "quiero ver la",
  "puedo ir a ver", "puedo verla", "puedo verlo", "ir a verla", "ir a verlo",
  "visitar el inmueble", "visitar la propiedad", "ver la casa", "ver el departamento",
  "cuando puedo ir", "cuándo puedo ir", "horario para visita", "programar visita",
];
const PRICE_NEGOTIATION_TRIGGERS = [
  "descuento", "rebaja", "negociar precio", "negociable", "mejor precio",
  "más barato", "mas barato", "bajar el precio", "reducir el precio",
];
const LEGAL_TRIGGERS = [
  "escritura", "notario", "notaría", "notaria", "impuestos", "fiscal",
  "simulación de crédito", "simulacion de credito", "trámite legal", "tramite legal",
];

function isWithinBusinessHours(bh: any): { open: boolean; configured: boolean } {
  if (!bh || !bh.enabled) return { open: true, configured: false };
  try {
    const tz = bh.timezone || "America/Mexico_City";
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false });
    const parts = fmt.formatToParts(now);
    const wd = parts.find(p => p.type === "weekday")?.value?.toLowerCase().slice(0, 3) || "";
    const hh = parts.find(p => p.type === "hour")?.value || "00";
    const mm = parts.find(p => p.type === "minute")?.value || "00";
    const day = bh.days?.[wd];
    if (!day || !day.open || !day.close) return { open: false, configured: true };
    const cur = `${hh}:${mm}`;
    return { open: cur >= day.open && cur <= day.close, configured: true };
  } catch { return { open: true, configured: false }; }
}

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

  // Handoff rules (must be explicit so the model emits [ESCALAR])
  const ht = s.handoff_triggers || {};
  const handoffRules: string[] = [];
  if (s.escalate_on_human_request !== false) handoffRules.push('Si el cliente pide hablar con una persona/asesor/agente/humano (ej: "quiero hablar con alguien", "una persona real", "un humano", "un asesor"), responde una frase breve y empática y AÑADE al final el marcador literal [ESCALAR].');
  if (s.escalate_on_frustration !== false) handoffRules.push('Si detectas frustración, enojo o molestia ("estoy enojado/molesto/harto", "no me ayudas", "esto no sirve", "llevo horas", "urgente", insultos, mayúsculas sostenidas, signos de exclamación múltiples), discúlpate brevemente y AÑADE al final [ESCALAR]. NO intentes resolver tú mismo.');
  if (ht.on_price_negotiation) handoffRules.push("Si el cliente quiere negociar precio o pedir descuento, AÑADE [ESCALAR] al final.");
  if (ht.on_legal_question) handoffRules.push("Si el cliente hace una pregunta legal, fiscal o financiera específica (escrituras, notario, simulación de crédito), AÑADE [ESCALAR] al final.");
  if (ht.on_schedule_visit) handoffRules.push("Si el cliente pide agendar una visita, AÑADE [ESCALAR] al final.");
  if (s.escalate_on_no_answer !== false) handoffRules.push("Si NO tienes el dato en la base de conocimiento ni en el inventario, NO inventes. Responde brevemente y AÑADE [ESCALAR].");
  const handoffBlock = handoffRules.length
    ? `\n\nREGLAS DE ESCALAMIENTO A HUMANO (CRÍTICO — debes obedecer SIEMPRE):\n- ${handoffRules.join("\n- ")}\n- El marcador [ESCALAR] debe ir SIEMPRE al final del mensaje, en mayúsculas y entre corchetes literales. Es invisible para el cliente; el sistema lo detecta para reasignar.`
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
- ${identity}${handoffBlock}

MODO SANDBOX: Esta es una conversación de prueba para validar el comportamiento configurado. Responde como lo harías con un cliente real, respetando todas las reglas.

COMPORTAMIENTO DEL NEGOCIO:
${s.behavior_prompt || "(sin instrucciones específicas)"}`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { settings, messages, tenant_id } = await req.json();
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

    // Cargar inventario y KB del tenant para contexto realista
    let inventoryContext = "";
    let kbContext = "";
    if (tenant_id) {
      const [propsRes, kbRes] = await Promise.all([
        supabase
          .from("properties")
          .select("title, property_code, zone, price, currency, operation_type, property_type, status, address, description, accepted_credits")
          .eq("tenant_id", tenant_id)
          .eq("is_active", true)
          .limit(50),
        supabase
          .from("ai_knowledge_base")
          .select("question, answer, category")
          .eq("tenant_id", tenant_id)
          .eq("is_active", true)
          .limit(50),
      ]);
      const props = propsRes.data || [];
      if (props.length) {
        inventoryContext = "\n\nPROPIEDADES DISPONIBLES (inventario real del tenant):\n" +
          props.map((p: any) =>
            `- ${p.title} (Código: ${p.property_code}) | Zona: ${p.zone} | Precio: $${(p.price || 0).toLocaleString()} ${p.currency} | ${p.operation_type} | Tipo: ${p.property_type || "—"} | Estatus: ${p.status}${p.address ? ` | Dirección: ${p.address}` : ""}${p.description ? `\n  Descripción: ${p.description}` : ""}${p.accepted_credits?.length ? `\n  Créditos: ${p.accepted_credits.join(", ")}` : ""}`
          ).join("\n");
      } else {
        inventoryContext = "\n\nPROPIEDADES DISPONIBLES: (no hay inmuebles activos cargados)";
      }
      const kb = kbRes.data || [];
      if (kb.length) {
        kbContext = "\n\nBASE DE CONOCIMIENTO:\n" +
          kb.map((k: any) => `- [${k.category || "general"}] P: ${k.question}\n  R: ${k.answer}`).join("\n");
      }
    }

    const systemPrompt = buildSystemPrompt(settings) + inventoryContext + kbContext;

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
