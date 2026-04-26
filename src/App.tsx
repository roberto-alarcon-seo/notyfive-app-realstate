import { useEffect } from "react";
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
import { MainLayout } from "@/components/layout/MainLayout";
import { MobileRouteGuard } from "@/components/layout/MobileRouteGuard";
import { useAuth } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Inbox from "./pages/Inbox";
import Contacts from "./pages/Contacts";
import ContactEditor from "./pages/ContactEditor";
import Segments from "./pages/Segments";
import SegmentEditor from "./pages/SegmentEditor";
import Templates from "./pages/Templates";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import CampaignAssistantBuilder from "./pages/CampaignAssistantBuilder";
import Assistant from "./pages/Assistant";
import Automations from "./pages/Automations";
import AutomationEditor from "./pages/AutomationEditor";
import Events from "./pages/Events";
import AutomationRuns from "./pages/AutomationRuns";
import Pipeline from "./pages/Pipeline";
import { toast } from "sonner";
import SettingsCompany from "./pages/settings/SettingsCompany";
import SettingsWhatsAppStatus from "./pages/settings/SettingsWhatsAppStatus";
import SettingsUsersPage from "./pages/settings/SettingsUsersPage";
import SettingsContactFieldsPage from "./pages/settings/SettingsContactFieldsPage";
import SettingsApi from "./pages/settings/SettingsApi";
import SettingsBilling from "./pages/settings/SettingsBilling";
import SettingsNotifications from "./pages/settings/SettingsNotifications";
import SettingsAIConfig from "./pages/settings/SettingsAIConfig";
import SettingsKnowledgeBase from "./pages/settings/SettingsKnowledgeBase";
import KnowledgeBaseEditor from "./pages/settings/KnowledgeBaseEditor";
import SettingsDeveloper from "./pages/settings/SettingsDeveloper";
import SettingsConsentPage from "./pages/settings/SettingsConsentPage";
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
import ApiDocs from "./pages/developers/ApiDocs";
import Followups from "./pages/Followups";
import Support from "./pages/Support";
import SettingsSecurity from "./pages/settings/SettingsSecurity";
import SettingsConversions from "./pages/settings/SettingsConversions";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <PartnerBrandingProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <RecoveryHashRedirector />
          <AuthProvider>
            <SupportModeProvider>
            <MobileRouteGuard>
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
              <Route path="/admin/users" element={<ProtectedRoute requireSuperAdmin><PartnerScopedAdminGuard><AdminUsers /></PartnerScopedAdminGuard></ProtectedRoute>} />
              <Route path="/admin/logs" element={<ProtectedRoute requireSuperAdmin><PartnerScopedAdminGuard><AdminLogs /></PartnerScopedAdminGuard></ProtectedRoute>} />
              <Route path="/admin/partner-settings" element={<ProtectedRoute requireSuperAdmin><PartnerSettings /></ProtectedRoute>} />
              <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
              <Route path="/inbox" element={<ProtectedRoute><MainLayout><Inbox /></MainLayout></ProtectedRoute>} />
              <Route path="/contacts" element={<ProtectedRoute><MainLayout><Contacts /></MainLayout></ProtectedRoute>} />
              <Route path="/contacts/new" element={<ProtectedRoute><MainLayout><ContactEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/contacts/:id" element={<ProtectedRoute><MainLayout><ContactEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/segments" element={<ProtectedRoute><MainLayout><Segments /></MainLayout></ProtectedRoute>} />
              <Route path="/segments/new" element={<ProtectedRoute><MainLayout><SegmentEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/segments/:id" element={<ProtectedRoute><MainLayout><SegmentEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/templates" element={<ProtectedRoute><MainLayout><Templates /></MainLayout></ProtectedRoute>} />
              <Route path="/campaigns" element={<ProtectedRoute><MainLayout><Campaigns /></MainLayout></ProtectedRoute>} />
              <Route path="/campaigns/new/assistant" element={<ProtectedRoute><CampaignAssistantBuilder /></ProtectedRoute>} />
              <Route path="/campaigns/:id" element={<ProtectedRoute><MainLayout><CampaignDetail /></MainLayout></ProtectedRoute>} />
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
              <Route path="/automations" element={<ProtectedRoute><MainLayout><Automations /></MainLayout></ProtectedRoute>} />
              <Route path="/automations/new" element={<ProtectedRoute><MainLayout><AutomationEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/automations/:id" element={<ProtectedRoute><MainLayout><AutomationEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/automations/:id/runs" element={<ProtectedRoute><MainLayout><AutomationRuns /></MainLayout></ProtectedRoute>} />
              {/* Settings routes */}
              <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsCompany /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/whatsapp" element={<ProtectedRoute><MainLayout><SettingsWhatsAppStatus /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/consent" element={<ProtectedRoute><MainLayout><SettingsConsentPage /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/users" element={<ProtectedRoute><MainLayout><SettingsUsersPage /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/contact-fields" element={<ProtectedRoute><MainLayout><SettingsContactFieldsPage /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/api" element={<ProtectedRoute><MainLayout><SettingsApi /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/billing" element={<ProtectedRoute><MainLayout><SettingsBilling /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/notifications" element={<ProtectedRoute><MainLayout><SettingsNotifications /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/ai-config" element={<ProtectedRoute><MainLayout><SettingsAIConfig /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/knowledge-base" element={<ProtectedRoute><MainLayout><SettingsKnowledgeBase /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/knowledge-base/new" element={<ProtectedRoute><MainLayout><KnowledgeBaseEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/knowledge-base/:id" element={<ProtectedRoute><MainLayout><KnowledgeBaseEditor /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/developer" element={<ProtectedRoute><MainLayout><SettingsDeveloper /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/security" element={<ProtectedRoute><MainLayout><SettingsSecurity /></MainLayout></ProtectedRoute>} />
              <Route path="/settings/conversions" element={<ProtectedRoute><MainLayout><SettingsConversions /></MainLayout></ProtectedRoute>} />
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
            </MobileRouteGuard>
            </SupportModeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </PartnerBrandingProvider>
  </QueryClientProvider>
);

export default App;
