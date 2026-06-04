import { ReactNode, useState } from "react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { UserMenu } from "@/components/layout/UserMenu";
import { CreditsBadge } from "@/components/layout/CreditsBadge";
import { SupportModeBanner } from "./SupportModeBanner";
import {
  LayoutDashboard,
  MessageSquare,
  CalendarClock,
  CalendarDays,
  Users,
  Menu,
  X,
  Sun,
  Moon,
  LogOut,
} from "lucide-react";
import { useTotalUnreadCount } from "@/hooks/useTotalUnreadCount";
import { usePartnerBranding } from "@/contexts/PartnerBrandingContext";
import { useSignOutRedirect } from "@/hooks/useSignOutRedirect";
import { useTheme } from "@/contexts/ThemeContext";

const mobileMenuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/" },
  { icon: MessageSquare, label: "Inbox", path: "/inbox", showBadge: true },
  { icon: CalendarClock, label: "Seguimientos", path: "/followups" },
  { icon: CalendarDays, label: "Agenda", path: "/events" },
  { icon: Users, label: "Contactos", path: "/contacts" },
];

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const totalUnread = useTotalUnreadCount();
  const { partner } = usePartnerBranding();
  const signOutRedirect = useSignOutRedirect();
  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    await signOutRedirect();
  };

  return (
    <div className="flex flex-col h-screen w-full overflow-hidden bg-background">
      <SupportModeBanner />

      {/* Mobile Header */}
      <header className="h-14 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <img src={partner.logoUrl} alt={partner.name} className="h-8 w-8 object-contain" />
        </div>
        <div className="flex items-center gap-3">
          <CreditsBadge />
          <UserMenu />
        </div>
      </header>

      {/* Slide-over menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex" onClick={() => setMenuOpen(false)}>
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60" />
          {/* Panel */}
          <nav
            className="relative z-10 w-72 bg-card border-r border-border h-full flex flex-col shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="h-16 flex items-center justify-between px-5 border-b border-border">
              <div className="flex items-center gap-3">
                <img src={partner.logoUrl} alt={partner.name} className="h-9 w-9 object-contain" />
                <span className="text-lg font-semibold text-foreground">{partner.name}</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu Items */}
            <div className="flex-1 py-4 px-3 space-y-1">
              {mobileMenuItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === "/"}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150 relative"
                  activeClassName="bg-primary/10 text-primary font-medium"
                  onClick={(e) => {
                    setMenuOpen(false);
                    // Force re-navigation to inbox even if already on /inbox
                    if (item.path === '/inbox' && window.location.pathname === '/inbox') {
                      e.preventDefault();
                      navigate('/inbox', { state: { resetKey: Date.now() } });
                    }
                  }}
                >
                  <item.icon className="w-5 h-5 shrink-0" />
                  <span className="text-sm">{item.label}</span>
                  {item.showBadge && totalUnread > 0 && (
                    <span className="ml-auto min-w-[22px] h-[22px] rounded-full bg-destructive text-destructive-foreground text-xs font-medium flex items-center justify-center px-1.5">
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </NavLink>
              ))}
            </div>

            {/* Bottom: Theme toggle + Logout */}
            <div className="border-t border-border px-4 py-4 space-y-2">
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleTheme}
                  className="w-10 h-10 flex items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Cambiar tema"
                >
                  {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </button>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-150 w-full"
              >
                <LogOut className="w-5 h-5 shrink-0" />
                <span className="text-sm">Cerrar sesión</span>
              </button>
            </div>
          </nav>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
