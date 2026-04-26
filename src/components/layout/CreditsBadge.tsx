import { MessageSquare } from 'lucide-react';
import { useTenantCredits, getTotalCredits } from '@/hooks/useTenantCredits';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/**
 * Header badge that shows the tenant's available message credits.
 * Source of truth: tenants.message_credits + billing_state (no Stripe dependency).
 * Live-updates via the realtime subscription inside useTenantCredits.
 */
export const CreditsBadge = () => {
  const { data: credits, isLoading } = useTenantCredits();

  if (isLoading || !credits) return null;

  const total = getTotalCredits(credits);
  const billingState = credits.billing_state;

  // Hide badge entirely if tenant is suspended and has no credits
  if (total <= 0 && billingState === 'SUSPENDED') return null;

  const formatted = new Intl.NumberFormat('es-MX').format(total);

  // Tone: low (<=100) → muted warning style, otherwise primary partner color
  const isLow = total > 0 && total <= 100;
  const isEmpty = total <= 0;

  return (
    <Badge
      variant="default"
      className={cn(
        'gap-1.5 px-2.5 py-1 text-xs font-medium border-transparent',
        isEmpty && 'bg-muted text-muted-foreground',
        isLow && 'bg-primary/15 text-primary',
        !isEmpty && !isLow && 'bg-primary text-primary-foreground hover:bg-primary/90'
      )}
      title={`Créditos disponibles: ${formatted}`}
    >
      <MessageSquare className="h-3.5 w-3.5" />
      <span>{formatted}</span>
    </Badge>
  );
};