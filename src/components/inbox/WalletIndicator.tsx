import { useState } from "react";
import { MessageSquare, AlertTriangle, Plus, CheckCircle, AlertCircle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlansCreditsModal } from "@/components/billing/PlansCreditsModal";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface WalletIndicatorProps {
  balance: number;
  rollover?: number;
  monthly?: number;
  extra?: number;
  className?: string;
}

type BalanceStatus = "healthy" | "warning" | "critical";

function getBalanceStatus(balance: number): BalanceStatus {
  if (balance > 500) return "healthy";
  if (balance >= 100) return "warning";
  return "critical";
}

function getStatusConfig(status: BalanceStatus) {
  switch (status) {
    case "healthy":
      return {
        bgColor: "bg-green-500/20",
        dotColor: "bg-green-500",
        textColor: "text-green-500",
        icon: CheckCircle,
        label: "Saldo saludable",
      };
    case "warning":
      return {
        bgColor: "bg-yellow-500/20",
        dotColor: "bg-yellow-500",
        textColor: "text-yellow-500",
        icon: AlertCircle,
        label: "Saldo bajo",
      };
    case "critical":
      return {
        bgColor: "bg-destructive/20",
        dotColor: "bg-destructive",
        textColor: "text-destructive",
        icon: AlertTriangle,
        label: "Saldo crítico",
      };
  }
}

export function WalletIndicator({ balance, rollover = 0, monthly = 0, extra = 0, className }: WalletIndicatorProps) {
  const [showPlansModal, setShowPlansModal] = useState(false);

  const status = getBalanceStatus(balance);
  const config = getStatusConfig(status);

  // Only show indicator when balance is low or critical
  const showAlertIndicator = status !== "healthy";

  return (
    <>
      <div className={cn("flex items-center gap-2", className)}>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setShowPlansModal(true)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all hover:opacity-80",
                  showAlertIndicator ? config.bgColor : "bg-muted/50",
                  showAlertIndicator ? config.textColor : "text-muted-foreground"
                )}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>{balance.toLocaleString()}</span>
                {showAlertIndicator ? (
                  <>
                    <span className={cn("w-2 h-2 rounded-full animate-pulse", config.dotColor)} />
                    <config.icon className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <span className={cn("w-2 h-2 rounded-full", config.dotColor)} />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs max-w-[220px]">
              <div className="flex flex-col gap-1.5">
                <span className={cn("font-medium", config.textColor)}>{config.label}</span>
              <div className="text-muted-foreground space-y-0.5">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Del mes: {monthly.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>Acumulados: {rollover.toLocaleString()}</span>
                  </div>
                  {extra > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>Adicionales: {extra.toLocaleString()}</span>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground/70 italic">
                  Mensual → Acumulados → Adicionales
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {showAlertIndicator && (
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 px-2 text-xs hover:text-primary",
              config.textColor
            )}
            onClick={() => setShowPlansModal(true)}
          >
            <Plus className="h-3 w-3 mr-1" />
            Recargar
          </Button>
        )}
      </div>

      <PlansCreditsModal
        open={showPlansModal}
        onOpenChange={setShowPlansModal}
      />
    </>
  );
}
