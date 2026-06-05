import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const META_API = "https://graph.facebook.com/v21.0";

const INSIGHT_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "spend",
  "cpm",
  "cpc",
  "ctr",
  "actions",
  "cost_per_action_type",
  "date_start",
  "date_stop",
].join(",");

const SUMMARY_FIELDS = [
  "impressions",
  "reach",
  "clicks",
  "spend",
  "cpm",
  "cpc",
  "ctr",
  "actions",
  "cost_per_action_type",
].join(",");

interface RequestBody {
  scope: "campaign" | "summary";
  campaign_id?: string;
  date_preset?: string;
  date_start?: string;
  date_end?: string;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildTimeRange(body: RequestBody): Record<string, string> {
  if (body.date_start && body.date_end) {
    return {
      time_range: JSON.stringify({
        since: body.date_start,
        until: body.date_end,
      }),
    };
  }
  return { date_preset: body.date_preset ?? "last_7d" };
}

function parseInsights(raw: any[], objective: string) {
  if (!raw?.length) return null;
  const r = raw[0];
  const actions = r.actions ?? [];
  const leads =
    actions.find(
      (a: any) =>
        a.action_type === "lead" ||
        a.action_type === "onsite_conversion.lead_grouped",
    )?.value ?? "0";
  const messages =
    actions.find(
      (a: any) =>
        a.action_type ===
        "onsite_conversion.messaging_conversation_started_7d",
    )?.value ?? "0";

  const cpat = r.cost_per_action_type ?? [];
  const costPerResult =
    objective === "MESSAGES"
      ? cpat.find(
          (a: any) =>
            a.action_type ===
            "onsite_conversion.messaging_conversation_started_7d",
        )?.value ?? null
      : cpat.find((a: any) => a.action_type === "lead")?.value ?? null;

  return {
    impressions: parseInt(r.impressions ?? "0"),
    reach: parseInt(r.reach ?? "0"),
    clicks: parseInt(r.clicks ?? "0"),
    spend: parseFloat(r.spend ?? "0"),
    cpm: parseFloat(r.cpm ?? "0"),
    cpc: parseFloat(r.cpc ?? "0"),
    ctr: parseFloat(r.ctr ?? "0"),
    leads: parseInt(leads),
    messages_started: parseInt(messages),
    cost_per_result: costPerResult ? parseFloat(costPerResult) : null,
    date_start: r.date_start ?? null,
    date_stop: r.date_stop ?? null,
    currency: "MXN",
  };
}

function decryptToken(encrypted: string): string {
  const salt = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").slice(0, 16);
  try {
    const decoded = atob(encrypted);
    return decoded.replace(`${salt}::`, "");
  } catch {
    return "";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: { user }, error: authError } =
      await admin.auth.getUser(token);
    if (authError || !user) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = user.id;

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.tenant_id) {
      return json({ error: "Usuario sin tenant asociado" }, 403);
    }
    const tenantId = profile.tenant_id;

    const { data: roleRow } = await admin
      .from("user_roles")
      .select("tenant_role, global_role")
      .eq("user_id", userId)
      .maybeSingle();
    const isSuperAdmin = roleRow?.global_role === "super_admin";
    const tenantRole = roleRow?.tenant_role;
    if (
      !isSuperAdmin &&
      tenantRole !== "administrador" &&
      tenantRole !== "manager"
    ) {
      return json({ error: "No tienes permisos para ver métricas de Meta Ads" }, 403);
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.scope || (body.scope !== "campaign" && body.scope !== "summary")) {
      return json({ error: "scope inválido" }, 400);
    }

    const { data: connection } = await admin
      .from("meta_ads_connections")
      .select("access_token_encrypted, ad_account_id")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .maybeSingle();

    if (!connection?.access_token_encrypted) {
      return json({ error: "No hay cuenta de Meta Ads conectada" }, 400);
    }

    const accessToken = decryptToken(connection.access_token_encrypted);
    if (!accessToken) {
      return json({ error: "No se pudo descifrar el token de acceso" }, 400);
    }

    const timeParams = buildTimeRange(body);

    if (body.scope === "campaign") {
      if (!body.campaign_id) {
        return json({ error: "campaign_id requerido" }, 400);
      }
      const { data: campaign } = await admin
        .from("meta_ads_campaigns")
        .select("meta_campaign_id, meta_adset_id, name, campaign_objective")
        .eq("id", body.campaign_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (!campaign?.meta_campaign_id) {
        return json({ error: "Campaña no publicada en Meta" }, 400);
      }

      const params = new URLSearchParams({
        fields: INSIGHT_FIELDS,
        access_token: accessToken,
        level: "campaign",
        ...timeParams,
      });
      const res = await fetch(
        `${META_API}/${campaign.meta_campaign_id}/insights?${params}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.error) {
        return json({
          campaign_id: body.campaign_id,
          meta_campaign_id: campaign.meta_campaign_id,
          objective: campaign.campaign_objective,
          insights: null,
          error: data?.error?.message ?? `HTTP ${res.status}`,
        });
      }

      return json({
        campaign_id: body.campaign_id,
        meta_campaign_id: campaign.meta_campaign_id,
        objective: campaign.campaign_objective,
        insights: parseInsights(data.data, campaign.campaign_objective ?? ""),
      });
    }

    // scope === 'summary'
    const { data: campaigns } = await admin
      .from("meta_ads_campaigns")
      .select("id, meta_campaign_id, name, campaign_objective, status")
      .eq("tenant_id", tenantId)
      .in("status", ["active", "paused"])
      .not("meta_campaign_id", "is", null);

    const list = campaigns ?? [];

    const results = await Promise.allSettled(
      list.map(async (c) => {
        const params = new URLSearchParams({
          fields: SUMMARY_FIELDS,
          access_token: accessToken,
          level: "campaign",
          ...timeParams,
        });
        const res = await fetch(
          `${META_API}/${c.meta_campaign_id}/insights?${params}`,
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok || data?.error) {
          return {
            campaign_id: c.id,
            name: c.name,
            objective: c.campaign_objective,
            status: c.status,
            insights: null,
          };
        }
        return {
          campaign_id: c.id,
          name: c.name,
          objective: c.campaign_objective,
          status: c.status,
          insights: parseInsights(data.data, c.campaign_objective ?? ""),
        };
      }),
    );

    const summaries = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<any>).value);

    const totals = summaries.reduce(
      (acc, s) => {
        if (!s.insights) return acc;
        return {
          impressions: acc.impressions + s.insights.impressions,
          clicks: acc.clicks + s.insights.clicks,
          spend: acc.spend + s.insights.spend,
          leads: acc.leads + s.insights.leads,
          messages_started: acc.messages_started + s.insights.messages_started,
        };
      },
      { impressions: 0, clicks: 0, spend: 0, leads: 0, messages_started: 0 },
    );

    return json({ campaigns: summaries, totals });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error inesperado";
    return json({ error: msg }, 500);
  }
});