
## Contexto

Hoy `tenant_ai_settings` tiene 14 campos editables en `/settings/ai-config`. Auditando `supabase/functions/ai-chat-response/index.ts` confirmo qué se usa de verdad y qué no:

| Campo UI | ¿Se aplica en el prompt? | Notas |
|---|---|---|
| `agent_name` | Sí — se inyecta en system prompt | OK |
| `company_name` | Sí | OK |
| `timezone` | Sí (fechas de visita) | OK |
| `behavior_prompt` | Sí — bloque "COMPORTAMIENTO DEL NEGOCIO" | **Núcleo** |
| `fallback_message` | Sí (handoff) | OK |
| `tone` (4 opciones) | Sí, pero es 1 línea genérica | **Débil**, no diferencia LATAM vs ES |
| `use_emojis` + `max_emojis_per_message` | Sí, pero solo "puedes usar hasta N" | **Débil**, el modelo lo ignora a menudo |
| `never_reveal_ai` | Sí | OK |
| `use_customer_name` | Sí (en mensajes de fallback) | OK |
| `response_delay_seconds` | Sí (delay real de envío) | OK |
| `escalate_on_human_request` | Sí (keywords "humano", "asesor"…) | OK |
| `escalate_on_frustration` | Sí (keywords "molesto", "enojado"…) | Frágil, basado en regex |
| `escalate_on_no_answer` | Sí (marcador `[ESCALAR]`) | OK |

**Lo que NO existe hoy y el usuario necesita:**
- Variante regional (México vs Colombia vs España vs Argentina) → modismos, "tú/usted/vos", formato de moneda y teléfono.
- Idioma de respuesta forzado.
- Largo máximo de mensaje y máximo de mensajes antes de handoff.
- Reglas claras de cuándo hacer handoff (no solo por keyword): después de N idas y vueltas, fuera de horario, intent específico (precio, escrituras, agendar visita).
- Horario de atención del equipo humano (para que la IA diga "te contestamos mañana 9am" en vez de prometer asesor inmediato).

---

## Plan

### Fase 1 — Auditoría y limpieza de la UI actual (sin romper nada)

**Objetivo:** que cada switch de `/settings/ai-config` tenga efecto real y verificable.

1. Reescribir cómo `ai-chat-response` aplica `tone`, `use_emojis` y `max_emojis_per_message`:
   - Inyectar reglas explícitas y con ejemplos en el system prompt en vez de una línea suelta.
   - Añadir validación post-respuesta: si `use_emojis = false`, hacer strip de emojis antes de enviar.
2. Marcar visualmente en la UI los campos que aplican "siempre" vs los que dependen de otros (ej. el slider de emojis solo si `use_emojis=true` ya está bien, replicar patrón).
3. Quitar de la UI el campo `escalate_on_frustration` o reemplazarlo por detección vía LLM (tool call con score 0–1) para que deje de ser regex falso-positivo.

### Fase 2 — Nuevo modelo: "Perfil regional + Reglas de conversación"

**Cambios en BD** (`tenant_ai_settings`): agregar columnas

- `region_code` text (`MX`, `CO`, `PE`, `AR`, `CL`, `ES`, `US-Hispanic`)
- `language` text (`es`, `en`, `pt`)
- `formality` text (`tu`, `usted`, `vos`)
- `max_message_length` int (default 320 caracteres WhatsApp)
- `max_ai_turns_before_handoff` int (default 8)
- `business_hours` jsonb (días + rango horario por tenant)
- `handoff_triggers` jsonb (`{ on_price_question: bool, on_legal_question: bool, on_schedule_visit: bool, on_after_hours: bool, on_n_turns: bool }`)
- `out_of_hours_message` text

**Edge function** `ai-chat-response`:
- Cargar el perfil regional y prepender un bloque "CONTEXTO REGIONAL" al system prompt con modismos, moneda, formato de teléfono y trato (tú/usted/vos).
- Contar turnos AI en la conversación; si `max_ai_turns_before_handoff` se supera y el lead no avanzó de etapa → handoff automático.
- Antes de responder, chequear `business_hours`; fuera de horario, responder con `out_of_hours_message` y marcar handoff diferido.
- Forzar `max_message_length` con instrucción + truncado defensivo.

### Fase 3 — Reorganizar la UI de `/settings/ai-config`

Pasar de 3 tabs ambiguas a 4 tabs con propósito claro:

1. **Identidad** — agente, empresa, nunca revelar IA, idioma, región, formalidad.
2. **Instrucciones** — `behavior_prompt` (núcleo) + plantillas pre-cargadas por vertical, mostrar contador de tokens estimados.
3. **Estilo** — tono, emojis (con ejemplo en vivo), `max_message_length`, delay de respuesta, usar nombre del cliente.
4. **Handoff y horarios** — horario de atención, mensaje fuera de horario, triggers de handoff (toggles), `max_ai_turns_before_handoff`, mensaje de escalamiento.

Agregar al final un botón **"Probar conversación"** que abra un chat sandbox (reusa `ai-chat-response` con un `conversation_id` ficticio) para que el admin valide en 30 segundos cómo quedó la configuración antes de exponerla a clientes reales.

### Fase 4 — Plantillas regionales pre-cargadas (acelera onboarding)

Crear 3 plantillas de `behavior_prompt` listas para aplicar con un click:
- México (ya existe `SUGGESTED_REAL_ESTATE_PROMPT`).
- Colombia (usted, "apartamento", COP).
- España (vosotros opcional, "piso", €, "hipoteca" en vez de "crédito hipotecario").

Guardadas en una tabla `ai_prompt_presets` (tenant_id NULL = global) para que cada partner pueda agregar las suyas.

---

## Detalle técnico

- Tablas tocadas: `tenant_ai_settings` (ALTER), nueva `ai_prompt_presets`.
- Edge function tocada: `ai-chat-response/index.ts` (system prompt + post-procesado).
- Frontend tocado: `src/pages/settings/SettingsAIConfig.tsx`, `src/hooks/useAISettings.ts` (extender tipos).
- Sin breaking changes: defaults en BD garantizan que tenants existentes siguen funcionando.

## Lo que **no** se toca

- Pipeline de 10 etapas, knowledge base, scoring, flujos de propiedades — fuera de alcance.
- Lógica de Twilio / envío — solo cambia el contenido del mensaje.

## Orden sugerido de ejecución

1. Migración de BD (Fase 2).
2. Edge function `ai-chat-response` (Fases 1 + 2).
3. UI `/settings/ai-config` reorganizada (Fase 3).
4. Plantillas regionales + sandbox de prueba (Fase 4).

Cada fase es desplegable de forma independiente; si paramos después de la Fase 1 ya queda más limpio.
