import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface SupportModeState {
  isSupportMode: boolean;
  supportTenantId: string | null;
  supportTenantName: string | null;
  isLoading: boolean;
}

interface SupportModeContextType extends SupportModeState {
  startSupportMode: (tenantId: string, tenantName: string) => Promise<boolean>;
  endSupportMode: () => Promise<void>;
  /**
   * Returns the tenant ID to use for queries.
   * In support mode, this returns the impersonated tenant's ID.
   * Otherwise, returns the user's actual tenant ID.
   */
  getEffectiveTenantId: () => string | null;
}

const SUPPORT_MODE_KEY = 'noty5_support_mode';

const SupportModeContext = createContext<SupportModeContextType | undefined>(undefined);

export const useSupportMode = () => {
  const context = useContext(SupportModeContext);
  if (!context) {
    throw new Error('useSupportMode must be used within a SupportModeProvider');
  }
  return context;
};

export const SupportModeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isSuperAdmin, profile, user } = useAuth();
  const [state, setState] = useState<SupportModeState>({
    isSupportMode: false,
    supportTenantId: null,
    supportTenantName: null,
    isLoading: false,
  });

  // Restore support mode from sessionStorage on mount
  useEffect(() => {
    if (isSuperAdmin) {
      const stored = sessionStorage.getItem(SUPPORT_MODE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          setState({
            isSupportMode: true,
            supportTenantId: parsed.tenantId,
            supportTenantName: parsed.tenantName,
            isLoading: false,
          });
        } catch {
          sessionStorage.removeItem(SUPPORT_MODE_KEY);
        }
      }
    } else {
      // If not super admin, clear any stored support mode
      sessionStorage.removeItem(SUPPORT_MODE_KEY);
      setState({
        isSupportMode: false,
        supportTenantId: null,
        supportTenantName: null,
        isLoading: false,
      });
    }
  }, [isSuperAdmin]);

  const startSupportMode = useCallback(async (tenantId: string, tenantName: string): Promise<boolean> => {
    if (!isSuperAdmin || !user) {
      toast.error('Acceso denegado');
      return false;
    }

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase.functions.invoke('admin-impersonate', {
        body: { 
          action: 'start',
          tenant_id: tenantId 
        }
      });

      if (error) {
        console.error('Error starting support mode:', error);
        toast.error('Error al iniciar modo soporte');
        setState(prev => ({ ...prev, isLoading: false }));
        return false;
      }

      // Store in sessionStorage (not localStorage for security)
      sessionStorage.setItem(SUPPORT_MODE_KEY, JSON.stringify({
        tenantId,
        tenantName,
        startedAt: new Date().toISOString(),
      }));

      setState({
        isSupportMode: true,
        supportTenantId: tenantId,
        supportTenantName: tenantName,
        isLoading: false,
      });

      toast.success(`Modo soporte activado para ${tenantName}`);
      return true;
    } catch (err) {
      console.error('Error in startSupportMode:', err);
      toast.error('Error al iniciar modo soporte');
      setState(prev => ({ ...prev, isLoading: false }));
      return false;
    }
  }, [isSuperAdmin, user]);

  const endSupportMode = useCallback(async () => {
    if (!state.isSupportMode) return;

    setState(prev => ({ ...prev, isLoading: true }));

    try {
      const { error } = await supabase.functions.invoke('admin-impersonate', {
        body: { 
          action: 'stop',
          tenant_id: state.supportTenantId 
        }
      });

      if (error) {
        console.error('Error ending support mode:', error);
        // Still clear local state even if server call fails
      }

      sessionStorage.removeItem(SUPPORT_MODE_KEY);

      setState({
        isSupportMode: false,
        supportTenantId: null,
        supportTenantName: null,
        isLoading: false,
      });

      toast.success('Modo soporte finalizado');
    } catch (err) {
      console.error('Error in endSupportMode:', err);
      sessionStorage.removeItem(SUPPORT_MODE_KEY);
      setState({
        isSupportMode: false,
        supportTenantId: null,
        supportTenantName: null,
        isLoading: false,
      });
    }
  }, [state.isSupportMode, state.supportTenantId]);

  const getEffectiveTenantId = useCallback((): string | null => {
    if (state.isSupportMode && state.supportTenantId) {
      return state.supportTenantId;
    }
    return profile?.tenant_id ?? null;
  }, [state.isSupportMode, state.supportTenantId, profile?.tenant_id]);

  return (
    <SupportModeContext.Provider
      value={{
        ...state,
        startSupportMode,
        endSupportMode,
        getEffectiveTenantId,
      }}
    >
      {children}
    </SupportModeContext.Provider>
  );
};
