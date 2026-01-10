import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { PipelineMetric } from "@/hooks/useRealEstateDashboard";
import { cn } from "@/lib/utils";

interface RealEstatePipelineFunnelProps {
  pipeline: PipelineMetric[];
  pipelineTotal: number;
  isLoading?: boolean;
}

export function RealEstatePipelineFunnel({ 
  pipeline, 
  pipelineTotal,
  isLoading 
}: RealEstatePipelineFunnelProps) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <Card className="col-span-full lg:col-span-2">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // Filter out closed_lost for main funnel, but keep it for display
  const activeFunnel = pipeline.filter(p => !['closed_won', 'closed_lost'].includes(p.stage));
  const closedWon = pipeline.find(p => p.stage === 'closed_won');
  const closedLost = pipeline.find(p => p.stage === 'closed_lost');

  // Calculate funnel width based on position
  const maxWidth = 100;
  const minWidth = 50;

  return (
    <Card className="col-span-full lg:col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-semibold">Embudo de Ventas</CardTitle>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-7 text-xs"
            onClick={() => navigate("/pipeline")}
          >
            Ver Pipeline <ArrowUpRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {pipelineTotal} leads activos en pipeline
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Funnel Visualization */}
        <div className="relative space-y-2">
          {activeFunnel.map((stage, index) => {
            const widthPercent = maxWidth - ((maxWidth - minWidth) * (index / (activeFunnel.length - 1)));
            
            return (
              <div
                key={stage.stage}
                className="relative flex items-center justify-center mx-auto transition-all hover:opacity-80 cursor-pointer group"
                style={{ width: `${widthPercent}%` }}
                onClick={() => navigate(`/pipeline?stage=${stage.stage}`)}
              >
                <div 
                  className="w-full py-2 px-3 rounded-md flex items-center justify-between text-sm font-medium transition-all"
                  style={{ 
                    backgroundColor: `hsl(var(--chart-${(index % 5) + 1}) / 0.15)`,
                    borderLeft: `3px solid hsl(var(--chart-${(index % 5) + 1}))`,
                  }}
                >
                  <span className="truncate text-foreground">{stage.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">{stage.count}</span>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round(stage.percentage)}%)
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Closed States */}
        <div className="pt-3 border-t flex items-center justify-between gap-4">
          <div 
            className={cn(
              "flex-1 p-3 rounded-lg text-center cursor-pointer transition-all hover:opacity-80",
              "bg-emerald-500/10 border border-emerald-500/20"
            )}
            onClick={() => navigate("/pipeline?stage=closed_won")}
          >
            <p className="text-2xl font-bold text-emerald-500">{closedWon?.count || 0}</p>
            <p className="text-xs text-muted-foreground">Ganados</p>
          </div>
          <div 
            className={cn(
              "flex-1 p-3 rounded-lg text-center cursor-pointer transition-all hover:opacity-80",
              "bg-destructive/10 border border-destructive/20"
            )}
            onClick={() => navigate("/pipeline?stage=closed_lost")}
          >
            <p className="text-2xl font-bold text-destructive">{closedLost?.count || 0}</p>
            <p className="text-xs text-muted-foreground">Perdidos</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
