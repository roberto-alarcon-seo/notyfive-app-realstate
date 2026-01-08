import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeveloperApiDocsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CustomField {
  id: string;
  name: string;
  key: string;
  data_type: string;
  is_required: boolean;
  options?: { label: string; value: string }[];
}

export default function DeveloperApiDocsModal({ open, onOpenChange }: DeveloperApiDocsModalProps) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
  const baseUrl = supabaseUrl ? `${supabaseUrl.replace(/\/$/, "")}/functions/v1` : "";

  const [docToken, setDocToken] = useState("");
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState("");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [schemaOpen, setSchemaOpen] = useState(true);

  const copy = (text: string) => {
    navigator.clipboard?.writeText(text);
    toast.success("Copiado al portapapeles");
  };

  const loadCustomFields = async () => {
    if (!baseUrl) return;
    if (!docToken.trim()) {
      setFieldsError("Ingresa tu API Token para cargar los campos personalizados.");
      return;
    }
    setFieldsError("");
    setFieldsLoading(true);
    try {
      const res = await fetch(`${baseUrl}/public-contact-fields`, {
        headers: {
          Authorization: `Bearer ${docToken.trim()}`,
        },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || `Error ${res.status} al cargar campos personalizados`);
      }
      const items = Array.isArray(json) ? json : (json.items || []);
      setCustomFields(items);
      toast.success(`${items.length} campo(s) cargado(s)`);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setFieldsError(message);
    } finally {
      setFieldsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[85vh] min-h-0 flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Documentación API</DialogTitle>
          <DialogDescription>
            Referencia completa para integrar NotyFive con sistemas externos.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea type="always" className="flex-1 min-h-0 pr-4">
          <div className="space-y-6 pb-4">
            {/* Base URL */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Base URL</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Todos los endpoints están expuestos como Edge Functions en Supabase.
              </p>
              <div className="bg-muted p-3 rounded-md text-sm flex items-center justify-between gap-3">
                <code className="break-all">{baseUrl || "No configurado"}</code>
                {baseUrl && (
                  <Button variant="ghost" size="sm" onClick={() => copy(baseUrl)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </section>

            {/* Authentication */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Autenticación</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Incluye tu API Token en el header Authorization.
              </p>
              <div className="bg-muted p-3 rounded-md text-sm flex items-center justify-between gap-3">
                <code>Authorization: Bearer TU_API_TOKEN</code>
                <Button variant="ghost" size="sm" onClick={() => copy("Authorization: Bearer TU_API_TOKEN")}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </section>

            {/* Endpoints */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Endpoints disponibles</h3>
              <div className="space-y-1 text-sm">
                <p><code className="bg-muted px-1.5 py-0.5 rounded">GET /public-contacts</code> — Listar contactos</p>
                <p><code className="bg-muted px-1.5 py-0.5 rounded">GET /public-contacts?id=:id</code> — Obtener contacto</p>
                <p><code className="bg-muted px-1.5 py-0.5 rounded">POST /public-contacts</code> — Crear contacto o Upsert (auto-detectado por payload)</p>
                <p><code className="bg-muted px-1.5 py-0.5 rounded">PATCH /public-contacts</code> — Actualizar contacto</p>
                <p><code className="bg-muted px-1.5 py-0.5 rounded">GET /public-contact-fields</code> — Campos personalizados</p>
              </div>
            </section>

            {/* Campos disponibles */}
            <section className="border rounded-lg overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 bg-muted/30 hover:bg-muted/50 transition-colors"
                onClick={() => setSchemaOpen(!schemaOpen)}
              >
                <h3 className="text-lg font-semibold">Campos disponibles</h3>
                {schemaOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </button>

              {schemaOpen && (
                <div className="p-4 space-y-6">
                  {/* Base fields */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-3">Base fields (estáticos)</h4>
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium">field</th>
                            <th className="text-left p-2 font-medium">type</th>
                            <th className="text-left p-2 font-medium">required</th>
                            <th className="text-left p-2 font-medium">nota</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          <tr><td className="p-2"><code className="text-xs">name</code></td><td className="p-2 text-muted-foreground">string</td><td className="p-2">✅</td><td className="p-2 text-muted-foreground text-xs">Nombre del contacto</td></tr>
                          <tr><td className="p-2"><code className="text-xs">phone</code></td><td className="p-2 text-muted-foreground">string</td><td className="p-2">—</td><td className="p-2 text-muted-foreground text-xs">Formato WhatsApp (+521 en MX)</td></tr>
                          <tr><td className="p-2"><code className="text-xs">email</code></td><td className="p-2 text-muted-foreground">string</td><td className="p-2">—</td><td className="p-2 text-muted-foreground text-xs">Email del contacto</td></tr>
                          <tr><td className="p-2"><code className="text-xs">country</code></td><td className="p-2 text-muted-foreground">string</td><td className="p-2">—</td><td className="p-2 text-muted-foreground text-xs">País</td></tr>
                          <tr><td className="p-2"><code className="text-xs">tags</code></td><td className="p-2 text-muted-foreground">string[]</td><td className="p-2">—</td><td className="p-2 text-muted-foreground text-xs">Etiquetas</td></tr>
                          <tr><td className="p-2"><code className="text-xs">notes</code></td><td className="p-2 text-muted-foreground">string</td><td className="p-2">—</td><td className="p-2 text-muted-foreground text-xs">Notas internas</td></tr>
                          <tr><td className="p-2"><code className="text-xs">status</code></td><td className="p-2 text-muted-foreground">string</td><td className="p-2">—</td><td className="p-2 text-muted-foreground text-xs">active | archived | deleted</td></tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Custom fields */}
                  <div>
                    <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Custom fields (dinámicos)</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Se cargan desde <code className="bg-muted px-1 py-0.5 rounded">GET /public-contact-fields</code>. Usa el <strong>key</strong> dentro de <code className="bg-muted px-1 py-0.5 rounded">custom</code>.
                    </p>

                    <div className="flex items-center gap-2 mb-3">
                      <Input
                        value={docToken}
                        onChange={(e) => setDocToken(e.target.value)}
                        placeholder="Pega tu API Token para cargar campos..."
                        className="flex-1 text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={loadCustomFields}
                        disabled={fieldsLoading}
                      >
                        {fieldsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Cargar"}
                      </Button>
                    </div>

                    {fieldsError && (
                      <p className="text-xs text-destructive mb-3">{fieldsError}</p>
                    )}

                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="text-left p-2 font-medium">name</th>
                            <th className="text-left p-2 font-medium">key</th>
                            <th className="text-left p-2 font-medium">type</th>
                            <th className="text-left p-2 font-medium">required</th>
                            <th className="text-left p-2 font-medium">options</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {customFields.length === 0 ? (
                            <tr>
                              <td className="p-3 text-muted-foreground text-center" colSpan={5}>
                                Sin campos personalizados (o no cargados)
                              </td>
                            </tr>
                          ) : (
                            customFields.map((f) => (
                              <tr key={f.id || f.key}>
                                <td className="p-2">{f.name || "-"}</td>
                                <td className="p-2"><code className="text-xs">{f.key}</code></td>
                                <td className="p-2 text-muted-foreground">{f.data_type || "-"}</td>
                                <td className="p-2">{f.is_required ? "✅" : "—"}</td>
                                <td className="p-2 text-muted-foreground text-xs">
                                  {Array.isArray(f.options) && f.options.length
                                    ? f.options.map((o) => o.value || o.label).join(", ")
                                    : "—"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Ejemplo usando custom fields</p>
                      <div className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute right-2 top-2"
                          onClick={() => copy(`curl -X POST "${baseUrl}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Juan","phone":"5512345678","custom":{"tipo_mascota":"perro","fecha_cumpleanos":"2025-01-01"}}'`)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
{`curl -X POST "${baseUrl}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Juan","phone":"5512345678","custom":{"tipo_mascota":"perro","fecha_cumpleanos":"2025-01-01"}}'`}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Create vs Upsert */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Create vs Upsert (importante)</h3>
              <div className="bg-muted/50 border rounded-lg p-4 text-sm space-y-3">
                <div>
                  <strong>CREATE</strong>: Envía <code className="bg-muted px-1 py-0.5 rounded">name</code> en la raíz del body.
                  <pre className="mt-1 text-xs text-muted-foreground">{`{ "name": "Juan", "phone": "5512345678" }`}</pre>
                </div>
                <div>
                  <strong>UPSERT</strong>: Envía payload con <code className="bg-muted px-1 py-0.5 rounded">match</code> + <code className="bg-muted px-1 py-0.5 rounded">data</code>.
                  <pre className="mt-1 text-xs text-muted-foreground">{`{ "match": { "phone": "5512345678" }, "data": { "name": "Juan" } }`}</pre>
                  <p className="text-xs text-muted-foreground mt-1">Si el contacto existe se actualiza, si no existe se crea.</p>
                </div>
              </div>
            </section>

            {/* Pagination */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Paginación</h3>
              <p className="text-sm text-muted-foreground mb-2">
                El listado de contactos utiliza paginación para evitar respuestas grandes.
              </p>
              <ul className="list-disc list-inside text-sm text-muted-foreground mb-3">
                <li><code className="bg-muted px-1 py-0.5 rounded">limit</code> — Número de registros (default 50, máximo 200)</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">offset</code> — Desplazamiento desde el inicio</li>
              </ul>
              <div className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap relative">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute right-2 top-2"
                  onClick={() => copy(`curl -X GET "${baseUrl}/public-contacts?limit=50&offset=0" \\
  -H "Authorization: Bearer TU_API_TOKEN"`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
{`curl -X GET "${baseUrl}/public-contacts?limit=50&offset=0" \\
  -H "Authorization: Bearer TU_API_TOKEN"`}
              </div>
            </section>

            {/* Include Custom */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Campos personalizados (include=custom)</h3>
              <p className="text-sm text-muted-foreground mb-2">
                Para evitar payloads grandes, los campos personalizados <strong>no se incluyen por defecto</strong>.
                Puedes solicitarlos explícitamente usando <code className="bg-muted px-1 py-0.5 rounded">include=custom</code>.
              </p>
              <div className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap relative">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="absolute right-2 top-2"
                  onClick={() => copy(`curl -X GET "${baseUrl}/public-contacts?limit=25&include=custom" \\
  -H "Authorization: Bearer TU_API_TOKEN"`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
{`curl -X GET "${baseUrl}/public-contacts?limit=25&include=custom" \\
  -H "Authorization: Bearer TU_API_TOKEN"`}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Recomendado solo cuando realmente necesites los valores personalizados.
              </p>
            </section>

            {/* Response example */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Ejemplo de respuesta</h3>
              <div className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
{`{
  "items": [
    {
      "id": "uuid",
      "name": "Juan",
      "phone": "+5215512345678",
      "custom": {
        "tipo_mascota": "perro",
        "fecha_cumpleanos": "2025-01-01"
      }
    }
  ],
  "meta": {
    "limit": 25,
    "offset": 0,
    "next_offset": 25,
    "has_more": true,
    "total": 150
  }
}`}
              </div>
            </section>

            {/* Examples */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Ejemplos</h3>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">Crear contacto</p>
                  <div className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap relative">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-2 top-2"
                      onClick={() => copy(`curl -X POST "${baseUrl}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Juan","phone":"5512345678","custom":{"tipo_mascota":"perro"}}'`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
{`curl -X POST "${baseUrl}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Juan","phone":"5512345678","custom":{"tipo_mascota":"perro"}}'`}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Upsert por teléfono (sincronizaciones)</p>
                  <div className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap relative">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-2 top-2"
                      onClick={() => copy(`curl -X POST "${baseUrl}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"match":{"phone":"5512345678"},"data":{"name":"Juan","tags":["prospecto"]}}'`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
{`curl -X POST "${baseUrl}/public-contacts" \\
  -H "Authorization: Bearer TU_API_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"match":{"phone":"5512345678"},"data":{"name":"Juan","tags":["prospecto"]}}'`}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    El modo upsert se detecta automáticamente por la estructura del payload.
                  </p>
                </div>

                <div>
                  <p className="text-sm font-medium mb-1">Listar campos personalizados</p>
                  <div className="bg-muted p-3 rounded-md text-xs overflow-x-auto whitespace-pre-wrap relative">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="absolute right-2 top-2"
                      onClick={() => copy(`curl -X GET "${baseUrl}/public-contact-fields" \\
  -H "Authorization: Bearer TU_API_TOKEN"`)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
{`curl -X GET "${baseUrl}/public-contact-fields" \\
  -H "Authorization: Bearer TU_API_TOKEN"`}
                  </div>
                </div>
              </div>
            </section>

            {/* Best practices */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Buenas prácticas</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Usa <code className="bg-muted px-1 py-0.5 rounded">limit</code> + <code className="bg-muted px-1 py-0.5 rounded">offset</code> para sincronizaciones.</li>
                <li>Evita <code className="bg-muted px-1 py-0.5 rounded">include=custom</code> en listados masivos.</li>
                <li>Usa <code className="bg-muted px-1 py-0.5 rounded">GET /public-contacts?id=:id</code> para obtener detalle completo.</li>
                <li>Usa <code className="bg-muted px-1 py-0.5 rounded">upsert</code> para integraciones bidireccionales.</li>
              </ul>
            </section>

            {/* Common Errors */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Errores comunes</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li><code className="bg-muted px-1 py-0.5 rounded">422 name is required</code> — Estás usando CREATE pero no enviaste <code>name</code> en la raíz. Para upsert, usa <code>{`{match, data}`}</code>.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">422 match.phone or match.email is required</code> — Falta el campo de búsqueda en upsert.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">401 Unauthorized</code> — Token inválido o expirado.</li>
                <li><code className="bg-muted px-1 py-0.5 rounded">403 Forbidden</code> — El token no tiene el scope requerido.</li>
              </ul>
            </section>

            {/* Notes */}
            <section>
              <h3 className="text-lg font-semibold mb-2">Notas importantes</h3>
              <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                <li>Teléfonos MX se normalizan a formato WhatsApp (+521).</li>
                <li>Campos select solo aceptan valores configurados.</li>
                <li>Usa upsert para sincronizaciones externas.</li>
                <li>Los scopes del token controlan el acceso.</li>
              </ul>
            </section>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}