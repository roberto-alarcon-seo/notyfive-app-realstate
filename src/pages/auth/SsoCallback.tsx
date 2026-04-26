import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user, isLoading } = useAuth();
  const startedRef = useRef(false);

  const token = params.get("token");
  const redirect = params.get("redirect") || "/";

  useEffect(() => {
    if (startedRef.current) return;

    if (!token) {
      navigate("/auth?error=sso_denied&reason=missing_token", { replace: true });
      return;
    }

    // Wait until the auth provider has resolved before deciding what to do.
    if (isLoading) return;

    // If a session already exists, skip the SSO round-trip and refresh state.
    if (user) {
      startedRef.current = true;
      navigate(redirect, { replace: true });
      return;
    }

    startedRef.current = true;
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const ssoUrl = new URL(
      `https://${projectId}.supabase.co/functions/v1/auth-sso`,
    );
    ssoUrl.searchParams.set("token", token);
    ssoUrl.searchParams.set("redirect", redirect);

    // Full-page navigation: the Edge Function will respond with a 302 to the
    // Supabase magic link, which in turn redirects back to `redirect` with a
    // valid session in the URL hash.
    window.location.replace(ssoUrl.toString());
  }, [token, redirect, user, isLoading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Iniciando sesión segura…
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Validando tu acceso desde el sistema Core.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SsoCallback;
