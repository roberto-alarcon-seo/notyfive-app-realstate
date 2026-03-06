

## Plan: Centralización de Notas — Bitácora Unificada del Contacto

### Diagnóstico actual

Hoy las notas viven fragmentadas en **5 lugares distintos**:

| Ubicación | Tipo | ¿Se persiste? | ¿Dónde se guarda? |
|---|---|---|---|
| Sidebar derecho (Inbox) — "Notas internas" | Textarea libre | **No** (estado local React, se pierde al cambiar de conversación) | Ningún lado |
| ContactEditor — campo `notes` | Texto en formulario | Sí | `contacts.notes` (un solo campo de texto) |
| ScheduleFollowupModal | Nota del seguimiento | Sí | `conversation_followups.note` |
| ScheduleVisitModal | Comentarios de la cita | Sí | `events.notes` |
| MarkAttendedModal | Nota de atención | Sí | `conversation_activity.payload` |

**Problemas clave:**
1. La nota del sidebar **nunca se guarda** — es estado local que se pierde.
2. El campo `contacts.notes` es un solo bloque de texto sin historial ni autoría.
3. No hay una vista consolidada tipo "bitácora" donde ver todas las interacciones + notas manuales en orden cronológico.
4. El menú "Acciones" no tiene opción de "Crear nota".

---

### Benchmarking: Qué hacen los mejores SaaS

**HubSpot, Salesforce, Pipedrive, Close CRM, Intercom** comparten un patrón común:

- **Timeline unificada por contacto**: Un feed cronológico que mezcla eventos automáticos (llamadas, emails, cambios de etapa) con notas manuales del equipo.
- **Notas como entidad propia**: Cada nota tiene autor, timestamp, y opcionalmente se vincula a una conversación o evento.
- **Nota rápida desde cualquier contexto**: Un botón "Agregar nota" accesible desde el sidebar, la vista de contacto, y los modales de acción. Todas las notas caen al mismo timeline.
- **Notas fijadas (pinned)**: Las notas más importantes se fijan al tope del perfil.
- **Menciones y etiquetas**: Posibilidad de mencionar compañeros o etiquetar notas por tipo.

---

### Propuesta de implementación

#### 1. Nueva tabla `contact_notes`

```sql
CREATE TABLE public.contact_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  author_id uuid NOT NULL,
  content text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  note_type text NOT NULL DEFAULT 'manual',  -- manual | followup | visit | attended
  source_entity_id uuid,  -- ID del followup/event que generó la nota
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

Con `note_type` se distingue el origen sin perder la centralización. RLS por `tenant_id` como el resto de tablas.

#### 2. Sidebar derecho — Reemplazar textarea por lista de notas

- Eliminar el textarea local sin persistencia actual.
- Mostrar las últimas 5 notas del contacto (de `contact_notes`) con autor y timestamp.
- Input compacto en la parte inferior para agregar nota rápida (tipo chat interno).
- Badge de nota pinneada visible al tope si existe.

#### 3. Menú "Acciones" — Agregar opción "Crear nota"

Dentro del `DropdownMenu` existente, agregar:
```
📝 Agregar nota
```
Que abre un mini-modal o un input expandible inline (estilo Intercom) para escribir la nota con más espacio que el input compacto.

#### 4. Timeline unificada en ContactEditor

En la pestaña "Actividad" del editor de contacto, fusionar:
- Eventos de `conversation_activity` (automáticos)
- Notas de `contact_notes` (manuales)
- Seguimientos de `conversation_followups`
- Citas de `events`

Todo ordenado cronológicamente con iconos diferenciados por tipo. Las notas manuales se distinguen visualmente (fondo suave, icono de nota).

#### 5. Migrar notas existentes

- Las notas de seguimientos y citas siguen en sus tablas originales pero se **duplican/reflejan** en `contact_notes` al momento de creación (write-through).
- El campo `contacts.notes` se migra como una nota inicial si tiene contenido.

#### 6. Hook `useContactNotes`

Nuevo hook con:
- `useQuery` para listar notas por contacto
- Mutaciones: `createNote`, `updateNote`, `deleteNote`, `togglePin`
- Suscripción realtime para actualización instantánea entre agentes

---

### Resumen de archivos a crear/modificar

| Archivo | Cambio |
|---|---|
| **Migración SQL** | Crear tabla `contact_notes` + RLS + realtime |
| `src/hooks/useContactNotes.ts` | **Nuevo** — CRUD + realtime |
| `src/components/inbox/ContactProfilePanel.tsx` | Reemplazar textarea por lista de notas + input rápido; agregar "Agregar nota" al dropdown de Acciones |
| `src/components/inbox/AddNoteModal.tsx` | **Nuevo** — Modal para nota con más espacio |
| `src/components/contacts/ContactActivityTimeline.tsx` | Fusionar notas de `contact_notes` en el timeline |
| `src/hooks/useCreateFollowup` / `useEvents` | Write-through: al crear seguimiento/cita, también insertar en `contact_notes` |
| `src/pages/ContactEditor.tsx` | Migrar campo `notes` textarea a la nueva sección de notas centralizadas |

