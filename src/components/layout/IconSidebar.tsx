import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Filter,
  Send,
  CalendarClock,
  CalendarDays,
  Settings,
  Kanban,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTotalUnreadCount } from "@/hooks/useTotalUnreadCount";
import { useFollowupBadgeCount } from "@/hooks/useFollowupBadgeCount";
import { useAuth } from "@/contexts/AuthContext";
import { usePartnerBranding } from "@/contexts/PartnerBrandingContext";
import { useFeatureFlag, type FeatureName } from "@/hooks/useFeatureFlag";

type MenuItem = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  badgeKey: 'inbox' | 'followups' | null;
  feature?: FeatureName;
};

const menuItems: MenuItem[] = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", badgeKey: null },
  { icon: MessageSquare, label: "Inbox", path: "/inbox", badgeKey: 'inbox' },
  { icon: Kanban, label: "Pipeline", path: "/pipeline", badgeKey: null },
  { icon: CalendarClock, label: "Seguimientos", path: "/followups", badgeKey: 'followups' },
  { icon: CalendarDays, label: "Citas", path: "/events", badgeKey: null },
  { icon: Users, label: "Contactos", path: "/contacts", badgeKey: null },
  { icon: Filter, label: "Segmentos", path: "/segments", badgeKey: null, feature: "segments" },
  { icon: Send, label: "Campañas", path: "/campaigns", badgeKey: null, feature: "campaigns" },
];

const bottomItems = [
  { icon: Settings, label: "Configuración", path: "/settings", requireAdmin: true },
];

export function IconSidebar() {
  const totalUnread = useTotalUnreadCount();
  const followupBadge = useFollowupBadgeCount();
  const { tenantRole, isSuperAdmin } = useAuth();
  const { partner } = usePartnerBranding();
  const { enabled: campaignsEnabled } = useFeatureFlag("campaigns");
  const { enabled: segmentsEnabled } = useFeatureFlag("segments");
  
  const badgeCounts: Record<string, number> = {
    inbox: totalUnread,
    followups: followupBadge,
  };

  const featureEnabled: Record<FeatureName, boolean> = {
    campaigns: campaignsEnabled,
    segments: segmentsEnabled,
    automations_builder: false,
    templates_library: false,
    quick_automations: false,
  };

  const visibleItems = menuItems.filter(
    (item) => !item.feature || featureEnabled[item.feature],
  );
  
  // Solo administrador ve la opción de Configuración
  const isAdmin = tenantRole === 'administrador' || isSuperAdmin;

  return (
    <aside className="flex flex-col h-screen w-16 bg-[#141414] border-r border-[#2b2b2b]">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-[#2b2b2b]">
        <img 
          src={partner.logoUrl} 
          alt={`${partner.name} Logo`}
          className="h-10 w-10 object-contain" 
        />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center py-4 gap-1">
        {visibleItems.map((item) => (
          <Tooltip key={item.path} delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-[#6b7280] hover:text-primary hover:bg-primary/10 transition-all duration-200 relative"
                activeClassName="bg-[#242424] text-primary shadow-glow-sm"
              >
                <item.icon className="w-5 h-5" />
                {/* Badge */}
                {item.badgeKey && (badgeCounts[item.badgeKey] ?? 0) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center px-1">
                    {(badgeCounts[item.badgeKey] ?? 0) > 99 ? '99+' : badgeCounts[item.badgeKey]}
                  </span>
                )}
              </NavLink>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-card border-border">
              {item.label}
            </TooltipContent>
          </Tooltip>
        ))}
      </nav>

      {/* Bottom Navigation */}
      <div className="flex flex-col items-center py-4 gap-1 border-t border-[#2b2b2b]">
        {bottomItems
          .filter((item) => !item.requireAdmin || isAdmin)
          .map((item) => (
            <Tooltip key={item.path} delayDuration={0}>
              <TooltipTrigger asChild>
                <NavLink
                  to={item.path}
                  className="w-12 h-12 flex items-center justify-center rounded-xl text-[#6b7280] hover:text-primary hover:bg-primary/10 transition-all duration-200"
                  activeClassName="bg-[#242424] text-primary"
                >
                  <item.icon className="w-5 h-5" />
                </NavLink>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-card border-border">
                {item.label}
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
    </aside>
  );
}