import { useState } from "react";
import { Search, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useContacts } from "@/hooks/useContacts";

interface ContactSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ContactSelector({ selectedIds, onChange }: ContactSelectorProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const { contacts, loading: isLoading } = useContacts();

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone?.includes(searchQuery)
  );

  const toggleContact = (contactId: string) => {
    if (selectedIds.includes(contactId)) {
      onChange(selectedIds.filter((id) => id !== contactId));
    } else {
      onChange([...selectedIds, contactId]);
    }
  };

  const toggleAll = () => {
    if (selectedIds.length === filteredContacts.length) {
      onChange([]);
    } else {
      onChange(filteredContacts.map((c) => c.id));
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[300px]">
        <div className="text-muted-foreground">Cargando contactos...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge variant="secondary" className="text-sm">
          {selectedIds.length} contactos seleccionados
        </Badge>
        <button
          type="button"
          onClick={toggleAll}
          className="text-sm text-primary hover:underline"
        >
          {selectedIds.length === filteredContacts.length
            ? "Deseleccionar todos"
            : "Seleccionar todos"}
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar contactos..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <ScrollArea className="h-[300px] border rounded-lg">
        <div className="p-2 space-y-1">
          {filteredContacts.length === 0 ? (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              No se encontraron contactos
            </div>
          ) : (
            filteredContacts.map((contact) => (
              <div
                key={contact.id}
                onClick={() => toggleContact(contact.id)}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selectedIds.includes(contact.id)}
                  onCheckedChange={() => toggleContact(contact.id)}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">
                    {contact.name}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {contact.email || contact.phone || "Sin datos de contacto"}
                  </p>
                </div>
                {selectedIds.includes(contact.id) && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
