import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CalendarClock, AlertTriangle, Calendar, Clock, 
  User, MessageSquare, Check, ChevronRight, Loader2, StickyNote,
  MoreVertical, Pencil, Trash2
} from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { format, isPast, isToday, endOfDay, isAfter } from "date-fns";
import { es } from "date-fns/locale";
import { useFollowups, useCompleteFollowup, useRescheduleFollowup, useUpdateFollowup, useDeleteFollowup, type Followup } from "@/hooks/useFollowups";
import { CompleteFollowupModal } from "@/components/inbox/CompleteFollowupModal";
import { toast } from "sonner";

type TabValue = "overdue" | "today" | "upcoming";

export default function Followups() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabValue>("today");
  const [selectedFollowup, setSelectedFollowup] = useState<Followup | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [editFollowup, setEditFollowup] = useState<Followup | null>(null);
  const [deleteFollowup, setDeleteFollowup] = useState<Followup | null>(null);
  
  const { data: followups = [], isLoading } = useFollowups();
  const completeFollowup = useCompleteFollowup();
  const rescheduleFollowup = useRescheduleFollowup();
  const updateFollowup = useUpdateFollowup();
  const deleteFollowupMutation = useDeleteFollowup();

  // Filter followups by tab
  const now = new Date();
  const todayEnd = endOfDay(now);

  const overdueFollowups = followups.filter(f => {
    const due = new Date(f.due_at);
    return isPast(due) && !isToday(due);
  });

  const todayFollowups = followups.filter(f => {
    const due = new Date(f.due_at);
    return isToday(due);
  });

  const upcomingFollowups = followups.filter(f => {
    const due = new Date(f.due_at);
    return isAfter(due, todayEnd);
  });

  const getTabCount = (tab: TabValue) => {
    switch (tab) {
      case "overdue": return overdueFollowups.length;
      case "today": return todayFollowups.length;
      case "upcoming": return upcomingFollowups.length;
    }
  };

  const getCurrentFollowups = () => {
    switch (activeTab) {
      case "overdue": return overdueFollowups;
      case "today": return todayFollowups;
      case "upcoming": return upcomingFollowups;
    }
  };

  const handleOpenConversation = (conversationId: string) => {
    navigate(`/inbox?conversation=${conversationId}`);
  };

  const handleOpenCompleteModal = (followup: Followup) => {
    setSelectedFollowup(followup);
    setShowCompleteModal(true);
  };

  const handleComplete = () => {
    if (!selectedFollowup) return;
    completeFollowup.mutate(selectedFollowup.id, {
      onSuccess: () => {
        toast.success("Seguimiento completado");
        setShowCompleteModal(false);
        setSelectedFollowup(null);
      },
      onError: () => {
        toast.error("Error al completar seguimiento");
      },
    });
  };

  const handleReschedule = (data: { newDueAt: string; note: string | null }) => {
    if (!selectedFollowup) return;
    rescheduleFollowup.mutate(
      {
        followupId: selectedFollowup.id,
        newDueAt: data.newDueAt,
        note: data.note,
      },
      {
        onSuccess: () => {
          toast.success("Seguimiento reagendado");
          setShowCompleteModal(false);
          setSelectedFollowup(null);
        },
        onError: () => {
          toast.error("Error al reagendar seguimiento");
        },
      }
    );
  };

  const handleDelete = () => {
    if (!deleteFollowup) return;
    deleteFollowupMutation.mutate(deleteFollowup.id, {
      onSuccess: () => {
        toast.success("Seguimiento eliminado");
        setDeleteFollowup(null);
      },
      onError: () => {
        toast.error("Error al eliminar seguimiento");
      },
    });
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return 'WA';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="border-b border-border p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <CalendarClock className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Seguimientos</h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                Gestiona tus recordatorios de seguimiento
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-3 md:p-6 overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="h-full flex flex-col">
            <TabsList className="grid w-full max-w-md grid-cols-3">
              <TabsTrigger value="overdue" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                <AlertTriangle className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Atrasados
                {overdueFollowups.length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 px-1.5 text-[10px]">
                    {overdueFollowups.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="today" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Hoy
                {todayFollowups.length > 0 && (
                  <Badge variant="default" className="ml-1 h-5 px-1.5 text-[10px]">
                    {todayFollowups.length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                <Clock className="h-3.5 w-3.5 md:h-4 md:w-4" />
                Próximos
                {upcomingFollowups.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                    {upcomingFollowups.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 mt-4 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
              <div className="h-full overflow-y-auto overflow-x-hidden">
                  <div className="w-full flex flex-col gap-3 pr-1">
                    {getCurrentFollowups().length === 0 ? (
                      <div className="text-center py-12">
                        <CalendarClock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground">
                          {activeTab === "overdue" && "No tienes seguimientos atrasados"}
                          {activeTab === "today" && "No tienes seguimientos para hoy"}
                          {activeTab === "upcoming" && "No tienes seguimientos programados"}
                        </p>
                      </div>
                    ) : (
                      getCurrentFollowups().map((followup) => (
                        <FollowupRow
                          key={followup.id}
                          followup={followup}
                          onOpen={() => handleOpenConversation(followup.conversation_id)}
                          onComplete={() => handleOpenCompleteModal(followup)}
                          onEdit={() => setEditFollowup(followup)}
                          onDelete={() => setDeleteFollowup(followup)}
                          isCompleting={completeFollowup.isPending || rescheduleFollowup.isPending}
                          getInitials={getInitials}
                        />
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </Tabs>
        </div>
      </div>

      {/* Complete/Reschedule Modal */}
      <CompleteFollowupModal
        open={showCompleteModal}
        onOpenChange={setShowCompleteModal}
        onComplete={handleComplete}
        onReschedule={handleReschedule}
        isLoading={completeFollowup.isPending || rescheduleFollowup.isPending}
      />

      {/* Edit Dialog */}
      <EditFollowupDialog
        followup={editFollowup}
        open={!!editFollowup}
        onOpenChange={(open) => !open && setEditFollowup(null)}
        onSave={(data) => {
          if (!editFollowup) return;
          updateFollowup.mutate(
            { followupId: editFollowup.id, due_at: data.due_at, note: data.note },
            {
              onSuccess: () => {
                toast.success("Seguimiento actualizado");
                setEditFollowup(null);
              },
              onError: () => toast.error("Error al actualizar"),
            }
          );
        }}
        isLoading={updateFollowup.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteFollowup} onOpenChange={(open) => !open && setDeleteFollowup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar seguimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el seguimiento de{" "}
              <span className="font-medium text-foreground">
                {deleteFollowup?.contact?.name || "este contacto"}
              </span>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteFollowupMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <Trash2 className="h-4 w-4 mr-1" />
              )}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}

// --- Edit Dialog ---
function EditFollowupDialog({
  followup,
  open,
  onOpenChange,
  onSave,
  isLoading,
}: {
  followup: Followup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { due_at: string; note: string | null }) => void;
  isLoading: boolean;
}) {
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");

  // Sync state when followup changes
  const prevId = useState<string | null>(null);
  if (followup && followup.id !== prevId[0]) {
    prevId[1](followup.id);
    const d = new Date(followup.due_at);
    // Format as datetime-local value
    setDueAt(format(d, "yyyy-MM-dd'T'HH:mm"));
    setNote(followup.note || "");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar seguimiento</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Fecha y hora</Label>
            <Input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Nota</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Nota del seguimiento..."
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => onSave({ due_at: new Date(dueAt).toISOString(), note: note || null })}
            disabled={isLoading || !dueAt}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Followup Row ---
interface FollowupRowProps {
  followup: Followup;
  onOpen: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isCompleting: boolean;
  getInitials: (name: string | undefined) => string;
}

function FollowupRow({ followup, onOpen, onComplete, onEdit, onDelete, isCompleting, getInitials }: FollowupRowProps) {
  const dueDate = new Date(followup.due_at);
  const isOverdue = isPast(dueDate) && !isToday(dueDate);

  return (
    <div className={`
      w-full max-w-full overflow-hidden rounded-lg border p-3 md:p-4 transition-colors hover:bg-muted/50
      ${isOverdue ? 'border-destructive/30 bg-destructive/5' : 'border-border'}
    `}>
      <div className="flex items-start gap-3 md:gap-4 w-full max-w-full">
        {/* Avatar */}
        <Avatar className="h-9 w-9 md:h-10 md:w-10 shrink-0">
          <AvatarFallback className="bg-primary/20 text-primary text-xs md:text-sm">
            {getInitials(followup.contact?.name)}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm md:text-base text-foreground truncate">
              {followup.contact?.name || followup.conversation?.customer_whatsapp}
            </span>
            {isOverdue && (
              <Badge variant="destructive" className="shrink-0 text-[10px]">Atrasado</Badge>
            )}
          </div>

          {followup.conversation?.last_message_preview && (
            <p className="text-xs md:text-sm text-muted-foreground truncate italic">
              {followup.conversation.last_message_preview}
            </p>
          )}

          {followup.note && (
            <div className="flex items-start gap-1.5 bg-primary/5 border border-primary/15 rounded-md px-2 py-1.5">
              <StickyNote className="h-3 w-3 md:h-3.5 md:w-3.5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs md:text-sm text-foreground font-medium line-clamp-2">
                {followup.note}
              </p>
            </div>
          )}

          <div className="flex items-center gap-3 md:gap-4 text-[11px] md:text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarClock className="h-3 w-3 md:h-3.5 md:w-3.5" />
              {format(dueDate, "d MMM, HH:mm", { locale: es })}
            </span>
            {followup.assigned_user && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3 md:h-3.5 md:w-3.5" />
                {followup.assigned_user.name}
              </span>
            )}
          </div>

          {/* Mobile Actions - stacked below content */}
          <div className="flex items-center gap-2 pt-1.5 md:hidden">
            <Button
              variant="default"
              size="sm"
              onClick={onOpen}
              className="text-xs flex-1"
            >
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Abrir chat
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onComplete}
              disabled={isCompleting}
              className="text-xs flex-1"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Completar
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground shrink-0">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onEdit}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Desktop Actions */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={onComplete}
            disabled={isCompleting}
            className="text-xs"
          >
            <Check className="h-4 w-4 mr-1" />
            Completar
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={onOpen}
          >
            <MessageSquare className="h-4 w-4 mr-1" />
            Abrir chat
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
