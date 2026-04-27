import { FunctionsHttpError } from '@supabase/supabase-js';

/**
 * Extracts the most descriptive error message possible from a
 * supabase.functions.invoke() failure. Edge Functions returning a
 * non-2xx status surface as `FunctionsHttpError`, whose body must be
 * read explicitly to get the JSON `{ error: "..." }` payload.
 */
export async function extractEdgeFunctionError(
  error: unknown,
  fallback = 'Ocurrió un error inesperado.',
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      if (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string') {
        return body.error;
      }
    } catch {
      try {
        const text = await error.context.text();
        if (text) return text;
      } catch {
        /* ignore */
      }
    }
    return error.message || fallback;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return fallback;
}