import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Building2, Users, Key, CreditCard, Bell, MessageSquare, 
  Settings as SettingsIcon, ListPlus, Bot, BookOpen, Code2, ShieldCheck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface MenuItem {
  id: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  group: string;
}

const menuItems: MenuItem[] = [
  {
    id: "company",
    path: "/settings",
    icon: Building2,
    title: "Empresa",
    description: "Información general",
    group: "General",
  },
  {
    id: "whatsapp",
    path: "/settings/whatsapp",
    icon: MessageSquare,
    title: "WhatsApp",
    description: "Estado de conexión",
    group: "General",
  },
  {
    id: "consent",
    path: "/settings/consent",
    icon: ShieldCheck,
    title: "Consentimiento",
    description: "Opt-out, DND y bloqueos",
    group: "General",
  },
  {
    id: "ai-config",
    path: "/settings/ai-config",
    icon: Bot,
    title: "Configuración IA",
    description: "Comportamiento del asistente",
    group: "Inteligencia Artificial",
  },
  {
    id: "knowledge-base",
    path: "/settings/knowledge-base",
    icon: BookOpen,
    title: "Base de Conocimiento",
    description: "Respuestas automáticas",
    group: "Inteligencia Artificial",
  },
  {
    id: "users",
    path: "/settings/users",
    icon: Users,
    title: "Usuarios",
    description: "Gestión del equipo",
    group: "Equipo",
  },
  {
    id: "contact-fields",
    path: "/settings/contact-fields",
    icon: ListPlus,
    title: "Campos personalizados",
    description: "Campos de contactos",
    group: "Equipo",
  },
  {
    id: "api",
    path: "/settings/api",
    icon: Key,
    title: "API & Webhooks",
    description: "Claves y endpoints",
    group: "Desarrollador",
  },
  {
    id: "developer",
    path: "/settings/developer",
    icon: Code2,
    title: "Tokens de API",
    description: "Integraciones externas",
    group: "Desarrollador",
  },
  {
    id: "billing",
    path: "/settings/billing",
    icon: CreditCard,
    title: "Facturación",
    description: "Plan y pagos",
    group: "Cuenta",
  },
  {
    id: "notifications",
    path: "/settings/notifications",
    icon: Bell,
    title: "Notificaciones",
    description: "Preferencias de alertas",
    group: "Cuenta",
  },
  {
    id: "security",
    path: "/settings/security",
    icon: ShieldCheck,
    title: "Seguridad",
    description: "Contraseña y acceso",
    group: "Cuenta",
  },
];

interface SettingsLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
}

export function SettingsLayout({ children, title, description, icon: Icon }: SettingsLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

  // Group menu items
  const groupedItems = menuItems.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  const isActive = (path: string) => {
    if (path === "/settings") {
      return currentPath === "/settings";
    }
    return currentPath.startsWith(path);
  };

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar Menu */}
      <div className="w-72 border-r border-sidebar-border bg-sidebar-background flex flex-col">
        {/* Sidebar Header */}
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <SettingsIcon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sidebar-accent-foreground">Configuración</h2>
              <p className="text-xs text-sidebar-foreground">Ajustes del sistema</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <ScrollArea className="flex-1">
          <div className="p-3 space-y-6">
            {Object.entries(groupedItems).map(([group, items]) => (
              <div key={group}>
                <p className="px-3 mb-2 text-xs font-medium text-sidebar-foreground uppercase tracking-wider">
                  {group}
                </p>
                <div className="space-y-1">
                  {items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isActive(item.path);
                    
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                          active 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                      >
                        <ItemIcon className={cn(
                          "h-5 w-5 shrink-0",
                          active ? "text-primary-foreground" : "text-sidebar-foreground"
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className={cn(
                            "font-medium text-sm truncate",
                            active ? "text-primary-foreground" : "text-sidebar-accent-foreground"
                          )}>
                            {item.title}
                          </p>
                          <p className={cn(
                            "text-xs truncate",
                            active ? "text-primary-foreground/70" : "text-sidebar-foreground"
                          )}>
                            {item.description}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Content Header */}
        <div className="border-b border-border bg-card px-8 py-6">
          <div className="flex items-center gap-4">
            {Icon && (
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon className="h-6 w-6 text-primary" />
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description && (
                <p className="text-muted-foreground mt-0.5">{description}</p>
              )}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <ScrollArea className="flex-1">
          <div className="p-8 pr-12">
            {children}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
