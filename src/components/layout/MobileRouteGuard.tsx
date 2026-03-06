import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

const MOBILE_ALLOWED_PATHS = [
  "/",
  "/inbox",
  "/followups",
  "/events",
  "/contacts",
  "/auth",
  "/admin",
  "/support",
];

interface MobileRouteGuardProps {
  children: ReactNode;
}

export function MobileRouteGuard({ children }: MobileRouteGuardProps) {
  const isMobile = useIsMobile();
  const location = useLocation();

  if (!isMobile) return <>{children}</>;

  const isAllowed = MOBILE_ALLOWED_PATHS.some((path) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  });

  if (!isAllowed) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
