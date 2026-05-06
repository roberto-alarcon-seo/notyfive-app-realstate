import { useEffect, lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import AutomationWizard from "@/pages/AutomationWizard";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { SupportModeProvider } from "@/contexts/SupportModeContext";
import { PartnerBrandingProvider } from "@/contexts/PartnerBrandingContext";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { FeatureFlagGuard } from "@/components/auth/FeatureFlagGuard";
import { PartnerThemeSync } from "@/components/PartnerThemeSync";
import { MainLayout } from "@/components/layout/MainLayout";
import { MobileRouteGuard } from "@/components/layout/MobileRouteGuard";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import ContactEditor from "./pages/ContactEditor";
// Lazy-loaded heavy modules (code splitting) — reduces initial bundle size
const Segments = lazy(() => import("./pages/Segments"));
const SegmentEditor = lazy(() => import("./pages/SegmentEditor"));
import Templates from "./pages/Templates";
const Campaigns = lazy(() => import("./pages/Campaigns"));
const CampaignDetail = lazy(() => import("./pages/CampaignDetail"));
const CampaignAssistantBuilder = lazy(() => import("./pages/CampaignAssistantBuilder"));
import Assistant from "./pages/Assistant";
const Automations = lazy(() => import("./pages/Automations"));
const AutomationEditor = lazy(() => import("./pages/AutomationEditor"));
import Events from "./pages/Events";
const AutomationRuns = lazy(() => import("./pages/AutomationRuns"));
import Pipeline from "./pages/Pipeline";
import { toast } from "sonner";
import SettingsWhatsAppStatus from "./pages/settings/SettingsWhatsAppStatus";
import SettingsContactFieldsPage from "./pages/settings/SettingsContactFieldsPage";
import SettingsNotifications from "./pages/settings/SettingsNotifications";
import SettingsAIConfig from "./pages/settings/SettingsAIConfig";
import SettingsKnowledgeBase from "./pages/settings/SettingsKnowledgeBase";
import KnowledgeBaseEditor from "./pages/settings/KnowledgeBaseEditor";
import SettingsDeveloper from "./pages/settings/SettingsDeveloper";
import SettingsConsentPage from "./pages/settings/SettingsConsentPage";
import SettingsQuickAutomations from "./pages/settings/SettingsQuickAutomations";
import SettingsAssignmentRules from "./pages/settings/SettingsAssignmentRules";
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import CompleteSignup from "./pages/auth/CompleteSignup";
import SsoCallback from "./pages/auth/SsoCallback";
import Landing from "./pages/Landing";
import Admin from "./pages/Admin";
import AdminTenants from "./pages/admin/AdminTenants";
import TenantAdminDetail from "./pages/admin/TenantAdminDetail";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminLogs from "./pages/admin/AdminLogs";
import PartnerSettings from "./pages/admin/PartnerSettings";
import PartnerSuperWallet from "./pages/admin/PartnerSuperWallet";
import PartnerDetail from "./pages/admin/PartnerDetail";
import AdminPartners from "./pages/admin/AdminPartners";
import MasterTemplates from "./pages/admin/MasterTemplates";
import ApiDocs from "./pages/developers/ApiDocs";
import Followups from "./pages/Followups";
import Support from "./pages/Support";
import SettingsConversions from "./pages/settings/SettingsConversions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep tenant/config-style data fresh for 5 min and avoid aggressive refetching
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const RouteFallback = () => (
  <div className="flex items-center justify-center h-[60vh] text-muted-foreground text-sm">
    Cargando...
  </div>
);

const RecoveryHashRedirector = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const hash = location.hash || "";
    const isRecovery = hash.includes("type=recovery");

    if (isRecovery && location.pathname !== "/auth/complete-signup") {
      navigate(
        { pathname: "/auth/complete-signup", hash },
        { replace: true }
      );
    }
  }, [location.hash, location.pathname, navigate]);

  return null;
};

// Tenants no longer manage inventory locally — it's synced from Brokia24 Core.
const PropertiesRedirect = () => {
  useEffect(() => {
    toast.info("El inventario es gestionado desde Brokia24 Core");
  }, []);
  return <Navigate to="/" replace />;
};

