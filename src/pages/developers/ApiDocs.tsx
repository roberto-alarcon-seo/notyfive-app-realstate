import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Copy, Check, Menu, X, Book, Key, Globe, Code, Database, FileCode, AlertTriangle, List, Loader2, RefreshCw, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

const BASE_URL = "https://srscjpomgqbwsjgldujv.supabase.co/functions/v1";

const sections = [
  { id: "introduction", label: "Introducción", icon: Book },
  { id: "authentication", label: "Autenticación", icon: Key },
  { id: "base-url", label: "Base URL", icon: Globe },
  { id: "endpoints", label: "Endpoints", icon: Code },
  { id: "create-upsert", label: "Create vs Upsert", icon: FileCode },
  { id: "schema", label: "Campos disponibles", icon: Database },
  { id: "pagination", label: "Paginación", icon: List },
  { id: "examples", label: "Ejemplos", icon: FileCode },
  { id: "errors", label: "Errores comunes", icon: AlertTriangle },
];

interface CustomFieldOption {
  label: string;
  value: string;
}

interface CustomField {
  id: string;
  name: string;
  key: string;
  data_type: string;
  is_required: boolean;
  options?: CustomFieldOption[];
}

function CodeBlock({ code, language = "bash" }: { code: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group rounded-lg bg-muted/50 border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground font-mono">{language}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-7 px-2 text-muted-foreground hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          <span className="ml-1.5 text-xs">{copied ? "Copiado" : "Copiar"}</span>
        </Button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm">
        <code className="text-foreground/90 font-mono whitespace-pre-wrap break-all">{code}</code>
      </pre>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: (string | React.ReactNode)[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b border-border">
            {headers.map((header, i) => (
              <th key={i} className="px-4 py-3 text-left font-medium text-foreground">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3 text-muted-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warning" }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 p-4 rounded-lg border",
        type === "warning"
          ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-200"
          : "bg-primary/10 border-primary/30 text-primary-foreground"
      )}
    >
      {type === "warning" ? (
        <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
      ) : (
        <span className="text-lg">📌</span>
      )}
      <span className="text-sm">{children}</span>
    </div>
  );
}

function DynamicCustomFieldsTable() {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFields = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session) {
        setError("Inicia sesión para ver los campos personalizados de tu tenant");
        setLoading(false);
        return;
      }

      // Fetch custom fields for logged-in user's tenant
      const { data: fieldsData, error: fieldsError } = await supabase
        .from("contact_custom_fields")
        .select("id, name, key, data_type, is_required")
        .order("sort_order", { ascending: true });

      if (fieldsError) throw fieldsError;

      // Fetch options for select fields
      const selectFieldIds = (fieldsData || [])
        .filter(f => f.data_type === "select")
        .map(f => f.id);

      let optionsByField: Record<string, CustomFieldOption[]> = {};
      if (selectFieldIds.length) {
        const { data: optionsData } = await supabase
          .from("contact_custom_field_options")
          .select("field_id, label, value, sort_order")
          .in("field_id", selectFieldIds)
          .order("sort_order", { ascending: true });

        for (const opt of optionsData || []) {
          if (!optionsByField[opt.field_id]) {
            optionsByField[opt.field_id] = [];
          }
          optionsByField[opt.field_id].push({ label: opt.label, value: opt.value });
        }
      }

      const enrichedFields = (fieldsData || []).map(f => ({
        ...f,
        options: f.data_type === "select" ? optionsByField[f.id] || [] : undefined,
      }));

      setFields(enrichedFields);
    } catch (err: any) {
      setError(err.message || "Error al cargar campos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFields();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Cargando campos personalizados...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-muted/30 border border-border text-center">
        <p className="text-muted-foreground text-sm">{error}</p>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="p-4 rounded-lg bg-muted/30 border border-border text-center">
        <p className="text-muted-foreground text-sm">No hay campos personalizados configurados en tu tenant.</p>
        <p className="text-muted-foreground text-xs mt-1">Puedes crearlos en Configuración → Campos personalizados</p>
      </div>
    );
  }

  const rows = fields.map(f => [
    <span className="font-medium text-foreground">{f.name}</span>,
    <code className="px-1.5 py-0.5 rounded bg-muted text-foreground text-xs">{f.key}</code>,
    <span className="capitalize">{f.data_type.replace("_", " ")}</span>,
    f.is_required ? "✅" : "—",
    f.options?.length 
      ? f.options.map(o => o.value).join(", ")
      : "—",
  ]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Campos definidos en tu tenant (obtenidos de <code className="px-1 py-0.5 rounded bg-muted text-foreground text-xs">GET /public-contact-fields</code>):
        </p>
        <Button variant="ghost" size="sm" onClick={fetchFields} className="h-8">
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Actualizar
        </Button>
      </div>
      <DataTable
        headers={["Nombre", "Key (usar en custom)", "Tipo", "Requerido", "Opciones (values)"]}
        rows={rows}
      />
    </div>
  );
}

