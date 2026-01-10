import { NavLink } from "@/components/NavLink";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Filter,
  FileText,
  Send,
  Zap,
  CalendarClock,
  CalendarDays,
  Settings,
  Kanban,
  Home,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTotalUnreadCount } from "@/hooks/useTotalUnreadCount";
import logo from "@/assets/logo.png";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/", showBadge: false },
  { icon: MessageSquare, label: "Inbox", path: "/inbox", showBadge: true },
  { icon: Kanban, label: "Pipeline", path: "/pipeline", showBadge: false },
  { icon: CalendarClock, label: "Seguimientos", path: "/followups", showBadge: false },
  { icon: CalendarDays, label: "Eventos", path: "/events", showBadge: false },
  { icon: Users, label: "Contactos", path: "/contacts", showBadge: false },
  { icon: Filter, label: "Segmentos", path: "/segments", showBadge: false },
  { icon: FileText, label: "Plantillas", path: "/templates", showBadge: false },
  { icon: Send, label: "Campañas", path: "/campaigns", showBadge: false },
  { icon: Zap, label: "Automatización", path: "/automations", showBadge: false },
];

const bottomItems = [
  { icon: Home, label: "Propiedades", path: "/properties" },
  { icon: Settings, label: "Configuración", path: "/settings" },
];

export function IconSidebar() {
  const totalUnread = useTotalUnreadCount();

  return (
    <aside className="flex flex-col h-screen w-16 bg-sidebar-background border-r border-sidebar-border">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-sidebar-border">
        <img 
          src={logo} 
          alt="NotyFive Logo" 
          className="h-10 w-10 object-contain" 
        />
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 flex flex-col items-center py-4 gap-1">
        {menuItems.map((item) => (
          <Tooltip key={item.path} delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.path}
                end={item.path === "/"}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-sidebar-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200 relative"
                activeClassName="bg-sidebar-accent text-primary shadow-glow-sm"
              >
                <item.icon className="w-5 h-5" />
                {/* Unread badge for Inbox */}
                {item.showBadge && totalUnread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium flex items-center justify-center px-1">
                    {totalUnread > 99 ? '99+' : totalUnread}
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
      <div className="flex flex-col items-center py-4 gap-1 border-t border-sidebar-border">
        {bottomItems.map((item) => (
          <Tooltip key={item.path} delayDuration={0}>
            <TooltipTrigger asChild>
              <NavLink
                to={item.path}
                className="w-12 h-12 flex items-center justify-center rounded-xl text-sidebar-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
                activeClassName="bg-sidebar-accent text-primary"
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
