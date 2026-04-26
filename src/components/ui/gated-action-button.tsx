import { forwardRef } from 'react';
import { Button, ButtonProps } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useOperationStatus } from '@/hooks/useOperationStatus';
import { Lock } from 'lucide-react';

interface GatedActionButtonProps extends ButtonProps {
  /** If true, gating is applied (button disabled when no credits) */
  gated?: boolean;
  /** Custom tooltip when gated */
  gatedTooltip?: string;
}

/**
 * Button that is automatically disabled when the tenant cannot operate (no credits).
 * Shows a tooltip explaining why the action is blocked.
 */
export const GatedActionButton = forwardRef<HTMLButtonElement, GatedActionButtonProps>(
  ({ gated = true, gatedTooltip, children, disabled, onClick, ...props }, ref) => {
    const { canOperate } = useOperationStatus();

    const isGated = gated && !canOperate;
    const isDisabled = disabled || isGated;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (isGated) {
        e.preventDefault();
        return;
      }
      onClick?.(e);
    };

    if (isGated) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                ref={ref}
                {...props}
                disabled={isDisabled}
                onClick={handleClick}
                className={props.className}
              >
                <Lock className="h-4 w-4 mr-2" />
                {children}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{gatedTooltip || 'Acción bloqueada: sin saldo disponible. Gestionado desde Brokia24 Core.'}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <Button
        ref={ref}
        {...props}
        disabled={isDisabled}
        onClick={onClick}
      >
        {children}
      </Button>
    );
  }
);

GatedActionButton.displayName = 'GatedActionButton';
