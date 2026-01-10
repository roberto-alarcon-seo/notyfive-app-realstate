import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { MessageSquare, Send, Inbox, Zap, User, Wallet, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MessagingCardProps {
  messaging: {
    totalSent: number;
    totalReceived: number;
    aiResponses: number;
    humanResponses: number;
    responseRate: number;
    creditsRemaining: number;
    creditsUsedThisPeriod: number;
    estimatedDaysLeft: number;
  };
  isLoading?: boolean;
}

export function MessagingCard({ messaging, isLoading }: MessagingCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const aiPercentage = messaging.totalSent > 0
    ? Math.round((messaging.aiResponses / messaging.totalSent) * 100)
    : 0;

  const lowCredits = messaging.creditsRemaining < 100 || messaging.estimatedDaysLeft < 7;

  return (
    <Card className={cn(
      lowCredits && "ring-1 ring-amber-500/30"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={cn(
            "p-1.5 rounded-md",
            lowCredits ? "bg-amber-500/10" : "bg-primary/10"
          )}>
            <MessageSquare className={cn(
              "h-4 w-4",
              lowCredits ? "text-amber-500" : "text-primary"
            )} />
          </div>
          <CardTitle className="text-sm font-semibold">Mensajería</CardTitle>
          {lowCredits && (
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
            <div className="flex items-center gap-1.5">
              <Send className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-lg font-bold">{messaging.totalSent}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Enviados</p>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <div className="flex items-center gap-1.5">
              <Inbox className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-lg font-bold">{messaging.totalReceived}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Recibidos</p>
          </div>
        </div>

        {/* AI vs Human */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-primary" />
              <span className="text-muted-foreground">IA</span>
              <span className="font-medium">{messaging.aiResponses}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-medium">{messaging.humanResponses}</span>
              <span className="text-muted-foreground">Humano</span>
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <Progress value={aiPercentage} className="h-1.5" />
          <p className="text-[10px] text-center text-muted-foreground">
            {aiPercentage}% respuestas automáticas
          </p>
        </div>

        {/* Credits */}
        <div className="pt-2 border-t space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Wallet className={cn(
                "h-4 w-4",
                lowCredits ? "text-amber-500" : "text-primary"
              )} />
              <span className={cn(
                "text-lg font-bold",
                lowCredits ? "text-amber-500" : "text-foreground"
              )}>
                {messaging.creditsRemaining.toLocaleString()}
              </span>
            </div>
            <Badge variant="outline" className={cn(
              messaging.estimatedDaysLeft > 30 
                ? "border-emerald-500/30 text-emerald-500" 
                : messaging.estimatedDaysLeft > 7 
                  ? "border-amber-500/30 text-amber-500"
                  : "border-destructive/30 text-destructive"
            )}>
              ~{messaging.estimatedDaysLeft} días
            </Badge>
          </div>
          <p className="text-[10px] text-muted-foreground">
            {messaging.creditsUsedThisPeriod} créditos usados en el período
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
