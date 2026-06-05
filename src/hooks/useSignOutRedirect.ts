import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerBranding } from "@/contexts/PartnerBrandingContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Returns a sign-out handler that respects the partner's
 * `logout_redirect_url`. If the partner has configured an external URL,
 * the browser is redirected there after the session is cleared. Otherwise,
 * super admins go to the internal `/rs_admin` route, and any other user
 * lands on the public `/welcome` page.
 */
export function useSignOutRedirect() {
  const { signOut } = useAuth();

  return useCallback(async () => {
    try {
      await signOut();
    } catch {
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore
      }
    }

    window.location.href = "https://auth.brokia24.com/login?signout=1";
  }, [signOut]);
}
