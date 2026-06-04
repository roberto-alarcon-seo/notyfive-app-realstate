import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  MessageCircle,
  GitBranch,
  Users,
  Calendar,
  Bell,
  Megaphone,
  Filter,
  Bot,
  Sparkles,
  FileText,
  Building2,
  Eye,
  Headphones,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTotalUnreadCount } from "@/hooks/useTotalUnreadCount";
import { useFollowupBadgeCount } from "@/hooks/useFollowupBadgeCount";
import { useAtRiskBadgeCount } from "@/hooks/useAtRiskBadgeCount";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerBranding } from "@/contexts/PartnerBrandingContext";
import { useFeatureFlag, type FeatureName } from "@/hooks/useFeatureFlag";
import { cn } from "@/lib/utils";

type Role = "asesor" | "manager" | "administrador";

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  roles: Role[];
  feature?: FeatureName;
  badgeKey?: "inbox" | "followups" | "atRisk";
};

type NavGroup = {
  key: string;
  label: string;
  roles: Role[];
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    key: "general",
    label: "General",
    roles: ["manager", "administrador"],
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/", roles: ["manager", "administrador"] },
    ],
  },
  {
    key: "comunicacion",
    label: "Comunicación",
    roles: ["asesor", "manager", "administrador"],
    items: [
      { icon: MessageCircle, label: "Inbox", path: "/inbox", roles: ["asesor", "manager", "administrador"], badgeKey: "inbox" },
      { icon: GitBranch, label: "Pipeline", path: "/pipeline", roles: ["asesor", "manager", "administrador"] },
      { icon: Users, label: "Contactos", path: "/contacts", roles: ["asesor", "manager", "administrador"] },
      { icon: Calendar, label: "Citas", path: "/events", roles: ["asesor", "manager", "administrador"] },
      { icon: Bell, label: "Seguimientos", path: "/followups", roles: ["asesor", "manager", "administrador"], badgeKey: "followups" },
    ],
  },
  {
    key: "marketing",
    label: "Marketing",
    roles: ["manager", "administrador"],
    items: [
      { icon: Megaphone, label: "Campañas", path: "/campaigns", roles: ["manager", "administrador"], feature: "campaigns" },
      { icon: Filter, label: "Segmentos", path: "/segments", roles: ["manager", "administrador"], feature: "segments" },
      { icon: Bot, label: "Automatizaciones", path: "/automations", roles: ["manager", "administrador"], feature: "automations_builder" },
      { icon: Sparkles, label: "Meta Ads", path: "/meta-ads", roles: ["manager", "administrador"], feature: "meta_ads" },
      { icon: FileText, label: "Plantillas", path: "/templates", roles: ["manager", "administrador"], feature: "templates_library" },
    ],
  },
  {
    key: "supervision",
    label: "Supervisión",
    roles: ["manager", "administrador"],
    items: [
      { icon: Building2, label: "Asesores por propiedad", path: "/inventory-assignments", roles: ["manager", "administrador"] },
      { icon: Eye, label: "Supervisión de leads", path: "/admin-leads", roles: ["manager", "administrador"], badgeKey: "atRisk" },
    ],
  },
  {
    key: "soporte",
    label: "Soporte",
    roles: ["manager", "administrador"],
    items: [
      { icon: Headphones, label: "Soporte", path: "/support", roles: ["manager", "administrador"] },
    ],
  },
];

const COLLAPSE_KEY = "brokia_sidebar_collapsed";

