import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export type GlobalRole = 'super_admin' | 'user';
export type TenantRole = 'owner' | 'marketer' | 'readonly';

interface Profile {
  id: string;
  tenant_id: string | null;
  name: string;
  email: string;
  status: string;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
  first_login_required: boolean;
  password_set_at: string | null;
  invited_at: string | null;
  invited_by: string | null;
}

interface UserRole {
  id: string;
  user_id: string;
  global_role: GlobalRole;
  tenant_role: TenantRole | null;
  created_at: string;
  updated_at: string;
}

interface Tenant {
  id: string;
  name: string;
  plan: string;
  status: string;
  max_users: number;
  max_contacts: number;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  userRole: UserRole | null;
  tenant: Tenant | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  tenantRole: TenantRole | null;
}

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (roles: TenantRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    profile: null,
    userRole: null,
    tenant: null,
    isLoading: true,
    isSuperAdmin: false,
    tenantRole: null,
  });

  const fetchUserData = useCallback(async (userId: string) => {
    try {
      // Fetch profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        return;
      }

      // Fetch role
      const { data: userRole, error: roleError } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (roleError) {
        console.error('Error fetching role:', roleError);
        return;
      }

      // Fetch tenant if user has one
      let tenant: Tenant | null = null;
      if (profile?.tenant_id) {
        const { data: tenantData, error: tenantError } = await supabase
          .from('tenants')
          .select('*')
          .eq('id', profile.tenant_id)
          .single();

        if (!tenantError && tenantData) {
          tenant = tenantData as Tenant;
        }
      }

      setState(prev => ({
        ...prev,
        profile: profile as Profile,
        userRole: userRole as UserRole,
        tenant,
        isSuperAdmin: userRole?.global_role === 'super_admin',
        tenantRole: userRole?.tenant_role as TenantRole | null,
        isLoading: false,
      }));

      // Update last_login_at
      await supabase
        .from('profiles')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', userId);

    } catch (error) {
      console.error('Error in fetchUserData:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // IMPORTANT: clear derived user data immediately to avoid rendering with stale profile/roles
        // (e.g. when a recovery link logs in a different user)
        if (session?.user) {
          setState(prev => ({
            ...prev,
            session,
            user: session.user,
            profile: null,
            userRole: null,
            tenant: null,
            isSuperAdmin: false,
            tenantRole: null,
            isLoading: true,
          }));

          // Defer Supabase calls with setTimeout to prevent deadlock
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setState(prev => ({
            ...prev,
            session,
            user: null,
            profile: null,
            userRole: null,
            tenant: null,
            isSuperAdmin: false,
            tenantRole: null,
            isLoading: false,
          }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Same stale-state protection as above
        setState(prev => ({
          ...prev,
          session,
          user: session.user,
          profile: null,
          userRole: null,
          tenant: null,
          isSuperAdmin: false,
          tenantRole: null,
          isLoading: true,
        }));

        fetchUserData(session.user.id);
      } else {
        setState(prev => ({
          ...prev,
          session: null,
          user: null,
          isLoading: false,
        }));
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchUserData]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Handle case where session was already invalidated (e.g., after password reset)
      console.log('Sign out error (session may already be invalidated):', error);
    }
    // Always clear local state regardless of signOut result
    setState({
      user: null,
      session: null,
      profile: null,
      userRole: null,
      tenant: null,
      isLoading: false,
      isSuperAdmin: false,
      tenantRole: null,
    });
  };

  const hasRole = (roles: TenantRole[]): boolean => {
    if (state.isSuperAdmin) return true;
    if (!state.tenantRole) return false;
    return roles.includes(state.tenantRole);
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        signIn,
        signOut,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
