import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface StripeInvoice {
  id: string;
  created: number;
  status: string;
  status_label: string;
  total: string;
  description: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  period_start: number | null;
  period_end: number | null;
}

interface InvoicesResponse {
  invoices: StripeInvoice[];
}

async function fetchInvoices(): Promise<StripeInvoice[]> {
  const { data, error } = await supabase.functions.invoke<InvoicesResponse>(
    "stripe-list-invoices"
  );

  if (error) {
    console.error("Error fetching invoices:", error);
    throw new Error(error.message || "Error al cargar facturas");
  }

  return data?.invoices || [];
}

export function useStripeInvoices(limit = 20) {
  const query = useQuery({
    queryKey: ["stripe-invoices", limit],
    queryFn: fetchInvoices,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    invoices: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
