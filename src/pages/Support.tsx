import { useState } from 'react';
import { Plus, LifeBuoy, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MainLayout } from '@/components/layout/MainLayout';
import { useSupportTickets } from '@/hooks/useSupportTickets';
import { TicketList } from '@/components/support/TicketList';
import { TicketDetail } from '@/components/support/TicketDetail';
import { CreateTicketDialog } from '@/components/support/CreateTicketDialog';

export default function Support() {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { tickets, isLoading } = useSupportTickets();

  const filteredTickets = tickets.filter(ticket =>
    ticket.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ticket.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <LifeBuoy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Soporte técnico</h1>
              <p className="text-sm text-muted-foreground">Reporta un problema o solicita ayuda</p>
            </div>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nuevo ticket
          </Button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel - Ticket list */}
          <div className="w-96 border-r border-border flex flex-col">
            {/* Search */}
            <div className="p-4 border-b border-border">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar tickets..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Ticket list */}
            <TicketList
              tickets={filteredTickets}
              isLoading={isLoading}
              selectedTicketId={selectedTicketId}
              onSelectTicket={setSelectedTicketId}
            />
          </div>

          {/* Right panel - Ticket detail */}
          <div className="flex-1 overflow-hidden">
            {selectedTicketId ? (
              <TicketDetail ticketId={selectedTicketId} />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <LifeBuoy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Selecciona un ticket para ver los detalles</p>
                  <p className="text-sm mt-1">o crea uno nuevo</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateTicketDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </MainLayout>
  );
}