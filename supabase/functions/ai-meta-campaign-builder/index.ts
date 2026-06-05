import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const META_API = "https://graph.facebook.com/v21.0";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decryptToken(encrypted: string): string {
  const salt = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").slice(0, 16);
  try {
    const decoded = atob(encrypted);
    return decoded.startsWith(`${salt}::`) ? decoded.slice(salt.length + 2) : decoded;
  } catch {
    return "";
  }
}

function stripJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function metaPost(path: string, params: Record<string, string>) {
  const res = await fetch(`${META_API}${path}`, {
    method: "POST",
    body: new URLSearchParams(params),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    throw new Error(data?.error?.message || `HTTP ${res.status}`);
  }
  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const jwt = authHeader.replace("Bearer ", "");

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(jwt);
    if (claimsErr || !claimsData?.claims) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.tenant_id) {
      return json({ error: "Usuario sin tenant asociado" }, 403);
    }
    const tenantId = profile.tenant_id as string;

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("tenant_role, global_role")
      .eq("user_id", userId)
      .maybeSingle();
    const isSuperAdmin = roleRow?.global_role === "super_admin";
    const tenantRole = roleRow?.tenant_role;
    if (!isSuperAdmin && tenantRole !== "administrador" && tenantRole !== "manager") {
      return json({ error: "No tienes permisos para gestionar campañas de Meta Ads" }, 403);
    }

    const body = await req.json();
    const action = body?.action as string;

    // --- GENERATE -----------------------------------------------------------
    if (action === "generate") {
      if (!body?.property_id) return json({ error: "property_id requerido" }, 400);
      if (!lovableKey) return json({ error: "LOVABLE_API_KEY no configurado" }, 500);

      const objective: "LEAD_GENERATION" | "MESSAGES" =
        body?.objective === "MESSAGES" ? "MESSAGES" : "LEAD_GENERATION";
      const facebookPageId = body?.facebook_page_id
        ? String(body.facebook_page_id).trim()
        : null;
      if (objective === "MESSAGES" && !facebookPageId) {
        return json({ error: "Página de Facebook requerida para objetivo MESSAGES" }, 400);
      }

      let whatsappNumber: string | null = null;
      if (objective === "MESSAGES") {
        const { data: integ } = await admin
          .from("tenant_integrations")
          .select("phone_number")
          .eq("tenant_id", tenantId)
          .eq("provider", "twilio")
          .eq("status", "connected")
          .maybeSingle();
        whatsappNumber = integ?.phone_number ?? null;
        if (!whatsappNumber) {
          return json({ error: "No se encontró número de WhatsApp configurado. Verifica tu integración de Twilio en Configuración." }, 400);
        }
      }

      const { data: property, error: propErr } = await admin
        .from("properties")
        .select(
          "id, title, description, price, currency, operation_type, property_type, bedrooms, bathrooms, sq_meters, zone, address, property_images(file_url, is_cover, sort_order)",
        )
        .eq("id", body.property_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (propErr || !property) {
        return json({ error: "Propiedad no encontrada" }, 403);
      }

      const { data: connection } = await admin
        .from("meta_ads_connections")
        .select("ad_account_id, pixel_id")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .maybeSingle();
      if (!connection) {
        return json({ error: "Conecta tu cuenta de Meta Ads primero" }, 400);
      }

      const objectiveContext = objective === "MESSAGES"
        ? `El objetivo es que el lead haga clic y abra WhatsApp directamente para preguntar por la propiedad. El mensaje pre-llenado de WhatsApp mencionará el nombre e ID de la propiedad. El copy debe invitar a escribir por WhatsApp para obtener más información, precio y disponibilidad.`
        : `El objetivo es que el lead llene un formulario nativo de Meta con su nombre, teléfono y email para ser contactado por un asesor. El copy debe generar urgencia y destacar los beneficios de la propiedad.`;
      const ctaForObjective = objective === "MESSAGES" ? "WHATSAPP_MESSAGE" : "LEARN_MORE";

      const prompt = `Eres un experto en publicidad inmobiliaria en Meta Ads.
Genera la configuración completa para una campaña de captación de leads para la siguiente propiedad inmobiliaria en México.

OBJETIVO DE LA CAMPAÑA:
${objectiveContext}

PROPIEDAD:
- Título: ${property.title}
- Tipo: ${property.property_type ?? "—"} en ${property.operation_type}
- Precio: ${property.price} ${property.currency}
- Características: ${property.bedrooms ?? "?"} recámaras, ${property.bathrooms ?? "?"} baños, ${property.sq_meters ?? "?"}m²
- Ubicación: ${property.zone}${property.address ? `, ${property.address}` : ""}
- Descripción: ${property.description ?? ""}

INSTRUCCIONES:
Genera la configuración en formato JSON con esta estructura exacta. No incluyas explicaciones, solo el JSON:

{
  "name": "nombre de la campaña (incluye ciudad y tipo)",
  "copies": [
    {
      "headline": "versión directa e informativa, máx 40 caracteres",
      "primary_text": "versión directa, máx 125 caracteres",
      "description": "máx 30 caracteres"
    },
    {
      "headline": "versión emocional/aspiracional, máx 40 caracteres",
      "primary_text": "versión emocional, máx 125 caracteres",
      "description": "máx 30 caracteres"
    },
    {
      "headline": "versión urgente/escasez, máx 40 caracteres",
      "primary_text": "versión con urgencia, máx 125 caracteres",
      "description": "máx 30 caracteres"
    }
  ],
  "cta_type": "${ctaForObjective}",
  "age_min": 28,
  "age_max": 60,
  "genders": ["1", "2"],
  "geo_locations": { "cities": [{ "key": "ciudad_key", "name": "${property.zone}" }], "countries": ["MX"] },
  "interests": [
    { "id": "6003107902433", "name": "Bienes raíces" },
    { "id": "6002714398172", "name": "Compra de vivienda" }
  ],
  "daily_budget_cents": 25000,
  "lead_form_fields": [
    { "type": "FULL_NAME" },
    { "type": "PHONE" },
    { "type": "EMAIL" }
  ],
  "recommendations": [
    "recomendación 1 específica para esta propiedad y presupuesto",
    "recomendación 2",
    "recomendación 3"
  ]
}`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 1000,
        }),
      });
      if (aiRes.status === 429) return json({ error: "Límite de uso de IA alcanzado, intenta en unos minutos" }, 429);
      if (aiRes.status === 402) return json({ error: "Créditos de IA agotados, agrega más en tu workspace" }, 402);
      if (!aiRes.ok) {
        const t = await aiRes.text();
        return json({ error: `Error de IA: ${t.slice(0, 200)}` }, 500);
      }
      const aiData = await aiRes.json();
      const content = aiData?.choices?.[0]?.message?.content ?? "";
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(stripJsonFences(content));
      } catch {
        return json({ error: "La IA devolvió un formato no válido" }, 500);
      }

      const copiesRaw = Array.isArray((parsed as any).copies)
        ? ((parsed as any).copies as Array<Record<string, unknown>>)
        : [];
      const fallbackCopy = {
        headline: String((parsed as any).headline ?? property.title),
        primary_text: String((parsed as any).primary_text ?? ""),
        description: (parsed as any).description ? String((parsed as any).description) : "",
      };
      const copies = (copiesRaw.length > 0 ? copiesRaw : [fallbackCopy]).map((c) => ({
        headline: String(c.headline ?? fallbackCopy.headline).slice(0, 40),
        primary_text: String(c.primary_text ?? fallbackCopy.primary_text).slice(0, 125),
        description: c.description ? String(c.description).slice(0, 30) : "",
      }));
      while (copies.length < 3) copies.push(copies[copies.length - 1]);
      const firstCopy = copies[0];
      const recommendations = Array.isArray((parsed as any).recommendations)
        ? ((parsed as any).recommendations as unknown[]).map((r) => String(r)).slice(0, 5)
        : [];

      const images = (property.property_images ?? []) as Array<{
        file_url: string;
        is_cover: boolean;
        sort_order: number;
      }>;
      const cover = images.find((i) => i.is_cover) ??
        images.sort((a, b) => a.sort_order - b.sort_order)[0];

      const insertPayload = {
        tenant_id: tenantId,
        property_id: property.id,
        objective: objective,
        campaign_objective: objective,
        whatsapp_phone_number: whatsappNumber,
        facebook_page_id: facebookPageId,
        name: String(parsed.name ?? `Campaña ${property.title}`).slice(0, 200),
        headline: firstCopy.headline,
        primary_text: firstCopy.primary_text,
        description: firstCopy.description || null,
        cta_type: (parsed.cta_type as string) ?? ctaForObjective,
        age_min: Number(parsed.age_min ?? 25),
        age_max: Number(parsed.age_max ?? 65),
        genders: Array.isArray(parsed.genders) ? (parsed.genders as string[]) : ["1", "2"],
        geo_locations: parsed.geo_locations ?? null,
        interests: parsed.interests ?? null,
        daily_budget_cents: Number(parsed.daily_budget_cents ?? 25000),
        lead_form_fields: parsed.lead_form_fields ?? [
          { type: "FULL_NAME" },
          { type: "PHONE" },
          { type: "EMAIL" },
        ],
        image_url: cover?.file_url ?? null,
        status: "review",
        ai_generated_at: new Date().toISOString(),
        created_by: userId,
      };

      const { data: campaign, error: insertErr } = await admin
        .from("meta_ads_campaigns")
        .insert(insertPayload)
        .select()
        .single();
      if (insertErr) return json({ error: insertErr.message }, 500);

      return json({ campaign, copies, recommendations });
    }

    // --- PUBLISH / PAUSE / RESUME -------------------------------------------
    if (action === "publish" || action === "pause" || action === "resume") {
      if (!body?.campaign_id) return json({ error: "campaign_id requerido" }, 400);

      const { data: campaign } = await admin
        .from("meta_ads_campaigns")
        .select("*")
        .eq("id", body.campaign_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!campaign) return json({ error: "Campaña no encontrada" }, 404);

      const { data: connection } = await admin
        .from("meta_ads_connections")
        .select("access_token_encrypted, ad_account_id")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .maybeSingle();
      if (!connection) return json({ error: "Conecta tu cuenta de Meta Ads primero" }, 400);

      const token = decryptToken(connection.access_token_encrypted as string);
      if (!token) return json({ error: "Token de Meta inválido, reconecta tu cuenta" }, 400);

      const adAccountId = connection.ad_account_id as string;

      if (action === "pause" || action === "resume") {
        if (!campaign.meta_campaign_id) return json({ error: "La campaña no está publicada en Meta" }, 400);
        try {
          await metaPost(`/${campaign.meta_campaign_id}`, {
            status: action === "pause" ? "PAUSED" : "ACTIVE",
            access_token: token,
          });
          await admin
            .from("meta_ads_campaigns")
            .update({ status: action === "pause" ? "paused" : "active" })
            .eq("id", campaign.id);
          return json({ success: true });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return json({ error: msg }, 400);
        }
      }

      // publish
      await admin
        .from("meta_ads_campaigns")
        .update({ status: "publishing", publish_error: null })
        .eq("id", campaign.id);

      try {
        if (campaign.campaign_objective === "MESSAGES") {
          if (!campaign.facebook_page_id) {
            throw new Error("Falta Página de Facebook para campaña de Mensajes");
          }
          if (!campaign.whatsapp_phone_number) {
            throw new Error("Falta número de WhatsApp para campaña de Mensajes");
          }

          // Construir mensaje pre-llenado con título e ID de propiedad
          const { data: propertyForMsg } = await admin
            .from("properties")
            .select("title, code")
            .eq("id", campaign.property_id)
            .maybeSingle();
          const propertyIdentifier = propertyForMsg?.code ?? campaign.property_id;
          const prefilledMessage =
            `Hola, me interesa la propiedad ` +
            `${propertyForMsg?.title ?? campaign.name} ` +
            `ID:${propertyIdentifier}`;

          const campaignRes = await metaPost(`/${adAccountId}/campaigns`, {
            name: campaign.name,
            objective: "MESSAGES",
            status: "ACTIVE",
            special_ad_categories: "[]",
            access_token: token,
          });
          const metaCampaignId = campaignRes.id as string;

          const adSetRes = await metaPost(`/${adAccountId}/adsets`, {
            name: `AdSet - ${campaign.name}`.slice(0, 100),
            campaign_id: metaCampaignId,
            billing_event: "IMPRESSIONS",
            optimization_goal: "CONVERSATIONS",
            destination_type: "WHATSAPP",
            daily_budget: String(campaign.daily_budget_cents ?? 25000),
            targeting: JSON.stringify({
              age_min: campaign.age_min,
              age_max: campaign.age_max,
              genders: (campaign.genders ?? []).map((g: string) => Number(g)),
              geo_locations: campaign.geo_locations ?? { countries: ["MX"] },
              interests: campaign.interests ?? [],
            }),
            status: "ACTIVE",
            access_token: token,
          });
          const metaAdSetId = adSetRes.id as string;

          let metaAdId: string | null = null;
          if (campaign.image_url) {
            const creativeRes = await metaPost(`/${adAccountId}/adcreatives`, {
              name: `Creative - ${campaign.name}`.slice(0, 100),
              object_story_spec: JSON.stringify({
                page_id: campaign.facebook_page_id,
                link_data: {
                  image_url: campaign.image_url,
                  message: campaign.primary_text,
                  name: campaign.headline,
                  description: campaign.description ?? "",
                  call_to_action: {
                    type: "WHATSAPP_MESSAGE",
                    value: {
                      app_destination: "WHATSAPP",
                      whatsapp_number: campaign.whatsapp_phone_number,
                      user_message_prompt: prefilledMessage,
                    },
                  },
                },
              }),
              access_token: token,
            });
            const creativeId = creativeRes.id as string;

            const adRes = await metaPost(`/${adAccountId}/ads`, {
              name: `Ad - ${campaign.name}`.slice(0, 100),
              adset_id: metaAdSetId,
              creative: JSON.stringify({ creative_id: creativeId }),
              status: "ACTIVE",
              access_token: token,
            });
            metaAdId = adRes.id as string;
          }

          await admin
            .from("meta_ads_campaigns")
            .update({
              meta_campaign_id: metaCampaignId,
              meta_adset_id: metaAdSetId,
              meta_ad_id: metaAdId,
              meta_form_id: null,
              status: "active",
              published_at: new Date().toISOString(),
              publish_error: null,
            })
            .eq("id", campaign.id);

          return json({ success: true });
        }

        const campaignRes = await metaPost(`/${adAccountId}/campaigns`, {
          name: campaign.name,
          objective: "LEAD_GENERATION",
          status: "ACTIVE",
          special_ad_categories: "[]",
          access_token: token,
        });
        const metaCampaignId = campaignRes.id as string;

        const formRes = await metaPost(`/${adAccountId}/leadgen_forms`, {
          name: `Form - ${campaign.name}`.slice(0, 100),
          questions: JSON.stringify(campaign.lead_form_fields ?? []),
          privacy_policy: JSON.stringify({
            url: "https://brokia24.com/privacidad",
            link_text: "Política de privacidad",
          }),
          access_token: token,
        });
        const metaFormId = formRes.id as string;

        const adSetRes = await metaPost(`/${adAccountId}/adsets`, {
          name: `AdSet - ${campaign.name}`.slice(0, 100),
          campaign_id: metaCampaignId,
          billing_event: "IMPRESSIONS",
          optimization_goal: "LEAD_GENERATION",
          daily_budget: String(campaign.daily_budget_cents ?? 25000),
          targeting: JSON.stringify({
            age_min: campaign.age_min,
            age_max: campaign.age_max,
            genders: (campaign.genders ?? []).map((g: string) => Number(g)),
            geo_locations: campaign.geo_locations ?? { countries: ["MX"] },
            interests: campaign.interests ?? [],
          }),
          status: "ACTIVE",
          access_token: token,
        });
        const metaAdSetId = adSetRes.id as string;

        let metaAdId: string | null = null;
        if (campaign.image_url) {
          const creativeRes = await metaPost(`/${adAccountId}/adcreatives`, {
            name: `Creative - ${campaign.name}`.slice(0, 100),
            object_story_spec: JSON.stringify({
              link_data: {
                image_url: campaign.image_url,
                message: campaign.primary_text,
                name: campaign.headline,
                description: campaign.description ?? "",
                call_to_action: {
                  type: campaign.cta_type ?? "LEARN_MORE",
                  value: { lead_gen_form_id: metaFormId },
                },
              },
            }),
            access_token: token,
          });
          const creativeId = creativeRes.id as string;

          const adRes = await metaPost(`/${adAccountId}/ads`, {
            name: `Ad - ${campaign.name}`.slice(0, 100),
            adset_id: metaAdSetId,
            creative: JSON.stringify({ creative_id: creativeId }),
            status: "ACTIVE",
            access_token: token,
          });
          metaAdId = adRes.id as string;
        }

        await admin
          .from("meta_ads_campaigns")
          .update({
            meta_campaign_id: metaCampaignId,
            meta_adset_id: metaAdSetId,
            meta_ad_id: metaAdId,
            meta_form_id: metaFormId,
            status: "active",
            published_at: new Date().toISOString(),
            publish_error: null,
          })
          .eq("id", campaign.id);

        return json({ success: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await admin
          .from("meta_ads_campaigns")
          .update({ status: "error", publish_error: msg })
          .eq("id", campaign.id);
        return json({ error: msg }, 400);
      }
    }

    return json({ error: "Acción no soportada" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return json({ error: msg }, 500);
  }
});