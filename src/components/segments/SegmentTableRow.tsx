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
import { TableRow, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { Segment, SegmentCondition } from "@/types/segments";
import { useSegmentContactCount } from "@/hooks/useSegments";

interface SegmentTableRowProps {
  segment: Segment;
  onEdit: (segment: Segment) => void;
  onArchive?: (segment: Segment) => void;
  onDuplicate?: (segment: Segment) => void;
  onRestore?: (segment: Segment) => void;
  isArchived?: boolean;
}

export function SegmentTableRow({ segment, onEdit, onArchive, onDuplicate, onRestore, isArchived = false }: SegmentTableRowProps) {
  const { data: contactCount, isLoading: isLoadingCount } = useSegmentContactCount(segment);

  const getRuleCount = (): number => {
    if (segment.type === "static" || !segment.rules_json) return 0;
    const rules = segment.rules_json as { conditions?: SegmentCondition[] };
    return rules.conditions?.length || 0;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "< 1h";
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString("es-ES", { day: "2-digit", month: "short" });
  };

  const ruleCount = getRuleCount();

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50 group"
      onClick={() => onEdit(segment)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              segment.type === "dynamic" ? "bg-accent/20" : "bg-primary/20"
            )}
          >
            {segment.type === "dynamic" ? (
              <Zap className="w-4 h-4 text-accent" />
            ) : (
              <Users className="w-4 h-4 text-primary" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground truncate">{segment.name}</span>
              {(segment.reuse_count ?? 0) > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs gap-1 cursor-help shrink-0">
                      <Recycle className="w-3 h-3" />
                      {segment.reuse_count}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Reutilizado {segment.reuse_count} {segment.reuse_count === 1 ? 'vez' : 'veces'}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
            {segment.description && (
              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                {segment.description}
              </p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <Badge
          variant={segment.type === "dynamic" ? "default" : "secondary"}
          className="text-xs"
        >
          {segment.type === "dynamic" ? "Dinámico" : "Estático"}
        </Badge>
      </TableCell>
      <TableCell>
        {ruleCount > 0 ? (
          <span className="text-sm text-muted-foreground">{ruleCount} regla{ruleCount !== 1 ? 's' : ''}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <Users className="w-4 h-4 text-muted-foreground" />
          {isLoadingCount ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          ) : (
            <span className="font-medium">{(contactCount || 0).toLocaleString()}</span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm text-muted-foreground">{formatDate(segment.last_calculated_at)}</span>
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
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
      </TableCell>
    </TableRow>
  );
}