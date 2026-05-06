import { ReactNode } from "react";
import { IconSidebar } from "./IconSidebar";
import { UserMenu } from "./UserMenu";
import { SupportModeBanner } from "./SupportModeBanner";
import { MobileLayout } from "./MobileLayout";
import { CreditsBadge } from "./CreditsBadge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAtRiskAlerts } from "@/hooks/useAtRiskAlerts";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  useAtRiskAlerts();

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <IconSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SupportModeBanner />
        <header className="h-14 border-b border-border bg-card flex items-center justify-end px-6 shrink-0 gap-4">
          <CreditsBadge />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
