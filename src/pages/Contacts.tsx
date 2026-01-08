import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Upload, MoreHorizontal, Filter, Mail, Phone, Globe, Loader2, Users, X, Archive, Tag, Trash2, FolderPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useContacts, Contact } from "@/hooks/useContacts";
import { useSegments } from "@/hooks/useSegments";
import { useAuth } from "@/contexts/AuthContext";
import { CsvImportWizard } from "@/components/contacts/CsvImportWizard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface ContactFilters {
  status: string;
  country: string;
  tag: string;
  customField: string;
  customFieldValue: string;
}

interface FieldOption {
  label: string;
  value: string;
}

const CONTACTS_PER_PAGE = 20;

export default function Contacts() {
  const navigate = useNavigate();
  const { hasRole, tenant } = useAuth();
  const { 
    contacts, 
    customFields, 
    loading, 
    contactCount, 
    archiveContact,
    fetchContacts,
  } = useContacts();
  const { segments } = useSegments();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<ContactFilters>({
    status: '',
    country: '',
    tag: '',
    customField: '',
    customFieldValue: '',
  });
  const [fieldOptions, setFieldOptions] = useState<Record<string, FieldOption[]>>({});

  // Bulk action states
  const [showBulkArchiveDialog, setShowBulkArchiveDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [showBulkTagDialog, setShowBulkTagDialog] = useState(false);
  const [showBulkSegmentDialog, setShowBulkSegmentDialog] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [selectedSegmentId, setSelectedSegmentId] = useState("");

  const canManageContacts = hasRole(['owner', 'marketer']);

  // Static segments for adding contacts
  const staticSegments = useMemo(() => 
    segments.filter(s => s.type === 'static'),
    [segments]
  );

  // Visible custom fields in list
  const visibleCustomFields = useMemo(() => 
    customFields.filter(f => f.is_visible_in_list),
    [customFields]
  );

  // Select-type custom fields for filtering
  const selectCustomFields = useMemo(() => 
    customFields.filter(f => f.data_type === 'select'),
    [customFields]
  );

  // Fetch options for select fields
  useEffect(() => {
    const fetchFieldOptions = async () => {
      if (selectCustomFields.length === 0 || !tenant?.id) return;

      const { data: options } = await supabase
        .from('contact_custom_field_options')
        .select('field_id, label, value, sort_order')
        .in('field_id', selectCustomFields.map(f => f.id))
        .order('sort_order', { ascending: true });

      if (options) {
        const optionsMap: Record<string, FieldOption[]> = {};
        options.forEach(opt => {
          const field = selectCustomFields.find(f => f.id === opt.field_id);
          if (field) {
            if (!optionsMap[field.key]) optionsMap[field.key] = [];
            optionsMap[field.key].push({ label: opt.label, value: opt.value });
          }
        });
        setFieldOptions(optionsMap);
      }
    };

    fetchFieldOptions();
  }, [selectCustomFields, tenant?.id]);

  // Extract unique values for filters
  const uniqueCountries = useMemo(() => {
    const countries = contacts.map(c => c.country).filter(Boolean) as string[];
    return [...new Set(countries)].sort();
  }, [contacts]);

  const uniqueTags = useMemo(() => {
    const tags = contacts.flatMap(c => c.tags || []);
    return [...new Set(tags)].sort();
  }, [contacts]);

  // Check if any filter is active
  const hasActiveFilters = useMemo(() => 
    Object.values(filters).some(v => v !== ''),
    [filters]
  );

  const activeFilterCount = useMemo(() => 
    Object.values(filters).filter(v => v !== '').length,
    [filters]
  );

  // Filter contacts based on search and filters
  const filteredContacts = useMemo(() => {
    let result = contacts;

    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(query) ||
        c.email?.toLowerCase().includes(query) ||
        c.phone?.toLowerCase().includes(query) ||
        c.country?.toLowerCase().includes(query) ||
        c.tags.some(t => t.toLowerCase().includes(query))
      );
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter(c => c.status === filters.status);
    }

    // Apply country filter
    if (filters.country) {
      result = result.filter(c => c.country === filters.country);
    }

    // Apply tag filter
    if (filters.tag) {
      result = result.filter(c => c.tags?.includes(filters.tag));
    }

    // Apply custom field filter
    if (filters.customField && filters.customFieldValue) {
      const field = customFields.find(f => f.key === filters.customField);
      if (field) {
        result = result.filter(c => 
          c.custom_fields?.[filters.customField] === filters.customFieldValue
        );
      }
    }

    return result;
  }, [contacts, searchQuery, filters, customFields]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredContacts.length / CONTACTS_PER_PAGE);
  const paginatedContacts = useMemo(() => {
    const startIndex = (currentPage - 1) * CONTACTS_PER_PAGE;
    return filteredContacts.slice(startIndex, startIndex + CONTACTS_PER_PAGE);
  }, [filteredContacts, currentPage]);

  // Reset page when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters]);

  const clearFilters = () => {
    setFilters({
      status: '',
      country: '',
      tag: '',
      customField: '',
      customFieldValue: '',
    });
  };

  const toggleContact = (id: string) => {
    setSelectedContacts(prev =>
      prev.includes(id)
        ? prev.filter(c => c !== id)
        : [...prev, id]
    );
  };

  const toggleAll = () => {
    setSelectedContacts(prev =>
      prev.length === filteredContacts.length ? [] : filteredContacts.map(c => c.id)
    );
  };

  const openArchiveDialog = (contact: Contact) => {
    setSelectedContact(contact);
    setShowArchiveDialog(true);
  };

  const handleArchive = async () => {
    if (!selectedContact) return;
    
    setIsSubmitting(true);
    await archiveContact(selectedContact.id);
    setIsSubmitting(false);
    setShowArchiveDialog(false);
    setSelectedContact(null);
  };

  // Bulk action handlers
  const handleBulkArchive = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'archived' })
        .in('id', selectedContacts);

      if (error) throw error;

      toast({
        title: "Contactos archivados",
        description: `${selectedContacts.length} contactos han sido archivados.`,
      });
      setSelectedContacts([]);
      await fetchContacts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron archivar los contactos",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowBulkArchiveDialog(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ status: 'deleted' })
        .in('id', selectedContacts);

      if (error) throw error;

      toast({
        title: "Contactos eliminados",
        description: `${selectedContacts.length} contactos han sido eliminados.`,
      });
      setSelectedContacts([]);
      await fetchContacts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron eliminar los contactos",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowBulkDeleteDialog(false);
    }
  };

  const handleBulkAddTag = async () => {
    if (!bulkTagInput.trim()) return;
    
    setIsSubmitting(true);
    try {
      // Get current contacts to preserve existing tags
      const { data: currentContacts, error: fetchError } = await supabase
        .from('contacts')
        .select('id, tags')
        .in('id', selectedContacts);

      if (fetchError) throw fetchError;

      // Update each contact with the new tag
      for (const contact of currentContacts || []) {
        const existingTags = contact.tags || [];
        if (!existingTags.includes(bulkTagInput.trim())) {
          const { error: updateError } = await supabase
            .from('contacts')
            .update({ tags: [...existingTags, bulkTagInput.trim()] })
            .eq('id', contact.id);

          if (updateError) throw updateError;
        }
      }

      toast({
        title: "Etiqueta agregada",
        description: `Se agregó "${bulkTagInput}" a ${selectedContacts.length} contactos.`,
      });
      setSelectedContacts([]);
      setBulkTagInput("");
      await fetchContacts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudo agregar la etiqueta",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowBulkTagDialog(false);
    }
  };

  const handleBulkAddToSegment = async () => {
    if (!selectedSegmentId) return;
    
    setIsSubmitting(true);
    try {
      // Get existing contacts in segment
      const { data: existingContacts, error: fetchError } = await supabase
        .from('segment_contacts')
        .select('contact_id')
        .eq('segment_id', selectedSegmentId);

      if (fetchError) throw fetchError;

      const existingIds = new Set((existingContacts || []).map(c => c.contact_id));
      const newContactIds = selectedContacts.filter(id => !existingIds.has(id));

      if (newContactIds.length > 0) {
        const { error: insertError } = await supabase
          .from('segment_contacts')
          .insert(newContactIds.map(contact_id => ({
            segment_id: selectedSegmentId,
            contact_id,
          })));

        if (insertError) throw insertError;
      }

      const segmentName = staticSegments.find(s => s.id === selectedSegmentId)?.name || 'segmento';
      toast({
        title: "Contactos agregados",
        description: `${newContactIds.length} contactos agregados a "${segmentName}".`,
      });
      setSelectedContacts([]);
      setSelectedSegmentId("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: "No se pudieron agregar los contactos al segmento",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowBulkSegmentDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contactos</h1>
            <p className="text-muted-foreground mt-1">
              {contactCount} contactos activos
            </p>
          </div>
          <div className="flex items-center gap-3">
            {canManageContacts && (
              <>
                <Button variant="secondary" onClick={() => setShowImportModal(true)}>
                  <Upload className="w-4 h-4 mr-2" />
                  Importar CSV
                </Button>
                <Button onClick={() => navigate('/contacts/new')}>
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo contacto
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar contactos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Popover open={showFilters} onOpenChange={setShowFilters}>
            <PopoverTrigger asChild>
              <Button variant={hasActiveFilters ? "default" : "secondary"} className="relative">
                <Filter className="w-4 h-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Filtros</h4>
                  {hasActiveFilters && (
                    <Button variant="ghost" size="sm" onClick={clearFilters}>
                      <X className="w-4 h-4 mr-1" />
                      Limpiar
                    </Button>
                  )}
                </div>

                {/* Status filter */}
                <div className="space-y-2">
                  <label className="text-sm text-muted-foreground">Estado</label>
                  <Select
                    value={filters.status}
                    onValueChange={(value) => setFilters(prev => ({ ...prev, status: value === '__all__' ? '' : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos los estados" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Todos los estados</SelectItem>
                      <SelectItem value="active">Activos</SelectItem>
                      <SelectItem value="archived">Archivados</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Country filter */}
                {uniqueCountries.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">País</label>
                    <Select
                      value={filters.country}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, country: value === '__all__' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todos los países" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todos los países</SelectItem>
                        {uniqueCountries.map(country => (
                          <SelectItem key={country} value={country}>{country}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tags filter */}
                {uniqueTags.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Etiqueta</label>
                    <Select
                      value={filters.tag}
                      onValueChange={(value) => setFilters(prev => ({ ...prev, tag: value === '__all__' ? '' : value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Todas las etiquetas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Todas las etiquetas</SelectItem>
                        {uniqueTags.map(tag => (
                          <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Custom field filter */}
                {selectCustomFields.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm text-muted-foreground">Campo personalizado</label>
                    <Select
                      value={filters.customField}
                      onValueChange={(value) => setFilters(prev => ({ 
                        ...prev, 
                        customField: value === '__all__' ? '' : value,
                        customFieldValue: '' 
                      }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar campo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Ninguno</SelectItem>
                        {selectCustomFields.map(field => (
                          <SelectItem key={field.key} value={field.key}>{field.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {filters.customField && (
                      <Select
                        value={filters.customFieldValue}
                        onValueChange={(value) => setFilters(prev => ({ 
                          ...prev, 
                          customFieldValue: value === '__all__' ? '' : value 
                        }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar valor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__all__">Todos los valores</SelectItem>
                          {fieldOptions[filters.customField]?.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}

                <Button 
                  className="w-full" 
                  onClick={() => setShowFilters(false)}
                >
                  Aplicar filtros
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Active filters badges */}
          {hasActiveFilters && (
            <div className="flex items-center gap-2 flex-wrap">
              {filters.status && (
                <Badge variant="secondary" className="gap-1">
                  Estado: {filters.status === 'active' ? 'Activos' : 'Archivados'}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => setFilters(prev => ({ ...prev, status: '' }))}
                  />
                </Badge>
              )}
              {filters.country && (
                <Badge variant="secondary" className="gap-1">
                  País: {filters.country}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => setFilters(prev => ({ ...prev, country: '' }))}
                  />
                </Badge>
              )}
              {filters.tag && (
                <Badge variant="secondary" className="gap-1">
                  Etiqueta: {filters.tag}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => setFilters(prev => ({ ...prev, tag: '' }))}
                  />
                </Badge>
              )}
              {filters.customField && filters.customFieldValue && (
                <Badge variant="secondary" className="gap-1">
                  {selectCustomFields.find(f => f.key === filters.customField)?.name}: {filters.customFieldValue}
                  <X 
                    className="w-3 h-3 cursor-pointer" 
                    onClick={() => setFilters(prev => ({ ...prev, customField: '', customFieldValue: '' }))}
                  />
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedContacts.length > 0 && canManageContacts && (
          <div className="mt-4 p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-between">
            <span className="text-sm font-medium">
              {selectedContacts.length} contacto{selectedContacts.length > 1 ? 's' : ''} seleccionado{selectedContacts.length > 1 ? 's' : ''}
            </span>
            <div className="flex items-center gap-2">
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowBulkTagDialog(true)}
              >
                <Tag className="w-4 h-4 mr-2" />
                Agregar etiqueta
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowBulkSegmentDialog(true)}
                disabled={staticSegments.length === 0}
              >
                <FolderPlus className="w-4 h-4 mr-2" />
                Agregar a segmento
              </Button>
              <Button 
                variant="secondary" 
                size="sm"
                onClick={() => setShowBulkArchiveDialog(true)}
              >
                <Archive className="w-4 h-4 mr-2" />
                Archivar
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setSelectedContacts([])}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full">
          <thead className="bg-background sticky top-0 z-10">
            <tr>
              <th className="w-12 p-4">
                <Checkbox
                  checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                  onCheckedChange={toggleAll}
                />
              </th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Contacto</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Email</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Teléfono</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">País</th>
              <th className="text-left p-4 text-sm font-medium text-muted-foreground">Etiquetas</th>
              {visibleCustomFields.map(field => (
                <th key={field.id} className="text-left p-4 text-sm font-medium text-muted-foreground">
                  {field.name}
                </th>
              ))}
              <th className="w-12 p-4"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginatedContacts.length === 0 ? (
              <tr>
                <td colSpan={7 + visibleCustomFields.length} className="p-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    {searchQuery ? 'No se encontraron contactos' : 'No hay contactos aún'}
                  </p>
                  {canManageContacts && !searchQuery && (
                    <Button className="mt-4" onClick={() => navigate('/contacts/new')}>
                      <Plus className="w-4 h-4 mr-2" />
                      Crear primer contacto
                    </Button>
                  )}
                </td>
              </tr>
            ) : (
              paginatedContacts.map((contact) => (
                <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <Checkbox
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/20 text-primary text-sm">
                          {contact.name.split(" ").map(n => n[0]).join("").substring(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{contact.name}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="text-sm">{contact.email || '-'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span className="text-sm">{contact.phone || '-'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Globe className="w-4 h-4" />
                      <span className="text-sm">{contact.country || '-'}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags.length > 0 ? contact.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs"
                        >
                          {tag}
                        </span>
                      )) : <span className="text-muted-foreground text-sm">-</span>}
                    </div>
                  </td>
                  {visibleCustomFields.map(field => (
                    <td key={field.id} className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {contact.custom_fields?.[field.key] || '-'}
                      </span>
                    </td>
                  ))}
                  <td className="p-4">
                    {canManageContacts && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/contacts/${contact.id}`)}>
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/inbox?contact_id=${contact.id}`)}>
                            Ver conversación
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-destructive"
                            onClick={() => openArchiveDialog(contact)}
                          >
                            Archivar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selectedContacts.length > 0
            ? `${selectedContacts.length} contactos seleccionados`
            : `${filteredContacts.length} contactos`}
        </p>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground mr-2">
            Página {currentPage} de {totalPages || 1}
          </span>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(p => p - 1)}
          >
            Anterior
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage(p => p + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>

      {/* Archive Dialog */}
      <AlertDialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar contacto?</AlertDialogTitle>
            <AlertDialogDescription>
              El contacto "{selectedContact?.name}" será archivado y no aparecerá en la lista principal.
              Puedes restaurarlo más tarde si lo necesitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import CSV Wizard */}
      <CsvImportWizard
        open={showImportModal}
        onOpenChange={setShowImportModal}
        onImportComplete={fetchContacts}
      />

      {/* Bulk Archive Dialog */}
      <AlertDialog open={showBulkArchiveDialog} onOpenChange={setShowBulkArchiveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Archivar {selectedContacts.length} contactos?</AlertDialogTitle>
            <AlertDialogDescription>
              Los contactos seleccionados serán archivados y no aparecerán en la lista principal.
              Puedes restaurarlos más tarde si lo necesitas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkArchive}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {selectedContacts.length} contactos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Los contactos serán eliminados permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Add Tag Dialog */}
      <Dialog open={showBulkTagDialog} onOpenChange={setShowBulkTagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar etiqueta</DialogTitle>
            <DialogDescription>
              La etiqueta se agregará a {selectedContacts.length} contacto{selectedContacts.length > 1 ? 's' : ''} seleccionado{selectedContacts.length > 1 ? 's' : ''}.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nombre de la etiqueta"
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkTagDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkAddTag} disabled={!bulkTagInput.trim() || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add to Segment Dialog */}
      <Dialog open={showBulkSegmentDialog} onOpenChange={setShowBulkSegmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar a segmento</DialogTitle>
            <DialogDescription>
              Los {selectedContacts.length} contactos seleccionados se agregarán al segmento estático elegido.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar segmento" />
              </SelectTrigger>
              <SelectContent>
                {staticSegments.map(segment => (
                  <SelectItem key={segment.id} value={segment.id}>
                    {segment.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {staticSegments.length === 0 && (
              <p className="text-sm text-muted-foreground mt-2">
                No hay segmentos estáticos disponibles. Crea uno primero.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBulkSegmentDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleBulkAddToSegment} disabled={!selectedSegmentId || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Agregar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