// Restricts global-admin-only routes (Users, Logs) when the logged super admin
// has a partner_scope. Partner-scoped admins are bounced to /admin/tenants.
const PartnerScopedAdminGuard = ({ children }: { children: JSX.Element }) => {
  const { partnerScope, isLoading } = useAuth();
  useEffect(() => {
    if (!isLoading && partnerScope) {
      toast.error("Acceso denegado: esta sección está reservada al Super Admin Global.");
    }
  }, [isLoading, partnerScope]);
  if (isLoading) return null;
  if (partnerScope) return <Navigate to="/admin/tenants" replace />;
  return children;
};

// Legacy /admin/partner-settings → unified Partner Detail page.
// Partner-scoped admins go to their own partner; global admins to the list.
const PartnerSettingsRedirect = () => {
  const { partnerScope, isLoading } = useAuth();
  if (isLoading) return null;
  if (partnerScope) return <Navigate to={`/admin/partners/${partnerScope}`} replace />;
  return <Navigate to="/admin/partners" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PartnerBrandingProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RecoveryHashRedirector />
          <AuthProvider>
            <PartnerThemeSync />
            <SupportModeProvider>
            <MobileRouteGuard>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public landing for unauthenticated tenant users */}
              <Route path="/welcome" element={<Landing />} />
              {/* Admin login (super_admin only) */}
              <Route path="/rs_admin" element={<Auth />} />
              {/* Legacy /auth redirects to admin login */}
              <Route path="/auth" element={<Navigate to="/rs_admin" replace />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/reset-password" element={<ResetPassword />} />
              <Route path="/auth/complete-signup" element={<CompleteSignup />} />
              <Route path="/auth/sso" element={<SsoCallback />} />
              <Route path="/admin" element={<Navigate to="/admin/tenants" replace />} />
              <Route path="/admin/tenants" element={<ProtectedRoute requireSuperAdmin><AdminTenants /></ProtectedRoute>} />
              <Route path="/admin/tenants/:id" element={<ProtectedRoute requireSuperAdmin><TenantAdminDetail /></ProtectedRoute>} />
              <Route path="/admin/partners" element={<ProtectedRoute requireSuperAdmin><PartnerScopedAdminGuard><AdminPartners /></PartnerScopedAdminGuard></ProtectedRoute>} />
              <Route path="/admin/partners/:partnerId" element={<ProtectedRoute requireSuperAdmin><PartnerDetail /></ProtectedRoute>} />
              <Route path="/admin/users" element={<ProtectedRoute requireSuperAdmin><PartnerScopedAdminGuard><AdminUsers /></PartnerScopedAdminGuard></ProtectedRoute>} />
              <Route path="/admin/logs" element={<ProtectedRoute requireSuperAdmin><PartnerScopedAdminGuard><AdminLogs /></PartnerScopedAdminGuard></ProtectedRoute>} />
              <Route path="/admin/partner-settings" element={<ProtectedRoute requireSuperAdmin><PartnerSettingsRedirect /></ProtectedRoute>} />
              <Route path="/admin/super-wallet" element={<ProtectedRoute requireSuperAdmin><PartnerSuperWallet /></ProtectedRoute>} />
              <Route path="/admin/master-templates" element={<ProtectedRoute requireSuperAdmin><PartnerScopedAdminGuard><MasterTemplates /></PartnerScopedAdminGuard></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><MainLayout><Inbox /></MainLayout></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><MainLayout><Contacts /></MainLayout></ProtectedRoute>} />
              <Route path="/contacts/new" element={<ProtectedRoute><MainLayout><ContactEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/contacts/:id" element={<ProtectedRoute><MainLayout><ContactEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/segments" element={<ProtectedRoute><FeatureFlagGuard feature="segments"><MainLayout><Segments /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/segments/new" element={<ProtectedRoute><FeatureFlagGuard feature="segments"><MainLayout><SegmentEditor /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/segments/:id" element={<ProtectedRoute><FeatureFlagGuard feature="segments"><MainLayout><SegmentEditor /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              {/* Legacy /templates route — canonical location is /settings/templates */}
              <Route path="/templates" element={<Navigate to="/settings/templates" replace />} />
              <Route path="/campaigns" element={<ProtectedRoute><FeatureFlagGuard feature="campaigns"><MainLayout><Campaigns /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/campaigns/new/assistant" element={<ProtectedRoute><FeatureFlagGuard feature="campaigns"><CampaignAssistantBuilder /></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/campaigns/:id" element={<ProtectedRoute><FeatureFlagGuard feature="campaigns"><MainLayout><CampaignDetail /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/assistant" element={<ProtectedRoute><MainLayout><Assistant /></MainLayout></ProtectedRoute>} />
              {/* Followups route */}
              <Route path="/followups" element={<ProtectedRoute><Followups /></ProtectedRoute>} />
              {/* Support route */}
              <Route path="/support" element={<ProtectedRoute><Support /></ProtectedRoute>} />
              {/* Events route */}
              <Route path="/events" element={<ProtectedRoute><MainLayout><Events /></MainLayout></ProtectedRoute>} />
              {/* Pipeline Kanban route */}
              <Route path="/pipeline" element={<ProtectedRoute><MainLayout><Pipeline /></MainLayout></ProtectedRoute>} />
              {/* Automations routes */}
              <Route path="/automations" element={<ProtectedRoute><FeatureFlagGuard feature="automations_builder"><MainLayout><Automations /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/automations/new" element={<ProtectedRoute><FeatureFlagGuard feature="automations_builder"><MainLayout><AutomationEditor /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/automations/:id" element={<ProtectedRoute><FeatureFlagGuard feature="automations_builder"><MainLayout><AutomationEditor /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              <Route path="/automations/:id/runs" element={<ProtectedRoute><FeatureFlagGuard feature="automations_builder"><MainLayout><AutomationRuns /></MainLayout></FeatureFlagGuard></ProtectedRoute>} />
              {/* Settings routes */}
              <Route path="/settings" element={<Navigate to="/settings/whatsapp" replace />} />
              <Route path="/settings/whatsapp" element={<ProtectedRoute><MainLayout><SettingsWhatsAppStatus /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/consent" element={<ProtectedRoute><MainLayout><SettingsConsentPage /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/contact-fields" element={<ProtectedRoute><MainLayout><SettingsContactFieldsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/notifications" element={<ProtectedRoute><MainLayout><SettingsNotifications /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/ai-config" element={<ProtectedRoute><MainLayout><SettingsAIConfig /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/knowledge-base" element={<ProtectedRoute><MainLayout><SettingsKnowledgeBase /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/knowledge-base/new" element={<ProtectedRoute><MainLayout><KnowledgeBaseEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/knowledge-base/:id" element={<ProtectedRoute><MainLayout><KnowledgeBaseEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/developer" element={<ProtectedRoute><MainLayout><SettingsDeveloper /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/conversions" element={<ProtectedRoute><MainLayout><SettingsConversions /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/quick-automations" element={<ProtectedRoute><MainLayout><SettingsQuickAutomations /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/assignment-rules" element={<ProtectedRoute requireRoles={["administrador"]}><MainLayout><SettingsAssignmentRules /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/templates" element={<ProtectedRoute><MainLayout><Templates /></MainLayout></ProtectedRoute>} />
              {/* Redirects for removed sections */}
              <Route path="/settings/users" element={<Navigate to="/settings/whatsapp" replace />} />
              <Route path="/settings/billing" element={<Navigate to="/settings/whatsapp" replace />} />
              <Route path="/settings/security" element={<Navigate to="/settings/whatsapp" replace />} />
              <Route path="/settings/api" element={<Navigate to="/settings/developer" replace />} />
              {/* Properties routes */}
              <Route path="/properties" element={<PropertiesRedirect />} />
              <Route path="/properties/:id" element={<PropertiesRedirect />} />
              {/* Developer docs (public-style page, no sidebar) */}
              <Route path="/developers/api" element={<ProtectedRoute><ApiDocs /></ProtectedRoute>} />
              {/* Redirect old integration routes */}
              <Route path="/settings/integrations" element={<Navigate to="/settings/whatsapp" replace />} />
              <Route path="/settings/whatsapp-twilio" element={<Navigate to="/settings/whatsapp" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
            </MobileRouteGuard>
            </SupportModeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PartnerBrandingProvider>
  </QueryClientProvider>
);

export default App;
