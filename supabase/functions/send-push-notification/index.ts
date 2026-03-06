import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Utility helpers ────────────────────────────────────────────────
function base64UrlDecode(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob(base64 + padding);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function base64UrlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ─── VAPID JWT ──────────────────────────────────────────────────────
async function createVapidJwt(
  audience: string,
  subject: string,
  publicKeyB64: string,
  privateKeyB64: string
): Promise<{ authorization: string; cryptoKey: string }> {
  const header = base64UrlEncode(
    new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" }))
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = base64UrlEncode(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + 86400, sub: subject })
    )
  );
  const unsignedToken = `${header}.${payload}`;

  // Import the private key as ECDSA P-256
  const rawPrivate = base64UrlDecode(privateKeyB64);
  // Build JWK from raw 32-byte private key + public key coordinates
  const rawPublic = base64UrlDecode(publicKeyB64);
  // rawPublic is 65 bytes: 0x04 || x (32) || y (32)
  const x = base64UrlEncode(rawPublic.slice(1, 33));
  const y = base64UrlEncode(rawPublic.slice(33, 65));
  const d = base64UrlEncode(rawPrivate);

  const jwk = { kty: "EC", crv: "P-256", x, y, d };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(unsignedToken)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sigBytes = new Uint8Array(signature);
  let rawSig: Uint8Array;
  if (sigBytes.length === 64) {
    rawSig = sigBytes;
  } else {
    // Web Crypto returns raw r||s on most platforms
    rawSig = sigBytes;
  }

  const token = `${unsignedToken}.${base64UrlEncode(rawSig)}`;

  return {
    authorization: `WebPush ${token}`,
    cryptoKey: `p256ecdsa=${publicKeyB64}`,
  };
}

// ─── Payload Encryption (RFC 8291 / aes128gcm) ─────────────────────
async function encryptPayload(
  payload: string,
  p256dhB64: string,
  authB64: string
): Promise<{ encrypted: Uint8Array; salt: Uint8Array; localPublicKey: Uint8Array }> {
  const clientPublicKeyBytes = base64UrlDecode(p256dhB64);
  const authSecret = base64UrlDecode(authB64);
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate local ECDH key pair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import client public key
  const clientPublicKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKeyBytes,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientPublicKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF to derive IKM from auth secret
  const authInfo = concat(
    new TextEncoder().encode("WebPush: info\0"),
    clientPublicKeyBytes,
    localPublicKeyRaw
  );
  const ikm = await hkdfDerive(authSecret, sharedSecret, authInfo, 32);

  // Derive content encryption key and nonce
  const cekInfo = new TextEncoder().encode("Content-Encoding: aes128gcm\0");
  const nonceInfo = new TextEncoder().encode("Content-Encoding: nonce\0");
  const contentKey = await hkdfDerive(salt, ikm, cekInfo, 16);
  const nonce = await hkdfDerive(salt, ikm, nonceInfo, 12);

  // Pad payload (add delimiter 0x02 + zero padding)
  const paddedPayload = concat(payloadBytes, new Uint8Array([2]));

  // Encrypt with AES-128-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  // Build aes128gcm header: salt (16) + rs (4) + idlen (1) + keyid (65)
  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, 4096);
  const header = concat(
    salt,
    rs,
    new Uint8Array([localPublicKeyRaw.length]),
    localPublicKeyRaw
  );

  return {
    encrypted: concat(header, ciphertext),
    salt,
    localPublicKey: localPublicKeyRaw,
  };
}

async function hkdfDerive(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    ikm,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const prk = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, salt)
  );

  // Actually HKDF: extract then expand
  const prkKey = await crypto.subtle.importKey(
    "raw",
    salt.length > 0 ? salt : new Uint8Array(32),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const extract = new Uint8Array(
    await crypto.subtle.sign("HMAC", prkKey, ikm)
  );

  const expandKey = await crypto.subtle.importKey(
    "raw",
    extract,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expanded = new Uint8Array(
    await crypto.subtle.sign("HMAC", expandKey, concat(info, new Uint8Array([1])))
  );

  return expanded.slice(0, length);
}

// ─── Main handler ───────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject =
      Deno.env.get("VAPID_SUBJECT") || "mailto:admin@brokia24.com";
    const supabase = createClient(supabaseUrl, serviceKey);

    const { tenant_id, title, body, url, badge_count, exclude_user_id } =
      await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let query = supabase
      .from("push_subscriptions")
      .select("*")
      .eq("tenant_id", tenant_id);

    if (exclude_user_id) {
      query = query.neq("user_id", exclude_user_id);
    }

    const { data: subscriptions, error } = await query;
    if (error) throw error;

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No subscriptions" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = JSON.stringify({
      title: title || "Nuevo mensaje recibido",
      body: body || "Tienes un nuevo mensaje de un cliente",
      url: url || "/inbox",
      badge_count: badge_count || 1,
    });

    const results: Array<{
      endpoint: string;
      status?: number;
      error?: string;
    }> = [];

    for (const sub of subscriptions) {
      try {
        const audience = new URL(sub.endpoint).origin;

        // Create VAPID auth headers
        const vapid = await createVapidJwt(
          audience,
          vapidSubject,
          vapidPublicKey,
          vapidPrivateKey
        );

        // Encrypt payload
        const { encrypted } = await encryptPayload(
          payload,
          sub.p256dh,
          sub.auth
        );

        const pushResponse = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Encoding": "aes128gcm",
            TTL: "86400",
            Authorization: vapid.authorization,
            "Crypto-Key": vapid.cryptoKey,
          },
          body: encrypted,
        });

        results.push({ endpoint: sub.endpoint, status: pushResponse.status });

        if (pushResponse.status === 404 || pushResponse.status === 410) {
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          console.log(`🗑️ Removed expired subscription`);
        } else if (pushResponse.status !== 201 && pushResponse.status !== 200) {
          const errText = await pushResponse.text();
          console.warn(`⚠️ Push status ${pushResponse.status}: ${errText}`);
        }
      } catch (err) {
        console.error(`Push error:`, err);
        results.push({ endpoint: sub.endpoint, error: String(err) });
      }
    }

    const successCount = results.filter(
      (r) => r.status === 201 || r.status === 200
    ).length;
    console.log(`📤 Push: ${successCount}/${results.length} delivered`);

    return new Response(
      JSON.stringify({ sent: results.length, success: successCount, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("❌ Push notification error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
