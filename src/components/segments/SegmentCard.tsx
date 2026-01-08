import { Users, Zap, MoreHorizontal, Loader2, Copy, Recycle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Segment, SegmentCondition } from "@/types/segments";
import { useSegmentContactCount } from "@/hooks/useSegments";

interface SegmentCardProps {
  segment: Segment;
  onEdit: (segment: Segment) => void;
  onArchive?: (segment: Segment) => void;
  onDuplicate?: (segment: Segment) => void;
  onRestore?: (segment: Segment) => void;
  isArchived?: boolean;
}

export function SegmentCard({ segment, onEdit, onArchive, onDuplicate, onRestore, isArchived = false }: SegmentCardProps) {
  const { data: contactCount, isLoading: isLoadingCount } = useSegmentContactCount(segment);

  const getRuleChips = (): string[] => {
    if (segment.type === "static" || !segment.rules_json) return [];

    const rules = segment.rules_json as { conditions?: SegmentCondition[] };
    if (!rules.conditions) return [];

    return rules.conditions.slice(0, 3).map((condition) => {
      const operatorLabel = getOperatorLabel(condition.operator);
      return `${condition.field} ${operatorLabel} ${condition.value || ""}`.trim();
    });
  };

  const getOperatorLabel = (operator: string): string => {
    const labels: Record<string, string> = {
      equals: "=",
      not_equals: "≠",
      contains: "contiene",
      not_contains: "no contiene",
      starts_with: "empieza con",
      ends_with: "termina con",
      greater_than: ">",
      greater_or_equal: "≥",
      less_than: "<",
      less_or_equal: "≤",
      is_true: "es verdadero",
      is_false: "es falso",
      before: "antes de",
      after: "después de",
      last_days: "últimos",
      contains_tag: "tiene tag",
      is_empty: "vacío",
      is_not_empty: "no vacío",
    };
    return labels[operator] || operator;
  };

  const ruleChips = getRuleChips();

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Hace menos de 1 hora";
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
    if (diffDays < 7) return `Hace ${diffDays} día${diffDays > 1 ? "s" : ""}`;
    return date.toLocaleDateString("es-ES");
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5 hover:border-primary/30 transition-all duration-300 group">
      <div className="flex items-start justify-between mb-4">
        <div
          className={cn(
            "w-10 h-10 rounded-lg flex items-center justify-center",
            segment.type === "dynamic" ? "bg-accent/20" : "bg-primary/20"
          )}
        >
          {segment.type === "dynamic" ? (
            <Zap className="w-5 h-5 text-accent" />
          ) : (
            <Users className="w-5 h-5 text-primary" />
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!isArchived && (
              <>
                <DropdownMenuItem onClick={() => onEdit(segment)}>
                  Editar
                </DropdownMenuItem>
                {onDuplicate && (
                  <DropdownMenuItem onClick={() => onDuplicate(segment)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicar
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onArchive && (
                  <DropdownMenuItem
                    onClick={() => onArchive(segment)}
                    className="text-destructive"
                  >
                    Archivar
                  </DropdownMenuItem>
                )}
              </>
            )}
            {isArchived && onRestore && (
              <DropdownMenuItem onClick={() => onRestore(segment)}>
                Restaurar
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-foreground">{segment.name}</h3>
          <Badge
            variant={segment.type === "dynamic" ? "default" : "secondary"}
            className="text-xs"
          >
            {segment.type === "dynamic" ? "Dinámico" : "Estático"}
          </Badge>
          {(segment.reuse_count ?? 0) > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs gap-1 cursor-help">
                  <Recycle className="w-3 h-3" />
                  {segment.reuse_count}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reutilizado {segment.reuse_count} {segment.reuse_count === 1 ? 'vez' : 'veces'} en campañas</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {segment.description || "Sin descripción"}
        </p>
      </div>

      {ruleChips.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1">
          {ruleChips.map((rule, index) => (
            <div
              key={index}
              className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground"
            >
              {rule}
            </div>
          ))}
          {segment.rules_json &&
            (segment.rules_json as { conditions?: SegmentCondition[] }).conditions &&
            (segment.rules_json as { conditions: SegmentCondition[] }).conditions.length > 3 && (
              <div className="text-xs px-2 py-1 rounded bg-muted text-muted-foreground">
                +{(segment.rules_json as { conditions: SegmentCondition[] }).conditions.length - 3} más
              </div>
            )}
        </div>
      )}

      <div className="flex items-center justify-between pt-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          {isLoadingCount ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className="text-lg font-semibold text-foreground">
                {(contactCount || 0).toLocaleString()}
              </span>
              <span className="text-sm text-muted-foreground">contactos</span>
            </>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDate(segment.last_calculated_at)}
        </span>
      </div>
    </div>
  );
}
