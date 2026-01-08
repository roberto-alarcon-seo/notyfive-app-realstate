import { ReactNode } from "react";
import { IconSidebar } from "./IconSidebar";
import { UserMenu } from "./UserMenu";
import { WalletIndicator } from "@/components/inbox/WalletIndicator";
import { CreditsGatingBanner } from "./CreditsGatingBanner";
import { SupportModeBanner } from "./SupportModeBanner";
import { useTenantCredits } from "@/hooks/useTenantCredits";
import { useAuth } from "@/contexts/AuthContext";
import { useSupportMode } from "@/contexts/SupportModeContext";

interface MainLayoutProps {
  children: ReactNode;
}

export function MainLayout({ children }: MainLayoutProps) {
  const { data: credits } = useTenantCredits();
  const { isSuperAdmin } = useAuth();
  const { isSupportMode } = useSupportMode();
  
  const walletBalance = credits?.message_credits || 0;
  const walletRollover = credits?.accumulated_credits || 0;
  const walletMonthly = credits?.monthly_credits_remaining || 0;
  const walletExtra = credits?.extra_credits || 0;

  // Show wallet when in support mode (viewing tenant data) or for regular tenant users
  const showWallet = isSupportMode || !isSuperAdmin;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <IconSidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Support mode banner for super admins */}
        <SupportModeBanner />
        {/* Global gating banner when no credits (only when not in support mode) */}
        {!isSupportMode && <CreditsGatingBanner />}
        <header className="h-14 border-b border-border bg-card flex items-center justify-end px-6 shrink-0 gap-4">
          {/* Wallet indicator - for tenant users or super admins in support mode */}
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