export default function ApiDocs() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeSection, setActiveSection] = useState("introduction");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Filter sections based on search
  const filteredSections = sections.filter((section) =>
    section.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Scroll spy using IntersectionObserver
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    const observerCallback = (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          setActiveSection(id);
          // Update URL hash without triggering scroll
          window.history.replaceState(null, "", `#${id}`);
        }
      });
    };

    const observerOptions: IntersectionObserverInit = {
      root: null,
      rootMargin: "-80px 0px -60% 0px",
      threshold: 0,
    };

    // Observe each section
    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        sectionRefs.current.set(section.id, element);
        const observer = new IntersectionObserver(observerCallback, observerOptions);
        observer.observe(element);
        observers.push(observer);
      }
    });

    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, []);

  // Handle initial hash on page load
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash && sections.some(s => s.id === hash)) {
      // Delay to ensure DOM is ready
      requestAnimationFrame(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
          setActiveSection(hash);
        }
      });
    }
  }, []);

  const scrollToSection = useCallback((id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
      window.history.replaceState(null, "", `#${id}`);
    }
    setSidebarOpen(false);
    setSearchQuery("");
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 lg:px-6 h-14">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink href="/settings" onClick={(e) => { e.preventDefault(); navigate("/settings"); }}>
                    Configuración
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbLink href="/settings/developer" onClick={(e) => { e.preventDefault(); navigate("/settings/developer"); }}>
                    Desarrolladores
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>API</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/developer")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver a configuración
          </Button>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky top-14 left-0 z-40 h-[calc(100vh-3.5rem)] w-64 bg-background border-r border-border transition-transform lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <ScrollArea className="h-full py-6">
          <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar sección..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 bg-muted/30 border-border"
                />
              </div>
            </div>
            <nav className="px-4 space-y-1">
              {filteredSections.length === 0 ? (
                <p className="text-sm text-muted-foreground px-3 py-2">No se encontraron secciones</p>
              ) : (
                filteredSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left",
                        activeSection === section.id
                          ? "bg-primary/10 text-primary border-l-2 border-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {section.label}
                    </button>
                  );
                })
              )}
            </nav>
          </ScrollArea>
        </aside>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 lg:ml-0">
          <ScrollArea className="h-[calc(100vh-3.5rem)]">
            <div className="max-w-4xl mx-auto px-6 py-10 space-y-16 [&>section]:scroll-mt-24">
              
              {/* Introduction */}
              <section id="introduction" className="space-y-6">
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Documentación API – NotyFive</h1>
                  <p className="text-muted-foreground mt-2">Referencia completa para integrar NotyFive con sistemas externos.</p>
                </div>
                <p className="text-lg text-muted-foreground leading-relaxed">
                  La API de NotyFive permite sincronizar contactos y campos personalizados con sistemas externos como CRMs, automatizadores (Zapier, Make) y backends propios.
                </p>
                <div className="grid gap-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wide">Conceptos clave</h3>
                  <ul className="space-y-2 text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      API multi-tenant con aislamiento por token
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Autenticación por Bearer Token
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Upsert automático de contactos (create-or-update)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      Campos personalizados dinámicos por tenant
                    </li>
                  </ul>
                </div>
              </section>

              {/* Authentication */}
              <section id="authentication" className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">Autenticación</h2>
                <p className="text-muted-foreground">
                  Todas las peticiones requieren un API Token generado en NotyFive. El token identifica al tenant y define acceso a contactos y campos personalizados.
                </p>
                <CodeBlock code="Authorization: Bearer TU_API_TOKEN" language="header" />
                <Note type="warning">
                  Mantén tu token seguro. No lo expongas en frontend público ni lo compartas.
                </Note>
              </section>

              {/* Base URL */}
              <section id="base-url" className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">Base URL</h2>
                <p className="text-muted-foreground">
                  Todos los endpoints están expuestos como Supabase Edge Functions.
                </p>
                <CodeBlock code={BASE_URL} language="url" />
              </section>

              {/* Endpoints */}
              <section id="endpoints" className="space-y-8">
                <h2 className="text-2xl font-bold text-foreground">Endpoints</h2>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Contactos</h3>
                  <DataTable
                    headers={["Método", "Endpoint", "Descripción"]}
                    rows={[
                      ["GET", "/public-contacts", "Listar contactos (con paginación)"],
                      ["GET", "/public-contacts?id=:id", "Obtener contacto por ID"],
                      ["POST", "/public-contacts", "Crear contacto o ejecutar Upsert (auto-detectado)"],
                      ["PATCH", "/public-contacts", "Actualizar contacto existente"],
                    ]}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Campos personalizados</h3>
                  <DataTable
                    headers={["Método", "Endpoint", "Descripción"]}
                    rows={[
                      ["GET", "/public-contact-fields", "Obtener definiciones de campos del tenant"],
                    ]}
                  />
                </div>

                <Note>
                  El endpoint <code className="px-1 py-0.5 rounded bg-primary/20">POST /public-contacts</code> detecta automáticamente si es CREATE o UPSERT según la estructura del payload.
                </Note>
              </section>

              {/* Create vs Upsert */}
              <section id="create-upsert" className="space-y-8">
                <h2 className="text-2xl font-bold text-foreground">Create vs Upsert</h2>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">CREATE</h3>
                  <p className="text-muted-foreground">
                    Se ejecuta cuando los campos están en la raíz del body. El campo <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">name</code> es obligatorio.
                  </p>
                  <CodeBlock
                    code={`{
  "name": "Juan",
  "phone": "5512345678",
  "email": "juan@gmail.com",
  "custom": {
    "tipo_mascota": "gato"
  }
}`}
                    language="json"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">UPSERT</h3>
                  <p className="text-muted-foreground">
                    Se ejecuta cuando el body contiene el objeto <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">match</code>. Crea un contacto nuevo si no existe, o actualiza si encuentra coincidencia.
                  </p>
                  <CodeBlock
                    code={`{
  "match": { "phone": "5512345678" },
  "data": {
    "name": "Juan Carvajal",
    "email": "juan@gmail.com",
    "tags": ["prospecto"],
    "custom": {
      "tipo_mascota": "gato",
      "nombre_mascota": "Solovino"
    }
  }
}`}
                    language="json"
                  />
                </div>

                <Note type="warning">
                  Si usas <code className="px-1 py-0.5 rounded bg-yellow-500/20">match</code>, el campo <code className="px-1 py-0.5 rounded bg-yellow-500/20">name</code> DEBE ir dentro de <code className="px-1 py-0.5 rounded bg-yellow-500/20">data</code>. Enviarlo fuera genera error 422.
                </Note>

                <Note>
                  En UPSERT, TODO va dentro de <code className="px-1 py-0.5 rounded bg-primary/20">data</code>. Incluyendo <code className="px-1 py-0.5 rounded bg-primary/20">custom</code>.
                </Note>
              </section>

              {/* Schema / Available Fields */}
              <section id="schema" className="space-y-8">
                <h2 className="text-2xl font-bold text-foreground">Campos disponibles</h2>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Campos base (estáticos)</h3>
                  <p className="text-muted-foreground text-sm">Estos campos están disponibles para todos los tenants:</p>
                  <DataTable
                    headers={["Campo", "Tipo", "Requerido", "Descripción"]}
                    rows={[
                      ["name", "string", "✅", "Nombre del contacto"],
                      ["phone", "string", "—", "Teléfono (formato E.164)"],
                      ["email", "string", "—", "Email"],
                      ["country", "string", "—", "País"],
                      ["tags", "string[]", "—", "Etiquetas"],
                      ["notes", "string", "—", "Notas internas"],
                      ["status", "string", "—", "active | archived | deleted"],
                    ]}
                  />
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Campos personalizados (dinámicos)</h3>
                    <p className="text-muted-foreground mt-2">
                      Los campos personalizados dependen del tenant y se obtienen dinámicamente desde la API.
                    </p>
                  </div>
                  
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li>• Cada campo tiene un <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">key</code> único</li>
                    <li>• Ese <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">key</code> es el que se envía dentro del objeto <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">custom</code></li>
                    <li>• En <strong>UPSERT</strong>, <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">custom</code> DEBE ir dentro de <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">data.custom</code></li>
                  </ul>

                  <div className="space-y-4">
                    <h4 className="text-md font-semibold text-foreground">Formatos por tipo de campo</h4>
                    <DataTable
                      headers={["Tipo", "Formato esperado", "Ejemplo"]}
                      rows={[
                        ["short_text / long_text", "string", '"Solovino"'],
                        ["number", "número entero (como string)", '"42"'],
                        ["decimal", "número decimal (como string)", '"19.99"'],
                        ["boolean", "true/false/1/0/yes/no/si", '"true" o true'],
                        ["date", "YYYY-MM-DD (obligatorio)", '"2025-01-15"'],
                        ["datetime", "ISO8601 (recomendado)", '"2025-01-15T10:30:00Z"'],
                        ["url", "URL válida", '"https://example.com"'],
                        ["select", "option.value (NO label)", '"perro" (no "Perro")'],
                      ]}
                    />
                  </div>

                  <Note type="warning">
                    Para campos <strong>select</strong>: envía el <code className="px-1 py-0.5 rounded bg-yellow-500/20">value</code> de la opción, NO el label visible. Consulta las opciones con <code className="px-1 py-0.5 rounded bg-yellow-500/20">GET /public-contact-fields</code>.
                  </Note>

                  <Collapsible defaultOpen>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        <span>Ver campos de tu tenant</span>
                        <Database className="h-4 w-4" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-4">
                      <DynamicCustomFieldsTable />
                    </CollapsibleContent>
                  </Collapsible>

                  <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                    <p className="text-sm font-medium text-foreground">Ejemplo de respuesta de GET /public-contact-fields:</p>
                    <CodeBlock
                      code={`{
  "items": [
    {
      "id": "uuid-1",
      "name": "Tipo de mascota",
      "key": "tipo_mascota",
      "data_type": "select",
      "is_required": true,
      "options": [
        { "label": "Perro", "value": "perro" },
        { "label": "Gato", "value": "gato" }
      ]
    },
    {
      "id": "uuid-2",
      "name": "Fecha cumpleaños",
      "key": "fecha_cumpleanos",
      "data_type": "date",
      "is_required": false
    }
  ]
}`}
                      language="json"
                    />
                  </div>
                </div>
              </section>

              {/* Pagination */}
              <section id="pagination" className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">Paginación</h2>
                <p className="text-muted-foreground">
                  Las respuestas de listado incluyen metadatos de paginación. Usa <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">offset</code> para cargar más resultados.
                </p>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Parámetros de query</h3>
                  <DataTable
                    headers={["Parámetro", "Default", "Descripción"]}
                    rows={[
                      ["limit", "50", "Cantidad máxima de resultados (máx 200)"],
                      ["offset", "0", "Número de resultados a saltar"],
                      ["include", "—", "Usar include=custom para incluir campos personalizados"],
                    ]}
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Respuesta con metadatos</h3>
                  <CodeBlock
                    code={`{
  "items": [...],
  "meta": {
    "limit": 25,
    "offset": 0,
    "has_more": true,
    "total": 150
  }
}`}
                    language="json"
                  />
                </div>
              </section>

              {/* Examples */}
              <section id="examples" className="space-y-8">
                <h2 className="text-2xl font-bold text-foreground">Ejemplos</h2>
                
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Crear contacto simple</h3>
                  <CodeBlock
                    code={`curl -X POST "${BASE_URL}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Juan","phone":"5512345678"}'`}
                    language="bash"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Upsert con campos personalizados</h3>
                  <p className="text-muted-foreground text-sm">
                    En UPSERT, <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">custom</code> SIEMPRE va dentro de <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">data.custom</code>:
                  </p>
                  <CodeBlock
                    code={`curl -X POST "${BASE_URL}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "match": {"phone": "5512345678"},
    "data": {
      "name": "Juan Carvajal",
      "email": "juan@gmail.com",
      "tags": ["prospecto"],
      "custom": {
        "tipo_mascota": "gato",
        "nombre_mascota": "Solovino",
        "fecha_cumpleanos": "2025-01-01"
      }
    }
  }'`}
                    language="bash"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Respuesta del UPSERT</h3>
                  <p className="text-muted-foreground text-sm">
                    La respuesta incluye el modo de operación, el contacto, los campos guardados y warnings:
                  </p>
                  <CodeBlock
                    code={`{
  "mode": "updated",
  "contact": {
    "id": "uuid-contacto",
    "name": "Juan Carvajal",
    "phone": "+5215512345678",
    "email": "juan@gmail.com",
    "tags": ["prospecto"],
    ...
  },
  "custom": {
    "tipo_mascota": "gato",
    "nombre_mascota": "Solovino",
    "fecha_cumpleanos": "2025-01-01"
  },
  "warnings": []
}`}
                    language="json"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Listar contactos con paginación</h3>
                  <CodeBlock
                    code={`curl "${BASE_URL}/public-contacts?limit=25&offset=0&include=custom" \\
  -H "Authorization: Bearer TU_API_TOKEN"`}
                    language="bash"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Obtener campos personalizados</h3>
                  <CodeBlock
                    code={`curl "${BASE_URL}/public-contact-fields" \\
  -H "Authorization: Bearer TU_API_TOKEN"`}
                    language="bash"
                  />
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Obtener contacto por ID</h3>
                  <CodeBlock
                    code={`curl "${BASE_URL}/public-contacts?id=UUID_DEL_CONTACTO&include=custom" \\
  -H "Authorization: Bearer TU_API_TOKEN"`}
                    language="bash"
                  />
                </div>
              </section>

              {/* Errors */}
              <section id="errors" className="space-y-6">
                <h2 className="text-2xl font-bold text-foreground">Errores comunes</h2>
                <DataTable
                  headers={["Error", "Causa", "Solución"]}
                  rows={[
                    ["name is required", "CREATE sin name o name fuera de data en UPSERT", "En UPSERT, name debe ir dentro de data"],
                    ["Campo select no se actualiza", "Se envió el label en lugar del value", "Usa option.value (ej: 'perro' no 'Perro')"],
                    ["Invalid value for select field X. Allowed: a,b,c", "El value no existe en las opciones del campo", "Usa uno de los valores permitidos listados"],
                    ["Invalid date (expected YYYY-MM-DD)", "Formato de fecha incorrecto", "Usa formato YYYY-MM-DD (ej: 2025-01-15)"],
                    ["Invalid datetime (expected ISO8601)", "Formato de datetime incorrecto", "Usa ISO8601 (ej: 2025-01-15T10:30:00Z)"],
                    ["custom no se guarda en UPSERT", "custom está fuera de data", "En UPSERT, usa data.custom, no custom en raíz"],
                    ["Campos personalizados no aparecen", "No se incluyó include=custom", "Agrega include=custom al query"],
                    ["401 Unauthorized", "Token inválido, expirado o ausente", "Genera un nuevo token"],
                    ["403 Forbidden", "Token sin scope necesario", "Verifica que el token tenga contacts:write"],
                    ["422 Unprocessable Entity", "Validación fallida en el payload", "Revisa la estructura del JSON y los formatos"],
                  ]}
                />

                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-foreground">Ejemplo de error de validación (422)</h3>
                  <CodeBlock
                    code={`{
  "error": "Validation error",
  "fields": {
    "tipo_mascota": "Invalid value for select field tipo_mascota. Allowed: perro, gato"
  }
}`}
                    language="json"
                  />
                </div>

                <Note>
                  Si envías un campo personalizado que no existe en tu tenant, recibirás un <code className="px-1 py-0.5 rounded bg-primary/20">warning</code> en la respuesta, pero los campos válidos se guardarán normalmente.
                </Note>
              </section>

              {/* Footer spacing */}
              <div className="h-20" />
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}
