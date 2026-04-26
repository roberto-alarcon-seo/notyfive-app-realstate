import { useTenantCredits, getTotalCredits } from './useTenantCredits';

export type OperationStatus = 'ACTIVE' | 'READY_TO_CONFIGURE' | 'SUSPENDED';

export interface OperationStatusResult {
  /** Whether the tenant can send messages (has credits or subscription) */
  canOperate: boolean;
  /** Overall operation status */
  status: OperationStatus;
  /** Current total credits */
  totalCredits: number;
  /** Whether data is still loading */
  isLoading: boolean;
  /** Billing state string */
  billingState: string | null;
}

/**
 * Hook to determine if the current tenant can perform credit-consuming operations.
 * 
 * Operations are allowed if:
 * - tenants.message_credits > 0 OR
 * - tenants.billing_state == 'SUBSCRIBED_ACTIVE'
 */
export function useOperationStatus(): OperationStatusResult {
  const { data: credits, isLoading } = useTenantCredits();

  if (isLoading || !credits) {
    return {
      canOperate: false,
      status: 'READY_TO_CONFIGURE',
      totalCredits: 0,
      isLoading,
      billingState: null,
    };
  }

  const totalCredits = getTotalCredits(credits);
  const billingState = credits.billing_state;

  // SUSPENDED (typically dictated by the external Core) hard-blocks all
  // credit-consuming operations regardless of remaining balance.
  const isSuspended = billingState === 'SUSPENDED';

  const canOperate =
    !isSuspended && (totalCredits > 0 || billingState === 'SUBSCRIBED_ACTIVE');

  let status: OperationStatus = 'ACTIVE';
  if (isSuspended) {
    status = 'SUSPENDED';
  } else if (!canOperate) {
    status = 'READY_TO_CONFIGURE';
  }

  return {
    canOperate,
    status,
    totalCredits,
    isLoading,
    billingState,
  };
}

/**
 * Helper to check if an automation has message-sending actions
 */
export function automationHasSendActions(actions: { type: string }[]): boolean {
  const sendActionTypes = ['send_message', 'send_template'];
  return actions?.some(action => sendActionTypes.includes(action.type)) ?? false;
}
