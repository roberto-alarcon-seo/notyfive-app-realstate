import { useState, useEffect, useMemo } from 'react';
import { Plus, MoreHorizontal, Loader2, Trash2, Edit, AlertCircle, Type, Hash, Calendar, Link as LinkIcon, ToggleLeft, List, GripVertical, ListPlus, FolderOpen } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomFields, CustomFieldFormData, CustomField } from '@/hooks/useCustomFields';
import { useCustomFieldOptions, CustomFieldOptionFormData } from '@/hooks/useCustomFieldOptions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SettingsLayout } from '@/components/settings/SettingsLayout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';

const DATA_TYPE_LABELS: Record<CustomField['data_type'], { label: string; icon: React.ReactNode }> = {
  short_text: { label: 'Texto corto', icon: <Type className="h-4 w-4" /> },
  long_text: { label: 'Texto largo', icon: <Type className="h-4 w-4" /> },
  number: { label: 'Número entero', icon: <Hash className="h-4 w-4" /> },
  decimal: { label: 'Número decimal', icon: <Hash className="h-4 w-4" /> },
  boolean: { label: 'Sí/No', icon: <ToggleLeft className="h-4 w-4" /> },
  date: { label: 'Fecha', icon: <Calendar className="h-4 w-4" /> },
  datetime: { label: 'Fecha y hora', icon: <Calendar className="h-4 w-4" /> },
  url: { label: 'URL', icon: <LinkIcon className="h-4 w-4" /> },
  select: { label: 'Lista desplegable', icon: <List className="h-4 w-4" /> },
};

