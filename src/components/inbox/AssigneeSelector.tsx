import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAllAssignableMembers } from "@/hooks/useAssignmentRules";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  conversationId: string;
  contactId?: string | null;
  currentAgentId?: string | null;
  compact?: boolean;
}

export function AssigneeSelector({
  conversationId,
  contactId,
  currentAgentId,
  compact,
}: Props) {
  const { tenantRole, isSuperAdmin } = useAuth();
  const { data: members = [], isLoading } = useAllAssignableMembers();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const canReassign =
    isSuperAdmin || ["manager", "administrador"].includes(tenantRole || "");

  async function handleChange(value: string) {
    if (!value || value === (currentAgentId ?? "")) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "assign-conversation",
        { body: { conversation_id: conversationId, agent_id: value } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Lead reasignado");
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["conversation", conversationId] });
      qc.invalidateQueries({ queryKey: ["contact", contactId] });
      qc.invalidateQueries({ queryKey: ["assignment-logs"] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo reasignar");
    } finally {
      setSaving(false);
    }
  }

  if (!canReassign) {
    const member = members.find((m) => m.id === currentAgentId);
    return (
      <div className="flex items-center gap-2 text-sm">
        <UserCircle2 className="h-4 w-4 text-muted-foreground" />
        <span className="truncate">
          {member?.name || (
            <span className="text-muted-foreground">Sin asignar</span>
          )}
        </span>
      </div>
    );
  }

  return (
    <Select
      value={currentAgentId ?? "none"}
      onValueChange={handleChange}
      disabled={isLoading || saving}
    >
      <SelectTrigger className={compact ? "h-8 text-xs" : "h-9 text-sm"}>
        <SelectValue placeholder="Asignar a…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none" disabled>
          <span className="text-muted-foreground">Sin asignar</span>
        </SelectItem>
        {members.map((m) => (
          <SelectItem key={m.id} value={m.id}>
            <span>{m.name || m.email}</span>
            {m.tenant_role && m.tenant_role !== "asesor" && (
              <span className="text-muted-foreground text-xs ml-2">
                {m.tenant_role}
              </span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}