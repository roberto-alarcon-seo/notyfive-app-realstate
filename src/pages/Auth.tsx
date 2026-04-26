import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2, Mail, Lock, Sparkles } from 'lucide-react';
import authLogo from '@/assets/responde-logo.png';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

const loginSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }),
  password: z.string().min(1, { message: "La contraseña es requerida" }),
});

const REMEMBERED_EMAIL_KEY = 'notyfive_remembered_email';

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { signIn, signOut, user, isSuperAdmin, isLoading: authLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Load remembered email on mount (still supported silently)
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Show SSO error from query params (set by /auth/sso flow)
  useEffect(() => {
    const err = searchParams.get('error');
    if (err === 'sso_denied') {
      const reason = searchParams.get('reason') || '';
      const reasonMap: Record<string, string> = {
        invalid_token: 'El enlace de acceso es inválido.',
        missing_token: 'Falta el token de acceso.',
        invalid_claims: 'El token no contiene la información necesaria.',
        tenant_not_found: 'La cuenta no existe en este sistema.',
        user_not_found: 'No se encontró tu usuario en este tenant.',
        user_inactive: 'Tu usuario está inactivo. Contacta al administrador.',
        link_generation_failed: 'No se pudo generar la sesión. Intenta de nuevo.',
        server_misconfigured: 'El servidor SSO no está configurado correctamente.',
      };
      const detail = reasonMap[reason] ?? 'Acceso denegado o sesión expirada.';
      toast.error('Acceso denegado o sesión expirada', { description: detail });
      // Clean the URL so the toast doesn't repeat on re-renders
      const next = new URLSearchParams(searchParams);
      next.delete('error');
      next.delete('reason');
      setSearchParams(next, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Redirect authenticated users based on role
  useEffect(() => {
    if (!authLoading && user) {
      if (isSuperAdmin) {
        navigate('/admin', { replace: true });
      }
      // Non-super-admin users are not allowed to log in here.
      // They must enter via SSO. We sign them out and show a clear error.
    }
  }, [user, isSuperAdmin, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate inputs
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach(err => {
        if (err.path[0] === 'email') fieldErrors.email = err.message;
        if (err.path[0] === 'password') fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      
      if (error) {
        toast.error('Credenciales inválidas. Verifica tu email y contraseña.');
        return;
      }

      // Verify global role: only super_admin may log in here.
      const { data: { user: signedUser } } = await supabase.auth.getUser();
      if (signedUser) {
        const { data: roleRow } = await supabase
          .from('user_roles')
          .select('global_role')
          .eq('user_id', signedUser.id)
          .maybeSingle();

        if (roleRow?.global_role !== 'super_admin') {
          // Not allowed: kick them out immediately.
          await signOut();
          toast.error('Acceso restringido a administradores globales', {
            description: 'Inicia sesión desde tu panel principal vía SSO.',
          });
          return;
        }
      }

      // Always remember the admin email for convenience
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);

      toast.success('Inicio de sesión exitoso');
      navigate('/admin/tenants');
    } catch (error) {
      toast.error('Error al iniciar sesión. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#07060d] relative overflow-hidden px-4">
      {/* Ambient purple glow */}
      <div className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full bg-[#942CCC]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-[#4F2BCC]/20 blur-[120px]" />

      {/* Card with gradient border */}
      <div className="relative w-full max-w-md animate-fade-in">
        <div className="rounded-2xl p-[1px] bg-gradient-to-b from-[#3b6fff] via-[#942CCC]/40 to-[#3b6fff]/30">
          <div className="rounded-2xl bg-[#0c0a16] px-8 py-10 sm:px-10 sm:py-12">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img
                src={authLogo}
                alt="Responde Logo"
                className="h-12 w-auto object-contain"
              />
            </div>

            {/* Title */}
            <h1 className="text-center text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Bienvenido de vuelta
            </h1>
            <p className="text-center text-sm text-white/60 mt-2 mb-8">
              Accede a tu consola y a la academia
            </p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-white/80">
                  Email
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="correo@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 pl-10 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 hover:border-white/20 focus-visible:border-[#942CCC] focus-visible:ring-0 rounded-lg transition-colors"
                    disabled={isLoading}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-400">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-white/80">
                  Contraseña
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pl-10 pr-11 bg-white/[0.06] border-white/10 text-white placeholder:text-white/30 hover:border-white/20 focus-visible:border-[#942CCC] focus-visible:ring-0 rounded-lg transition-colors"
                    disabled={isLoading}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-red-400">{errors.password}</p>
                )}
              </div>

              {/* Forgot password */}
              <div className="flex justify-end">
                <Link
                  to="/auth/forgot-password"
                  className="text-xs text-white/50 hover:text-white/80 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 rounded-lg bg-gradient-to-r from-[#b266ff] to-[#5b3bff] hover:opacity-95 transition-all font-semibold text-white text-base shadow-[0_8px_24px_-8px_rgba(148,44,204,0.6)] border-0"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Iniciar sesión
                  </>
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
