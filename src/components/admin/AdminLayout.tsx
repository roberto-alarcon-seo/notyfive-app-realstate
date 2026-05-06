import { useNavigate, useLocation } from "react-router-dom";
import { Building2, Users, FileText, LogOut, User, Shield, Wallet, LibraryBig, Handshake, FlaskConical } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useSignOutRedirect } from "@/hooks/useSignOutRedirect";

const navItems = [
  { title: "Partners", url: "/admin/partners", icon: Handshake },
  { title: "Tenants", url: "/admin/tenants", icon: Building2 },
  { title: "Super Wallet", url: "/admin/super-wallet", icon: Wallet },
  { title: "Usuarios", url: "/admin/users", icon: Users },
  { title: "Plantillas Globales", url: "/admin/master-templates", icon: LibraryBig },
  { title: "Logs", url: "/admin/logs", icon: FileText },
  { title: "Diagnóstico Asignación", url: "/admin/assignment-tests", icon: FlaskConical },
];

function AdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { partnerScope } = useAuth();

  // Partner-scoped admins: see only Partners (their own) + Tenants + Super Wallet.
  // Their "Partners" link points directly to their own partner detail page.
  const visibleItems = partnerScope
    ? navItems
        .filter((item) =>
          ["/admin/partners", "/admin/tenants", "/admin/super-wallet"].includes(item.url),
        )
        .map((item) =>
          item.url === "/admin/partners"
            ? { ...item, url: `/admin/partners/${partnerScope}`, title: "Mi Partner" }
            : item,
        )
    : navItems;

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className="flex items-center gap-2 px-3 py-4 border-b border-sidebar-border">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Shield className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-sidebar-foreground truncate">
                Super Admin
              </span>
              <span className="text-xs text-sidebar-foreground/60 truncate">
                Panel de control
              </span>
            </div>
          )}
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Gestión</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                    >
                      <button
                        type="button"
                        onClick={() => navigate(item.url)}
                        className="w-full"
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </button>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function AdminLayout({ children, title, description, actions }: AdminLayoutProps) {
  const { user } = useAuth();
  const handleSignOut = useSignOutRedirect();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b border-border bg-card px-4 sticky top-0 z-10">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger />
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-foreground truncate">
                  {title}
                </h1>
                {description && (
                  <p className="text-xs text-muted-foreground truncate">
                    {description}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon" className="rounded-full">
                    <User className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-foreground">Super Admin</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={handleSignOut}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 overflow-auto p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}