export function IconSidebar() {
  const totalUnread = useTotalUnreadCount();
  const followupBadge = useFollowupBadgeCount();
  const atRiskBadge = useAtRiskBadgeCount();
  const { tenantRole, isSuperAdmin } = useAuth();
  const { partner } = usePartnerBranding();

  const { enabled: campaignsEnabled } = useFeatureFlag("campaigns");
  const { enabled: segmentsEnabled } = useFeatureFlag("segments");
  const { enabled: automationsEnabled } = useFeatureFlag("automations_builder");
  const { enabled: templatesEnabled } = useFeatureFlag("templates_library");
  const { enabled: metaAdsEnabled } = useFeatureFlag("meta_ads");

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  const role: Role | null = isSuperAdmin
    ? "administrador"
    : (tenantRole as Role | null);

  const featureEnabled: Partial<Record<FeatureName, boolean>> = {
    campaigns: campaignsEnabled,
    segments: segmentsEnabled,
    automations_builder: automationsEnabled,
    templates_library: templatesEnabled,
    meta_ads: metaAdsEnabled,
  };

  const badgeCounts: Record<string, number> = {
    inbox: totalUnread,
    followups: followupBadge,
    atRisk: atRiskBadge,
  };

  const itemVisible = (item: NavItem) => {
    if (!role || !item.roles.includes(role)) return false;
    if (item.feature && !featureEnabled[item.feature]) return false;
    return true;
  };

  const visibleGroups = groups
    .map((g) => ({ ...g, items: g.items.filter(itemVisible) }))
    .filter((g) => g.items.length > 0 && (!role || g.roles.includes(role)));

  const isAdmin = role === "administrador";

  const renderItem = (item: NavItem) => {
    const count = item.badgeKey ? badgeCounts[item.badgeKey] ?? 0 : 0;
    const link = (
      <NavLink
        to={item.path}
        end={item.path === "/"}
        className={cn(
          "flex items-center rounded-lg text-[#9ca3af] hover:text-primary hover:bg-primary/10 transition-colors relative",
          collapsed ? "w-10 h-10 justify-center mx-auto" : "w-full h-10 px-3 gap-3"
        )}
        activeClassName="bg-primary/15 text-primary"
      >
        <item.icon className="w-5 h-5 shrink-0" />
        {!collapsed && (
          <span className="text-sm truncate flex-1">{item.label}</span>
        )}
        {count > 0 && (
          <span
            className={cn(
              "min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center px-1",
              collapsed ? "absolute -top-0.5 -right-0.5" : "ml-auto"
            )}
          >
            {count > 99 ? "99+" : count}
          </span>
        )}
      </NavLink>
    );

    if (!collapsed) return <div key={item.path}>{link}</div>;

    return (
      <Tooltip key={item.path} delayDuration={0}>
        <TooltipTrigger asChild>{link}</TooltipTrigger>
        <TooltipContent side="right" className="bg-card border-border">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={cn(
        "flex flex-col h-screen bg-[#141414] border-r border-[#2b2b2b] transition-[width] duration-200 ease-out",
        collapsed ? "w-14" : "w-[220px]"
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex items-center h-16 border-b border-[#2b2b2b] shrink-0",
          collapsed ? "justify-center px-0" : "justify-between px-3"
        )}
      >
        {!collapsed && (
          <img
            src={partner.logoUrl}
            alt={`${partner.name} Logo`}
            className="h-9 w-9 object-contain"
          />
        )}
        {collapsed && (
          <img
            src={partner.logoUrl}
            alt={`${partner.name} Logo`}
            className="h-8 w-8 object-contain absolute"
            style={{ opacity: 0 }}
          />
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="w-7 h-7 flex items-center justify-center rounded-md text-[#9ca3af] hover:text-primary hover:bg-primary/10 transition-colors"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 flex flex-col gap-1">
        {visibleGroups.map((group, idx) => (
          <div
            key={group.key}
            className={cn(
              "flex flex-col",
              collapsed ? "gap-1 px-2 mt-1" : "gap-0.5 px-2 mt-2"
            )}
          >
            {!collapsed && (
              <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-[#6b7280] transition-opacity duration-150">
                {group.label}
              </div>
            )}
            {group.items.map(renderItem)}
            {collapsed && idx < visibleGroups.length - 1 && (
              <div className="h-1" />
            )}
          </div>
        ))}
      </nav>

      {/* Settings (admin only) */}
      {isAdmin && (
        <div className="border-t border-[#2b2b2b] py-3 px-2">
          {renderItem({
            icon: Settings,
            label: "Configuración",
            path: "/settings",
            roles: ["administrador"],
          })}
        </div>
      )}
    </aside>
  );
}