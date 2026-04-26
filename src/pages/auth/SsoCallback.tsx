import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * /auth/sso?token=<JWT>&redirect=<optional path>
 *
 * This page acts as a loading screen. It forwards the token to the
 * `auth-sso` Edge Function, which validates the JWT (issued by the Core
 * system) and 302-redirects to a Supabase magic link that establishes the
 * session. If the user already has an active session, we skip the round-trip.
 */
const SsoCallback = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const startedRef = useRef(false);
  const [statusText, setStatusText] = useState("Validando tu acceso desde el sistema Core.");

  const token = params.get("token");
  const redirect = params.get("redirect") || "/";
  const mode = params.get("mode") || "";

  useEffect(() => {
    if (startedRef.current) return;

    if (!token) {
      navigate("/welcome?error=sso_denied&reason=missing_token", { replace: true });
      return;
    }

    startedRef.current = true;

    (async () => {
      try {
        // CRITICAL: Always sign out the current session before starting the SSO
        // flow. Otherwise the existing session (e.g. a super_admin) survives
        // the magic-link redirect and the user lands back in the admin area.
        if (mode === "impersonation") {
          sessionStorage.setItem("noty5_admin_impersonation", "1");
        } else {
          sessionStorage.removeItem("noty5_admin_impersonation");
        }

        setStatusText("Cerrando sesión actual…");
        try {
          await supabase.auth.signOut();
        } catch {
          /* ignore — may already be invalidated */
        }

        setStatusText("Validando tu acceso desde el sistema Core.");
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const ssoUrl = new URL(
          `https://${projectId}.supabase.co/functions/v1/auth-sso`,
        );
        ssoUrl.searchParams.set("token", token);
        ssoUrl.searchParams.set("redirect", redirect);
        if (mode) {
          ssoUrl.searchParams.set("mode", mode);
        }

        // Full-page navigation: the Edge Function responds with a 302 to the
        // Supabase magic link, which redirects back to `redirect` with a
        // valid session in the URL hash.
        window.location.replace(ssoUrl.toString());
      } catch (err) {
        console.error("SsoCallback failed", err);
        navigate("/welcome?error=sso_denied&reason=client_error", { replace: true });
      }
    })();
  }, [token, redirect, mode, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Iniciando sesión segura…
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {statusText}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SsoCallback;
