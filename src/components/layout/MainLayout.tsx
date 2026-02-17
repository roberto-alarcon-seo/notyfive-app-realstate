import { ReactNode } from "react";
import { IconSidebar } from "./IconSidebar";
import { UserMenu } from "./UserMenu";
import { WalletIndicator } from "@/components/inbox/WalletIndicator";
import { CreditsGatingBanner } from "./CreditsGatingBanner";
import { SupportModeBanner } from "./SupportModeBanner";
import { MobileLayout } from "./MobileLayout";
import { useTenantCredits } from "@/hooks/useTenantCredits";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportMode } from "@/contexts/SupportModeContext";
import { useIsMobile } from "@/hooks/use-mobile";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const isMobile = useIsMobile();
  const { data: credits } = useTenantCredits();
  const { isSuperAdmin } = useAuth();
  const { isSupportMode } = useSupportMode();
  
  const walletBalance = credits?.message_credits || 0;
  const walletRollover = credits?.accumulated_credits || 0;
  const walletMonthly = credits?.monthly_credits_remaining || 0;
  const walletExtra = credits?.extra_credits || 0;
  const showWallet = isSupportMode || !isSuperAdmin;

  if (isMobile) {
    return <MobileLayout>{children}</MobileLayout>;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <IconSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <SupportModeBanner />
        {!isSupportMode && <CreditsGatingBanner />}
        <header className="h-14 border-b border-border bg-card flex items-center justify-end px-6 shrink-0 gap-4">
          {showWallet && (
            <WalletIndicator 
              balance={walletBalance} 
              rollover={walletRollover}
              monthly={walletMonthly}
              extra={walletExtra}
            />
          )}
          <UserMenu />
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
