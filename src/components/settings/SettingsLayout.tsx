import { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Bell, MessageSquare,
  Settings as SettingsIcon, ListPlus, Bot, BookOpen, Code2, ShieldCheck, BarChart3,
  MessagesSquare, Brain, UserSquare2, Sparkles, FileText, Zap, Users
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFeatureFlag, type FeatureName } from "@/hooks/useFeatureFlag";

interface MenuItem {
  id: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  group: string;
  /** Flags that unlock this item (ANY enabled). Empty = no gating. */
  unlockFlags?: FeatureName[];
}

const menuItems: MenuItem[] = [
  {
    id: "whatsapp",
    path: "/settings/whatsapp",
    icon: MessageSquare,
    title: "WhatsApp",
    description: "Estado de conexión",
    group: "Canales",
  },
  {
    id: "notifications",
    path: "/settings/notifications",
    icon: Bell,
    title: "Notificaciones",
    description: "Preferencias de alertas",
    group: "Canales",
  },
  {
    id: "templates",
    path: "/settings/templates",
    icon: FileText,
    title: "Librería de Plantillas",
    description: "Mensajes predefinidos",
    group: "Canales",
  },
  {
    id: "quick-automations",
    path: "/settings/quick-automations",
    icon: Zap,
    title: "Automatizaciones Rápidas",
    description: "Respuestas y disparadores",
    group: "Canales",
  },
  {
    id: "ai-config",
    path: "/settings/ai-config",
    icon: Bot,
    title: "Asistente IA",
    description: "Comportamiento del asistente",
    group: "Inteligencia",
  },
  {
    id: "knowledge-base",
    path: "/settings/knowledge-base",
    icon: BookOpen,
    title: "Base de Conocimiento",
    description: "Respuestas automáticas",
    group: "Inteligencia",
  },
  {
    id: "contact-fields",
    path: "/settings/contact-fields",
    icon: ListPlus,
    title: "Campos personalizados",
    description: "Campos de contactos",
    group: "Leads",
  },
  {
    id: "consent",
    path: "/settings/consent",
    icon: ShieldCheck,
    title: "Consentimiento",
    description: "Opt-out, DND y bloqueos",
    group: "Leads",
  },
  {
    id: "assignment-rules",
    path: "/settings/assignment-rules",
    icon: Users,
    title: "Asignación de leads",
    description: "Round Robin, Sticky y timeouts",
    group: "Leads",
  },
  {
    id: "conversions",
    path: "/settings/conversions",
    icon: BarChart3,
    title: "Conversiones",
    description: "Meta Pixel y CAPI",
    group: "Avanzado",
    unlockFlags: ["campaigns"],
  },
  {
    id: "developer",
    path: "/settings/developer",
    icon: Code2,
    title: "Desarrollador",
    description: "API Webhooks y tokens",
    group: "Avanzado",
    unlockFlags: ["api_access"],
  },
];

const groupOrder = ["Canales", "Inteligencia", "Leads", "Avanzado"] as const;
const groupIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Canales: MessagesSquare,
  Inteligencia: Brain,
  Leads: UserSquare2,
  Avanzado: Sparkles,
};

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

  // Feature flag lookups for premium items (call hooks unconditionally)
  const campaigns = useFeatureFlag("campaigns");
  const automations = useFeatureFlag("automations_builder");
  const apiAccess = useFeatureFlag("api_access");
  const flagState: Record<FeatureName, boolean> = {
    campaigns: campaigns.enabled,
    segments: false,
    automations_builder: automations.enabled,
    templates_library: false,
    quick_automations: false,
    api_access: apiAccess.enabled,
    conversions_capi: false,
    custom_templates_management: false,
    inventory_management: false,
    meta_ads: false,
  };
  const isItemUnlocked = (item: MenuItem) =>
    !item.unlockFlags || item.unlockFlags.some((f) => flagState[f]);

  // Group menu items preserving canonical order
  const groupedItems = groupOrder
    .map((group) => [group, menuItems.filter((i) => i.group === group)] as const)
    .filter(([, items]) => items.length > 0);

  const isActive = (path: string) => {
    return currentPath.startsWith(path);
  };

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar Menu */}
      <div className="w-56 border-r border-sidebar-border bg-sidebar-background flex flex-col">
        {/* Sidebar Header */}
        <div className="px-4 py-3 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm text-sidebar-accent-foreground">Configuración</h2>
          </div>
        </div>

        {/* Menu Items */}
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4">
            {groupedItems.map(([group, items]) => {
              const GroupIcon = groupIcons[group];
              const isPremiumGroup = group === "Avanzado";
              const groupHasLocked =
                isPremiumGroup && items.some((i) => !isItemUnlocked(i));
              return (
              <div key={group}>
                <div className="px-2 mb-1 flex items-center gap-1.5">
                  {GroupIcon && <GroupIcon className="h-3 w-3 text-sidebar-foreground/60" />}
                  <p className="text-[10px] font-medium text-sidebar-foreground/60 uppercase tracking-wider">
                    {group}
                  </p>
                  {groupHasLocked && (
                    <span className="ml-auto text-[9px] font-semibold uppercase tracking-wider text-primary">
                      Pro
                    </span>
                  )}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => {
                    const ItemIcon = item.icon;
                    const active = isActive(item.path);
                    const unlocked = isItemUnlocked(item);
                    const showProBadge = !!item.unlockFlags && !unlocked;
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(item.path)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-all text-sm",
                          active 
                            ? "bg-primary text-primary-foreground" 
                            : "hover:bg-sidebar-accent text-sidebar-accent-foreground"
                        )}
                      >
                        <ItemIcon className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-primary-foreground" : "text-sidebar-foreground"
                        )} />
                        <span className={cn(
                          "truncate",
                          active ? "text-primary-foreground" : "text-sidebar-accent-foreground"
                        )}>
                          {item.title}
                        </span>
                        {showProBadge && (
                          <span className={cn(
                            "ml-auto text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded",
                            active
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-primary/10 text-primary"
                          )}>
                            Pro
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              );
            })}
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