// Category selector component with combobox-like behavior
function CategorySelect({ 
  value, 
  onChange, 
  existingCategories 
}: { 
  value: string; 
  onChange: (val: string) => void; 
  existingCategories: string[] 
}) {
  const [inputValue, setInputValue] = useState(value);
  
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  return (
    <div className="space-y-2">
      <Input
        placeholder="Ej: Demográficos, Operaciones..."
        value={inputValue}
        onChange={(e) => {
          setInputValue(e.target.value);
          onChange(e.target.value);
        }}
        list="category-suggestions"
      />
      {existingCategories.length > 0 && (
        <datalist id="category-suggestions">
          {existingCategories.map((cat) => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
      )}
      {existingCategories.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {existingCategories.map((cat) => (
            <Badge 
              key={cat} 
              variant={inputValue === cat ? "default" : "outline"} 
              className="cursor-pointer text-xs"
              onClick={() => {
                setInputValue(cat);
                onChange(cat);
              }}
            >
              {cat}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export default function SettingsContactFieldsPage() {
  const { hasRole } = useAuth();
  const { customFields, loading, createCustomField, updateCustomField, deleteCustomField } = useCustomFields();
  const { fetchOptionsForField, saveOptionsForField } = useCustomFieldOptions();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showTypeChangeWarning, setShowTypeChangeWarning] = useState(false);
  const [pendingDataType, setPendingDataType] = useState<CustomField['data_type'] | null>(null);
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);
  const [formData, setFormData] = useState<CustomFieldFormData>({
    name: '',
    data_type: 'short_text',
    is_required: false,
    is_visible_in_list: false,
    category: null,
  });
  const [selectOptions, setSelectOptions] = useState<CustomFieldOptionFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get unique existing categories
  const existingCategories = useMemo(() => {
    const cats = customFields
      .map(f => f.category)
      .filter((c): c is string => !!c);
    return [...new Set(cats)].sort();
  }, [customFields]);

  // Check permissions
  if (!hasRole(['administrador'])) {
    return (
      <SettingsLayout title="Campos personalizados" description="Campos de contactos" icon={ListPlus}>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Sin permisos</h2>
          <p className="text-muted-foreground">No tienes permisos para ver esta sección.</p>
        </div>
      </SettingsLayout>
    );
  }

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    
    if (formData.data_type === 'select') {
      const validOptions = selectOptions.filter(opt => opt.label.trim());
      if (validOptions.length === 0) {
        toast({ title: "Error", description: "Debes agregar al menos una opción.", variant: "destructive" });
        return;
      }
    }
    
    setIsSubmitting(true);
    const success = await createCustomField(formData);
    setIsSubmitting(false);
    
    if (success) {
      setShowCreateModal(false);
      setFormData({ name: '', data_type: 'short_text', is_required: false, is_visible_in_list: false, category: null });
      setSelectOptions([]);
    }
  };

  const handleEdit = async () => {
    if (!selectedField || !formData.name.trim()) return;
    
    if (formData.data_type === 'select') {
      const validOptions = selectOptions.filter(opt => opt.label.trim());
      if (validOptions.length === 0) {
        toast({ title: "Error", description: "Debes agregar al menos una opción.", variant: "destructive" });
        return;
      }
    }
    
    setIsSubmitting(true);
    const success = await updateCustomField(selectedField.id, formData);
    
    if (success && formData.data_type === 'select') {
      const validOptions = selectOptions.filter(opt => opt.label.trim());
      await saveOptionsForField(selectedField.id, validOptions);
    } else if (success && selectedField.data_type === 'select' && formData.data_type !== 'select') {
      await saveOptionsForField(selectedField.id, []);
    }
    
    setIsSubmitting(false);
    
    if (success) {
      setShowEditModal(false);
      setSelectedField(null);
      setSelectOptions([]);
    }
  };

  const handleDelete = async () => {
    if (!selectedField) return;
    setIsSubmitting(true);
    await deleteCustomField(selectedField.id);
    setIsSubmitting(false);
    setShowDeleteDialog(false);
    setSelectedField(null);
  };

  const openEditModal = async (field: CustomField) => {
    setSelectedField(field);
    setFormData({
      name: field.name,
      data_type: field.data_type,
      is_required: field.is_required,
      is_visible_in_list: field.is_visible_in_list,
      category: field.category || null,
    });
    
    if (field.data_type === 'select') {
      const options = await fetchOptionsForField(field.id);
      setSelectOptions(options.map(opt => ({ label: opt.label, value: opt.value })));
    } else {
      setSelectOptions([]);
    }
    
    setShowEditModal(true);
  };

  const handleDataTypeChange = (newType: CustomField['data_type']) => {
    if (selectedField && selectedField.data_type === 'select' && newType !== 'select') {
      setPendingDataType(newType);
      setShowTypeChangeWarning(true);
    } else {
      setFormData({ ...formData, data_type: newType });
      if (newType !== 'select') setSelectOptions([]);
    }
  };

  const confirmTypeChange = () => {
    if (pendingDataType) {
      setFormData({ ...formData, data_type: pendingDataType });
      setSelectOptions([]);
    }
    setShowTypeChangeWarning(false);
    setPendingDataType(null);
  };

  const addSelectOption = () => setSelectOptions([...selectOptions, { label: '', value: '' }]);
  const updateSelectOption = (index: number, field: 'label' | 'value', value: string) => {
    const updated = [...selectOptions];
    updated[index] = { ...updated[index], [field]: value };
    setSelectOptions(updated);
  };
  const removeSelectOption = (index: number) => setSelectOptions(selectOptions.filter((_, i) => i !== index));

  if (loading) {
    return (
      <SettingsLayout title="Campos personalizados" description="Campos de contactos" icon={ListPlus}>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </SettingsLayout>
    );
  }

  return (
    <SettingsLayout 
      title="Campos personalizados" 
      description="Define campos adicionales para tus contactos"
      icon={ListPlus}
    >
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo campo
          </Button>
        </div>

        {/* Table */}
        {customFields.length === 0 ? (
          <div className="border border-border rounded-lg p-8 text-center bg-card">
            <Type className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Sin campos personalizados</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crea campos para almacenar información adicional de tus contactos.
            </p>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Crear primer campo
            </Button>
          </div>
        ) : (
          <div className="border border-border rounded-lg overflow-hidden bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Clave</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Requerido</TableHead>
                  <TableHead>Visible</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customFields.map((field) => (
                  <TableRow key={field.id}>
                    <TableCell className="font-medium">{field.name}</TableCell>
                    <TableCell>
                      {field.category ? (
                        <Badge variant="outline" className="gap-1">
                          <FolderOpen className="h-3 w-3" />
                          {field.category}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">General</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-1 rounded">{field.key}</code>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {DATA_TYPE_LABELS[field.data_type].icon}
                        <span>{DATA_TYPE_LABELS[field.data_type].label}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {field.is_required ? <Badge variant="secondary">Sí</Badge> : <span className="text-muted-foreground">No</span>}
                    </TableCell>
                    <TableCell>
                      {field.is_visible_in_list ? <Badge variant="secondary">Sí</Badge> : <span className="text-muted-foreground">No</span>}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(field)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedField(field); setShowDeleteDialog(true); }} className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={showCreateModal} onOpenChange={(open) => { setShowCreateModal(open); if (!open) setSelectOptions([]); }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Nuevo campo personalizado</DialogTitle>
            <DialogDescription>Crea un nuevo campo para tus contactos.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del campo</Label>
                <Input
                  placeholder="Ej: Empresa, Cargo..."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Categoría / Pestaña</Label>
                <CategorySelect 
                  value={formData.category || ''} 
                  onChange={(val) => setFormData({ ...formData, category: val || null })} 
                  existingCategories={existingCategories} 
                />
                <p className="text-xs text-muted-foreground">Agrupa campos en pestañas al editar contactos</p>
              </div>
              <div className="space-y-2">
                <Label>Tipo de dato</Label>
                <Select
                  value={formData.data_type}
                  onValueChange={(value) => {
                    setFormData({ ...formData, data_type: value as CustomField['data_type'] });
                    if (value !== 'select') setSelectOptions([]);
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_TYPE_LABELS).map(([key, { label, icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.data_type === 'select' && (
                <div className="space-y-3 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Label>Opciones</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addSelectOption}>
                      <Plus className="h-3 w-3 mr-1" />Agregar
                    </Button>
                  </div>
                  {selectOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Agrega opciones para el select.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectOptions.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Etiqueta" value={option.label} onChange={(e) => updateSelectOption(index, 'label', e.target.value)} className="flex-1" />
                          <Input placeholder="Valor" value={option.value} onChange={(e) => updateSelectOption(index, 'value', e.target.value)} className="flex-1" />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSelectOption(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Campo requerido</Label>
                  <p className="text-xs text-muted-foreground">Obligatorio al crear contactos</p>
                </div>
                <Switch checked={formData.is_required} onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Visible en lista</Label>
                  <p className="text-xs text-muted-foreground">Mostrar en tabla de contactos</p>
                </div>
                <Switch checked={formData.is_visible_in_list} onCheckedChange={(checked) => setFormData({ ...formData, is_visible_in_list: checked })} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={showEditModal} onOpenChange={(open) => { setShowEditModal(open); if (!open) { setSelectedField(null); setSelectOptions([]); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Editar campo</DialogTitle>
            <DialogDescription>Modifica la configuración del campo.</DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nombre del campo</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Categoría / Pestaña</Label>
                <CategorySelect 
                  value={formData.category || ''} 
                  onChange={(val) => setFormData({ ...formData, category: val || null })} 
                  existingCategories={existingCategories} 
                />
              </div>
              <div className="space-y-2">
                <Label>Tipo de dato</Label>
                <Select value={formData.data_type} onValueChange={handleDataTypeChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DATA_TYPE_LABELS).map(([key, { label, icon }]) => (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">{icon}<span>{label}</span></div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.data_type === 'select' && (
                <div className="space-y-3 border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <Label>Opciones</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addSelectOption}>
                      <Plus className="h-3 w-3 mr-1" />Agregar
                    </Button>
                  </div>
                  {selectOptions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">Agrega opciones.</p>
                  ) : (
                    <div className="space-y-2">
                      {selectOptions.map((option, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                          <Input placeholder="Etiqueta" value={option.label} onChange={(e) => updateSelectOption(index, 'label', e.target.value)} className="flex-1" />
                          <Input placeholder="Valor" value={option.value} onChange={(e) => updateSelectOption(index, 'value', e.target.value)} className="flex-1" />
                          <Button type="button" variant="ghost" size="icon" onClick={() => removeSelectOption(index)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div><Label>Campo requerido</Label></div>
                <Switch checked={formData.is_required} onCheckedChange={(checked) => setFormData({ ...formData, is_required: checked })} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label>Visible en lista</Label></div>
                <Switch checked={formData.is_visible_in_list} onCheckedChange={(checked) => setFormData({ ...formData, is_visible_in_list: checked })} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={isSubmitting || !formData.name.trim()}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campo "{selectedField?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el campo y todos los valores asociados a contactos. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Type Change Warning */}
      <AlertDialog open={showTypeChangeWarning} onOpenChange={setShowTypeChangeWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cambiar tipo de campo?</AlertDialogTitle>
            <AlertDialogDescription>
              Si cambias el tipo de este campo, se eliminarán las opciones del select existentes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingDataType(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmTypeChange}>Continuar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsLayout>
  );
}
