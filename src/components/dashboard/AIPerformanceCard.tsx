import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Bot, TrendingUp, Zap, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIPerformanceCardProps {
  totalMessages: number;
  aiMessages: number;
  humanMessages: number;
  responseRate: number;
  avgResponseTimeMs?: number;
  isLoading?: boolean;
}

export function AIPerformanceCard({ 
  totalMessages,
  aiMessages,
  humanMessages,
  responseRate,
  avgResponseTimeMs = 0,
  isLoading 
}: AIPerformanceCardProps) {
  if (isLoading) {
    return (
      <Card className="col-span-1">
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const aiPercentage = totalMessages > 0 ? Math.round((aiMessages / totalMessages) * 100) : 0;
  const successRate = 100; // Assuming all sent messages are successful
  const avgResponseTimeSec = avgResponseTimeMs > 0 ? (avgResponseTimeMs / 1000).toFixed(2) : "N/A";

  return (
    <Card className="col-span-1">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <CardTitle className="text-base font-semibold">Rendimiento del Sistema IA</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Success Rate */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Tasa de Éxito de Mensajes</span>
            </div>
            <span className="text-sm font-bold text-primary">{successRate}%</span>
          </div>
          <Progress value={successRate} className="h-2" />
          <p className="text-xs text-muted-foreground">Mensajes enviados correctamente</p>
        </div>

        {/* Response Time */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Tiempo Promedio de Respuesta</span>
            </div>
            <span className="text-sm font-bold text-primary">
              {avgResponseTimeSec !== "N/A" ? `${avgResponseTimeSec}s` : "—"}
            </span>
          </div>
          <Progress 
            value={avgResponseTimeMs > 0 ? Math.min(100, (10000 - avgResponseTimeMs) / 100) : 100} 
            className="h-2" 
          />
          <p className="text-xs text-muted-foreground">Velocidad de procesamiento</p>
        </div>

        {/* Total Messages */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-medium">Total de Mensajes Procesados</span>
            </div>
            <span className="text-sm font-bold text-primary">{totalMessages}</span>
          </div>
          <Progress value={Math.min(100, (totalMessages / 100) * 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">
            Este periodo ({aiMessages} IA / {humanMessages} manual)
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
