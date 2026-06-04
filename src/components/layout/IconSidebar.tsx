import { useState, useEffect } from "react";
import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  MessageSquare,
  Kanban,
  Users,
  CalendarDays,
  CalendarClock,
  Send,
  Filter,
  Zap,
  MonitorPlay,
  FileText,
  Home,
  Building2,
  ShieldCheck,
  Headphones,
  Settings,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  MessagesSquare,
  Megaphone,
  Eye,
  LifeBuoy,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTotalUnreadCount } from "@/hooks/useTotalUnreadCount";
import { useFollowupBadgeCount } from "@/hooks/useFollowupBadgeCount";
import { useAtRiskBadgeCount } from "@/hooks/useAtRiskBadgeCount";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerBranding } from "@/contexts/PartnerBrandingContext";
import { useFeatureFlag, type FeatureName } from "@/hooks/useFeatureFlag";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type NavItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  feature?: FeatureName;
  badgeKey?: "inbox" | "followups" | "atRisk";
};

type NavGroup = {
  key: string;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const COLLAPSE_KEY = "brokia_sidebar_collapsed";

export function IconSidebar() {
  const totalUnread = useTotalUnreadCount();
  const followupBadge = useFollowupBadgeCount();
  const atRiskBadge = useAtRiskBadgeCount();
  const { tenantRole, isSuperAdmin } = useAuth();
  const { partner } = usePartnerBranding();
  const isMobile = useIsMobile();

  const { enabled: campaignsEnabled } = useFeatureFlag("campaigns");
  const { enabled: segmentsEnabled } = useFeatureFlag("segments");
  const { enabled: automationsEnabled } = useFeatureFlag("automations_builder");
  const { enabled: templatesEnabled } = useFeatureFlag("templates_library");
  const { enabled: metaAdsEnabled } = useFeatureFlag("meta_ads");
  const { enabled: inventoryEnabled } = useFeatureFlag("inventory_management");

  const [collapsedPref, setCollapsedPref] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, String(collapsedPref));
  }, [collapsedPref]);

  const collapsed = isMobile ? true : collapsedPref;

  const isAdministrador = tenantRole === "administrador" || isSuperAdmin;
  const isManagerOrAdmin = isAdministrador || tenantRole === "manager";
  const isAsesor = !isManagerOrAdmin;

  const featureEnabled: Partial<Record<FeatureName, boolean>> = {
    campaigns: campaignsEnabled,
    segments: segmentsEnabled,
    automations_builder: automationsEnabled,
    inventory_management: inventoryEnabled,
    meta_ads: metaAdsEnabled,
    templates_library: templatesEnabled,
  };

  const badgeCounts: Record<string, number> = {
    inbox: totalUnread,
    followups: followupBadge,
    atRisk: atRiskBadge,
  };

  const filterByFlag = (items: NavItem[]) =>
    items.filter((i) => !i.feature || featureEnabled[i.feature]);

  const groups: NavGroup[] = [];

  if (isManagerOrAdmin) {
    groups.push({
      key: "general",
      label: "General",
      icon: LayoutGrid,
      items: [{ icon: LayoutDashboard, label: "Dashboard", path: "/" }],
    });
  }

  groups.push({
    key: "comunicacion",
    label: "Comunicación",
    icon: MessagesSquare,
    items: [
      { icon: MessageSquare, label: "Inbox", path: "/inbox", badgeKey: "inbox" },
      { icon: Kanban, label: "Pipeline", path: "/pipeline" },
      { icon: Users, label: "Contactos", path: "/contacts" },
      { icon: CalendarDays, label: "Citas", path: "/events" },
      { icon: CalendarClock, label: "Seguimientos", path: "/followups", badgeKey: "followups" },
    ],
  });

  if (isManagerOrAdmin) {
    const marketingItems = filterByFlag([
      { icon: Send, label: "Campañas", path: "/campaigns", feature: "campaigns" },
      { icon: Filter, label: "Segmentos", path: "/segments", feature: "segments" },
      { icon: Zap, label: "Automatizaciones", path: "/automations", feature: "automations_builder" },
      { icon: MonitorPlay, label: "Meta Ads", path: "/meta-ads", feature: "meta_ads" },
      { icon: FileText, label: "Plantillas", path: "/templates", feature: "templates_library" },
    ]);
    if (marketingItems.length > 0) {
      groups.push({ key: "marketing", label: "Marketing", icon: Megaphone, items: marketingItems });
    }

    const supervisionItems = filterByFlag([
      { icon: Home, label: "Inventario", path: "/properties", feature: "inventory_management" },
      { icon: Building2, label: "Asesores por propiedad", path: "/inventory-assignments" },
      { icon: ShieldCheck, label: "Supervisión de leads", path: "/admin-leads", badgeKey: "atRisk" },
    ]);
    if (supervisionItems.length > 0) {
      groups.push({ key: "supervision", label: "Supervisión", icon: Eye, items: supervisionItems });
    }
  }

  if (isAdministrador) {
    groups.push({
      key: "soporte",
      label: "Soporte",
      icon: LifeBuoy,
      items: [{ icon: Headphones, label: "Soporte", path: "/support" }],
    });
  }

  void isAsesor;

  const renderItem = (item: NavItem) => {
    const count = item.badgeKey ? badgeCounts[item.badgeKey] ?? 0 : 0;
    const link = (
      <NavLink
        to={item.path}
        end={item.path === "/"}
        className={cn(
          "flex items-center rounded-md text-sm text-[#9ca3af] hover:text-primary hover:bg-primary/10 transition-colors relative",
          collapsed ? "w-9 h-9 justify-center mx-auto" : "w-full px-2 py-1.5 gap-2"
        )}
        activeClassName="bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground"
      >
        <item.icon className="w-4 h-4 shrink-0" />
        {!collapsed && (
          <span className="text-sm truncate flex-1 transition-opacity duration-200">{item.label}</span>
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
        "flex flex-col h-screen bg-[#141414] border-r border-[#2b2b2b] transition-all duration-200 ease-linear",
        collapsed ? "w-14" : "w-[224px]"
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
        {!isMobile && (
          <button
            type="button"
            onClick={() => setCollapsedPref((v) => !v)}
            className="w-7 h-7 flex items-center justify-center rounded-md text-[#6b7280] hover:text-primary hover:bg-primary/10 transition-colors relative z-10"
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Groups */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-2 flex flex-col">
        {groups.map((group, idx) => (
          <div
            key={group.key}
            className={cn(
              "flex flex-col",
              collapsed ? "gap-1 px-2 mt-1" : "gap-0.5 px-2 mt-3"
            )}
          >
            {!collapsed && (
              <div className="px-2 mb-1 flex items-center gap-1.5 transition-opacity duration-200">
                {group.icon && <group.icon className="h-3 w-3 text-[#6b7280]" />}
                <p className="text-[10px] font-medium uppercase tracking-wider text-[#6b7280]">
                  {group.label}
                </p>
              </div>
            )}
            {group.items.map(renderItem)}
            {collapsed && idx < groups.length - 1 && (
              <div className="h-1" />
            )}
          </div>
        ))}
      </nav>

      {/* Settings (admin only) */}
      {isAdministrador && (
        <div className="border-t border-[#2b2b2b] py-2 px-2">
          {renderItem({
            icon: Settings,
            label: "Configuración",
            path: "/settings",
          })}
        </div>
      )}
    </aside>
  );
}