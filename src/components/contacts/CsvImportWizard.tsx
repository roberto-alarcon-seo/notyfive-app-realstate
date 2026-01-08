import { useState, useCallback, useEffect, useMemo } from "react";
import { 
  Upload, Download, X, FileText, AlertCircle, CheckCircle2, 
  Loader2, AlertTriangle, ChevronRight, ChevronLeft 
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

interface CustomFieldDefinition {
  id: string;
  name: string;
  key: string;
  data_type: string;
  is_required: boolean;
  category: string | null;
  options?: { label: string; value: string }[];
}

interface ParsedRow {
  rowIndex: number;
  data: Record<string, string>;
  errors: string[];
  warnings: string[];
  isValid: boolean;
}

interface ImportResult {
  created: number;
  updated: number;
  failed: number;
  errors: { row: number; phone?: string; reason: string }[];
}

interface CsvImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

const BASE_FIELDS = ['name', 'phone', 'email', 'country', 'tags', 'notes'];

export function CsvImportWizard({ open, onOpenChange, onImportComplete }: CsvImportWizardProps) {
  const { tenant } = useAuth();
  const [step, setStep] = useState(1);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [customFields, setCustomFields] = useState<CustomFieldDefinition[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [unmappedColumns, setUnmappedColumns] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Fetch custom fields on mount
  useEffect(() => {
    if (open && tenant?.id) {
      fetchCustomFields();
    }
  }, [open, tenant?.id]);

  const fetchCustomFields = async () => {
    try {
      const { data, error } = await supabase
        .from('contact_custom_fields')
        .select('id, name, key, data_type, is_required, sort_order, category')
        .eq('tenant_id', tenant?.id)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      // Fetch options for select fields
      const selectFields = (data || []).filter(f => f.data_type === 'select');
      let optionsMap: Record<string, { label: string; value: string }[]> = {};

      if (selectFields.length > 0) {
        const { data: optionsData } = await supabase
          .from('contact_custom_field_options')
          .select('field_id, label, value, sort_order')
          .in('field_id', selectFields.map(f => f.id))
          .order('sort_order', { ascending: true });

        if (optionsData) {
          optionsData.forEach((opt: any) => {
            if (!optionsMap[opt.field_id]) optionsMap[opt.field_id] = [];
            optionsMap[opt.field_id].push({ label: opt.label, value: opt.value });
          });
        }
      }

      const fieldsWithOptions = (data || []).map(f => ({
        ...f,
        options: optionsMap[f.id] || undefined,
      }));

      setCustomFields(fieldsWithOptions);
    } catch (error) {
      console.error('Error fetching custom fields:', error);
    }
  };

  // Generate and download CSV template
  const downloadTemplate = useCallback(() => {
    const headers = [...BASE_FIELDS, ...customFields.map(f => f.key)];
    
    // Example row 1
    const exampleRow1 = [
      'Juan Pérez',
      '+5215512345678',
      'juan@ejemplo.com',
      'México',
      'prospecto',
      'Nota de ejemplo',
      ...customFields.map(f => {
        if (f.data_type === 'select' && f.options?.length) {
          return f.options[0].value;
        }
        if (f.data_type === 'date') return '2025-01-15';
        if (f.data_type === 'datetime') return '2025-01-15T10:30:00';
        if (f.data_type === 'boolean') return 'true';
        if (f.data_type === 'number' || f.data_type === 'decimal') return '100';
        if (f.data_type === 'url') return 'https://ejemplo.com';
        return 'Valor ejemplo';
      }),
    ];

    // Example row 2 (with multiple tags)
    const exampleRow2 = [
      'María García',
      '+5215598765432',
      'maria@ejemplo.com',
      'México',
      'cliente,vip',
      '',
      ...customFields.map(f => {
        if (f.data_type === 'select' && f.options?.length && f.options.length > 1) {
          return f.options[1].value;
        }
        if (f.data_type === 'date') return '2024-06-20';
        if (f.data_type === 'boolean') return 'false';
        return '';
      }),
    ];

    const csvContent = [
      headers.join(','),
      exampleRow1.map(v => `"${v}"`).join(','),
      exampleRow2.map(v => `"${v}"`).join(','),
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'plantilla_contactos.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [customFields]);

  // Parse CSV content
  const parseCSV = (text: string): { headers: string[]; rows: string[][] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const parseRow = (line: string): string[] => {
      const result: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(parseRow);

    return { headers, rows };
  };

  // Normalize phone number
  const normalizePhone = (phone: string): string => {
    if (!phone) return '';
    let normalized = phone.replace(/[\s\-\(\)\.]/g, '');
    if (!normalized.startsWith('+')) {
      if (normalized.length === 10) {
        normalized = '+521' + normalized;
      } else if (normalized.startsWith('52') && normalized.length === 12) {
        normalized = '+' + normalized;
      } else {
        normalized = '+52' + normalized;
      }
    }
    return normalized;
  };

  // Parse tags from string
  const parseTags = (tagsStr: string): string[] => {
    if (!tagsStr) return [];
    return tagsStr.split(/[,|;]/).map(t => t.trim()).filter(t => t);
  };

  // Validate a single row
  const validateRow = useCallback((
    rowData: Record<string, string>,
    rowIndex: number
  ): ParsedRow => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required base field: name
    if (!rowData.name?.trim()) {
      errors.push('El campo "name" es requerido');
    }

    // Check phone format
    if (rowData.phone) {
      const normalized = normalizePhone(rowData.phone);
      if (!/^\+\d{10,15}$/.test(normalized)) {
        warnings.push(`Teléfono "${rowData.phone}" tiene formato inusual`);
      }
    }

    // Check email format
    if (rowData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rowData.email)) {
      warnings.push(`Email "${rowData.email}" podría ser inválido`);
    }

    // Validate custom fields
    customFields.forEach(field => {
      const value = rowData[field.key];
      
      if (field.is_required && !value?.trim()) {
        errors.push(`Campo "${field.name}" es requerido`);
        return;
      }

      if (!value?.trim()) return;

      // Validate by type
      if (field.data_type === 'select' && field.options) {
        const validValues = field.options.map(o => o.value.toLowerCase());
        const validLabels = field.options.map(o => o.label.toLowerCase());
        const inputLower = value.toLowerCase();
        
        if (!validValues.includes(inputLower) && !validLabels.includes(inputLower)) {
          errors.push(`Valor "${value}" inválido para "${field.name}". Permitidos: ${field.options.map(o => o.value).join(', ')}`);
        }
      }

      if (field.data_type === 'date') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          errors.push(`Fecha "${value}" debe ser YYYY-MM-DD para "${field.name}"`);
        }
      }

      if (field.data_type === 'datetime') {
        if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2})?)?/.test(value)) {
          errors.push(`Fecha/hora "${value}" debe ser formato ISO para "${field.name}"`);
        }
      }

      if (field.data_type === 'number' || field.data_type === 'decimal') {
        if (isNaN(Number(value))) {
          errors.push(`"${value}" no es un número válido para "${field.name}"`);
        }
      }

      if (field.data_type === 'boolean') {
        const valid = ['true', 'false', '1', '0', 'yes', 'no', 'si', 'sí'].includes(value.toLowerCase());
        if (!valid) {
          errors.push(`"${value}" no es booleano válido para "${field.name}"`);
        }
      }
    });

    return {
      rowIndex,
      data: rowData,
      errors,
      warnings,
      isValid: errors.length === 0,
    };
  }, [customFields]);

  // Auto-map columns based on header names
  const autoMapColumns = useCallback((headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};
    const customFieldKeys = customFields.map(f => f.key.toLowerCase());

    headers.forEach((header, index) => {
      const h = header.toLowerCase().trim();
      const headerKey = index.toString();

      // Map base fields
      if (h === 'name' || h === 'nombre') mapping[headerKey] = 'name';
      else if (h === 'email' || h === 'correo') mapping[headerKey] = 'email';
      else if (h === 'phone' || h === 'telefono' || h === 'teléfono') mapping[headerKey] = 'phone';
      else if (h === 'country' || h === 'pais' || h === 'país') mapping[headerKey] = 'country';
      else if (h === 'tags' || h === 'etiquetas') mapping[headerKey] = 'tags';
      else if (h === 'notes' || h === 'notas') mapping[headerKey] = 'notes';
      // Map custom fields by exact key match
      else if (customFieldKeys.includes(h)) {
        const field = customFields.find(f => f.key.toLowerCase() === h);
        if (field) mapping[headerKey] = `custom:${field.key}`;
      }
    });

    return mapping;
  }, [customFields]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      toast({
        title: "Archivo inválido",
        description: "Por favor selecciona un archivo CSV",
        variant: "destructive",
      });
      return;
    }

    setCsvFile(file);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { headers, rows } = parseCSV(text);

      if (headers.length === 0) {
        toast({
          title: "CSV vacío",
          description: "El archivo no contiene datos",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      setCsvHeaders(headers);
      setCsvRows(rows);

      // Auto-map columns
      const mapping = autoMapColumns(headers);
      setColumnMapping(mapping);

      // Find unmapped columns
      const mappedIndices = Object.keys(mapping);
      const unmapped = headers.filter((_, idx) => !mappedIndices.includes(idx.toString()));
      setUnmappedColumns(unmapped);

      setIsLoading(false);
      setStep(2);
    };

    reader.readAsText(file, 'UTF-8');
  }, [autoMapColumns]);

  // Process rows for preview
  useEffect(() => {
    if (step === 2 && csvRows.length > 0) {
      const processed = csvRows.slice(0, 10).map((row, idx) => {
        const rowData: Record<string, string> = {};

        Object.entries(columnMapping).forEach(([colIdx, fieldKey]) => {
          const value = row[parseInt(colIdx)] || '';
          if (fieldKey.startsWith('custom:')) {
            rowData[fieldKey.replace('custom:', '')] = value;
          } else {
            rowData[fieldKey] = value;
          }
        });

        return validateRow(rowData, idx + 1);
      });

      setParsedRows(processed);
    }
  }, [step, csvRows, columnMapping, validateRow]);

  // Stats for preview
  const previewStats = useMemo(() => {
    if (parsedRows.length === 0) return { valid: 0, invalid: 0, warnings: 0 };
    return {
      valid: parsedRows.filter(r => r.isValid).length,
      invalid: parsedRows.filter(r => !r.isValid).length,
      warnings: parsedRows.filter(r => r.warnings.length > 0).length,
    };
  }, [parsedRows]);

  // Map select field labels to values
  const mapSelectLabelToValue = (fieldKey: string, value: string): string => {
    const field = customFields.find(f => f.key === fieldKey);
    if (!field?.options) return value;

    const inputLower = value.toLowerCase();
    const matchedOption = field.options.find(
      o => o.value.toLowerCase() === inputLower || o.label.toLowerCase() === inputLower
    );
    return matchedOption?.value || value;
  };

  // Normalize boolean value
  const normalizeBoolean = (value: string): string => {
    const v = value.toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí'].includes(v)) return 'true';
    if (['false', '0', 'no'].includes(v)) return 'false';
    return value;
  };

  // Upsert custom field values directly using Supabase client
  const upsertCustomFieldValues = async (contactId: string, customData: Record<string, string>) => {
    if (!tenant?.id || Object.keys(customData).length === 0) return;

    // Get field definitions for the keys we have
    const keys = Object.keys(customData);
    const { data: fields, error: fieldsErr } = await supabase
      .from('contact_custom_fields')
      .select('id, key, data_type')
      .eq('tenant_id', tenant.id)
      .in('key', keys);

    if (fieldsErr) throw fieldsErr;
    if (!fields?.length) return;

    const fieldByKey = new Map(fields.map(f => [f.key, f]));

    // Get select options for select fields
    const selectFieldIds = fields.filter(f => f.data_type === 'select').map(f => f.id);
    const optionsByFieldId = new Map<string, { label: string; value: string }[]>();

    if (selectFieldIds.length) {
      const { data: opts, error: optsErr } = await supabase
        .from('contact_custom_field_options')
        .select('field_id, label, value')
        .in('field_id', selectFieldIds);

      if (optsErr) throw optsErr;
      (opts || []).forEach(o => {
        const arr = optionsByFieldId.get(o.field_id) || [];
        arr.push(o);
        optionsByFieldId.set(o.field_id, arr);
      });
    }

    // Build upsert rows
    const rows: { contact_id: string; field_id: string; value_text: string; updated_at: string }[] = [];
    for (const key of keys) {
      const def = fieldByKey.get(key);
      if (!def) continue;

      let v = customData[key];
      if (v === undefined || v === null || v === '') continue;

      // Normalize boolean
      if (def.data_type === 'boolean') {
        v = ['true', '1', 'yes', 'si', 'sí'].includes(v.toLowerCase()) ? 'true' : 'false';
      } else {
        v = String(v).trim();
      }

      // Validate and map select values
      if (def.data_type === 'select') {
        const opts = optionsByFieldId.get(def.id) || [];
        const found = opts.find(
          o => o.value.toLowerCase() === v.toLowerCase() || o.label.toLowerCase() === v.toLowerCase()
        );
        if (!found) continue; // Skip invalid select values
        v = found.value;
      }

      rows.push({
        contact_id: contactId,
        field_id: def.id,
        value_text: v,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length === 0) return;

    const { error: upErr } = await supabase
      .from('contact_custom_field_values')
      .upsert(rows, { onConflict: 'contact_id,field_id' });

    if (upErr) throw upErr;
  };

  // Import contacts using direct Supabase client
  const handleImport = async () => {
    if (!tenant?.id) return;

    setIsImporting(true);
    setImportProgress(0);

    const result: ImportResult = { created: 0, updated: 0, failed: 0, errors: [] };
    const batchSize = 10;
    const totalRows = csvRows.length;

    // Process all rows (not just preview)
    const allProcessedRows = csvRows.map((row, idx) => {
      const rowData: Record<string, string> = {};

      Object.entries(columnMapping).forEach(([colIdx, fieldKey]) => {
        const value = row[parseInt(colIdx)] || '';
        if (fieldKey.startsWith('custom:')) {
          rowData[fieldKey.replace('custom:', '')] = value;
        } else {
          rowData[fieldKey] = value;
        }
      });

      return { rowIndex: idx + 1, data: rowData };
    });

    // Import in batches
    for (let i = 0; i < allProcessedRows.length; i += batchSize) {
      const batch = allProcessedRows.slice(i, i + batchSize);

      for (const { rowIndex, data } of batch) {
        // Skip rows without name
        if (!data.name?.trim()) {
          result.failed++;
          result.errors.push({ row: rowIndex, reason: 'Campo "name" requerido' });
          continue;
        }

        // Build custom fields object
        const customData: Record<string, string> = {};
        customFields.forEach(field => {
          let value = data[field.key];
          if (value) {
            // Normalize values by type
            if (field.data_type === 'select') {
              value = mapSelectLabelToValue(field.key, value);
            } else if (field.data_type === 'boolean') {
              value = normalizeBoolean(value);
            }
            customData[field.key] = value;
          }
        });

        const phone = data.phone ? normalizePhone(data.phone) : null;
        const email = data.email?.trim() || null;
        const contactName = data.name.trim();
        const country = data.country?.trim() || null;
        const tags = parseTags(data.tags || '');
        const notes = data.notes?.trim() || null;

        try {
          let existingContact = null;

          // Try to find existing contact by phone
          if (phone) {
            const { data: found } = await supabase
              .from('contacts')
              .select('id')
              .eq('tenant_id', tenant.id)
              .eq('phone', phone)
              .neq('status', 'deleted')
              .maybeSingle();
            existingContact = found;
          }

          if (existingContact) {
            // Update existing contact
            const { error: updateErr } = await supabase
              .from('contacts')
              .update({
                name: contactName,
                email,
                country,
                tags,
                notes,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingContact.id)
              .eq('tenant_id', tenant.id);

            if (updateErr) throw updateErr;

            // Upsert custom fields
            if (Object.keys(customData).length > 0) {
              await upsertCustomFieldValues(existingContact.id, customData);
            }

            result.updated++;
          } else {
            // Create new contact
            const { data: created, error: createErr } = await supabase
              .from('contacts')
              .insert({
                tenant_id: tenant.id,
                name: contactName,
                phone,
                email,
                country,
                tags,
                notes,
                status: 'active',
              })
              .select('id')
              .single();

            if (createErr) throw createErr;

            // Upsert custom fields
            if (created && Object.keys(customData).length > 0) {
              await upsertCustomFieldValues(created.id, customData);
            }

            result.created++;
          }
        } catch (err: any) {
          result.failed++;
          result.errors.push({ row: rowIndex, phone: phone || undefined, reason: err.message || 'Error desconocido' });
        }
      }

      // Update progress
      setImportProgress(Math.min(100, Math.round(((i + batch.length) / totalRows) * 100)));

      // Small delay between batches
      if (i + batchSize < allProcessedRows.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    setImportResult(result);
    setIsImporting(false);
    setStep(3);

    if (result.created > 0 || result.updated > 0) {
      onImportComplete();
    }
  };

  // Download error report
  const downloadErrorReport = () => {
    if (!importResult?.errors.length) return;

    const headers = ['Fila', 'Teléfono', 'Error'];
    const rows = importResult.errors.map(e => [
      e.row.toString(),
      e.phone || '-',
      `"${e.reason.replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'errores_importacion.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Reset wizard
  const resetWizard = () => {
    setStep(1);
    setCsvFile(null);
    setCsvHeaders([]);
    setCsvRows([]);
    setParsedRows([]);
    setColumnMapping({});
    setUnmappedColumns([]);
    setImportProgress(0);
    setImportResult(null);
  };

  const handleClose = () => {
    resetWizard();
    onOpenChange(false);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files?.[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  // Get available fields for mapping
  const getAvailableFields = () => {
    const fields = [
      { value: '__skip__', label: 'No mapear' },
      { value: 'name', label: 'Nombre (requerido)' },
      { value: 'phone', label: 'Teléfono' },
      { value: 'email', label: 'Email' },
      { value: 'country', label: 'País' },
      { value: 'tags', label: 'Etiquetas' },
      { value: 'notes', label: 'Notas' },
      ...customFields.map(f => ({
        value: `custom:${f.key}`,
        label: `${f.name}${f.is_required ? ' (requerido)' : ''}`,
      })),
    ];
    return fields;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar contactos desde CSV</DialogTitle>
          <DialogDescription>
            {step === 1 && "Descarga la plantilla o sube tu archivo CSV"}
            {step === 2 && "Revisa la previsualización y mapeo de columnas"}
            {step === 3 && "Resultado de la importación"}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step >= s
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div
                  className={cn(
                    "w-12 h-1 mx-1 rounded transition-colors",
                    step > s ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Template & Upload */}
        {step === 1 && (
          <div className="flex-1 space-y-6 py-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium">Plantilla CSV</p>
                  <p className="text-sm text-muted-foreground">
                    Incluye campos base y {customFields.length} campos personalizados
                  </p>
                </div>
              </div>
              <Button onClick={downloadTemplate} variant="secondary">
                <Download className="h-4 w-4 mr-2" />
                Descargar plantilla
              </Button>
            </div>

            <div
              className={cn(
                "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
                dragActive ? "border-primary bg-primary/5" : "border-border"
              )}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">
                Arrastra tu archivo CSV aquí
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                o haz clic para seleccionar
              </p>
              <Input
                type="file"
                accept=".csv"
                className="max-w-xs mx-auto cursor-pointer"
                onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
              />
            </div>

            <div className="text-sm text-muted-foreground space-y-1">
              <p>• La primera fila debe contener los encabezados</p>
              <p>• Para campos select, usa el <strong>value</strong> (no el label)</p>
              <p>• Para fechas usa formato <strong>YYYY-MM-DD</strong></p>
              <p>• Para múltiples etiquetas sepáralas con coma: prospecto,cliente</p>
            </div>

            {isLoading && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2">Procesando archivo...</span>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Preview & Mapping */}
        {step === 2 && (
          <div className="flex-1 overflow-hidden flex flex-col gap-4">
            {/* File info */}
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">{csvFile?.name}</span>
                <Badge variant="secondary">{csvRows.length} filas</Badge>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  resetWizard();
                }}
              >
                <X className="h-4 w-4 mr-1" />
                Cambiar archivo
              </Button>
            </div>

            {/* Unmapped columns warning */}
            {unmappedColumns.length > 0 && (
              <div className="flex items-start gap-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-500">Columnas sin mapear</p>
                  <p className="text-sm text-muted-foreground">
                    Las siguientes columnas serán ignoradas: {unmappedColumns.join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Column mapping */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Mapeo de columnas</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {csvHeaders.map((header, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground truncate w-24" title={header}>
                      {header}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={columnMapping[idx.toString()] || '__skip__'}
                      onValueChange={(value) => {
                        setColumnMapping(prev => ({
                          ...prev,
                          [idx.toString()]: value === '__skip__' ? '' : value,
                        }));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="No mapear" />
                      </SelectTrigger>
                      <SelectContent>
                        {getAvailableFields().map(f => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            {/* Required fields reminder */}
            {customFields.some(f => f.is_required) && (
              <div className="flex items-start gap-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <AlertCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-500">Campos requeridos</p>
                  <p className="text-sm text-muted-foreground">
                    Campos personalizados obligatorios: {customFields.filter(f => f.is_required).map(f => f.name).join(', ')}
                  </p>
                </div>
              </div>
            )}

            {/* Validation stats */}
            <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-sm">{previewStats.valid} válidos</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm">{previewStats.invalid} con errores</span>
              </div>
              {previewStats.warnings > 0 && (
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm">{previewStats.warnings} con advertencias</span>
                </div>
              )}
            </div>

            {/* Preview table */}
            <div className="flex-1 border rounded-lg overflow-hidden">
              <ScrollArea className="h-[250px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">#</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead className="min-w-[200px]">Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row) => (
                      <TableRow key={row.rowIndex} className={cn(!row.isValid && "bg-destructive/5")}>
                        <TableCell className="font-mono text-xs">{row.rowIndex}</TableCell>
                        <TableCell>{row.data.name || <span className="text-destructive">-</span>}</TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.data.phone ? normalizePhone(row.data.phone) : '-'}
                        </TableCell>
                        <TableCell>{row.data.email || '-'}</TableCell>
                        <TableCell>
                          {row.isValid ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="text-xs text-green-500">OK</span>
                              {row.warnings.length > 0 && (
                                <span className="text-xs text-yellow-500 ml-2" title={row.warnings.join('\n')}>
                                  ({row.warnings.length} advertencia{row.warnings.length > 1 ? 's' : ''})
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col gap-1">
                              {row.errors.map((error, errIdx) => (
                                <div key={errIdx} className="flex items-start gap-1">
                                  <AlertCircle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                                  <span className="text-xs text-destructive">{error}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Atrás
              </Button>
              <Button
                onClick={handleImport}
                disabled={isImporting || !columnMapping['0'] || Object.values(columnMapping).every(v => !v)}
              >
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    Importar {csvRows.length} contactos
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
            </div>

            {/* Progress */}
            {isImporting && (
              <div className="space-y-2">
                <Progress value={importProgress} />
                <p className="text-sm text-center text-muted-foreground">
                  Procesando... {importProgress}%
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Results */}
        {step === 3 && importResult && (
          <div className="flex-1 space-y-6 py-4">
            <div className="text-center py-8">
              {importResult.failed === 0 ? (
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
              ) : importResult.created + importResult.updated > 0 ? (
                <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
              ) : (
                <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
              )}
              <h3 className="text-xl font-semibold mb-2">
                {importResult.failed === 0 ? 'Importación completada' : 'Importación finalizada con errores'}
              </h3>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg text-center">
                <p className="text-3xl font-bold text-green-500">{importResult.created}</p>
                <p className="text-sm text-muted-foreground">Creados</p>
              </div>
              <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg text-center">
                <p className="text-3xl font-bold text-blue-500">{importResult.updated}</p>
                <p className="text-sm text-muted-foreground">Actualizados</p>
              </div>
              <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-center">
                <p className="text-3xl font-bold text-destructive">{importResult.failed}</p>
                <p className="text-sm text-muted-foreground">Fallidos</p>
              </div>
            </div>

            {importResult.errors.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">Errores ({importResult.errors.length})</p>
                  <Button variant="outline" size="sm" onClick={downloadErrorReport}>
                    <Download className="h-4 w-4 mr-2" />
                    Descargar reporte
                  </Button>
                </div>
                <ScrollArea className="h-[150px] border rounded-lg">
                  <div className="p-3 space-y-2">
                    {importResult.errors.slice(0, 10).map((err, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-sm">
                        <Badge variant="destructive" className="shrink-0">Fila {err.row}</Badge>
                        <span className="text-muted-foreground">{err.reason}</span>
                      </div>
                    ))}
                    {importResult.errors.length > 10 && (
                      <p className="text-sm text-muted-foreground">
                        ... y {importResult.errors.length - 10} errores más
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={resetWizard}>
                Importar más
              </Button>
              <Button onClick={handleClose}>
                Finalizar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
