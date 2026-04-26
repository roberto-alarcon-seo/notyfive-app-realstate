import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import authHero from '@/assets/auth-hero-realestate.jpg';
import authLogo from '@/assets/brokia-logo.png';
import { z } from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';

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
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  // Load remembered email on mount
  useEffect(() => {
    const savedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
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

      // Handle remember me - save or remove email from localStorage
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      toast.success('Inicio de sesión exitoso');
      navigate('/admin/tenants');
    } catch (error) {
      toast.error('Error al iniciar sesión. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Left Panel - Hero Image */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-[55%] relative overflow-hidden">
        {/* Background Image */}
        <img 
          src={authHero} 
          alt="Propiedad de lujo" 
          className="absolute inset-0 w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />
        
        {/* Content Overlay */}
        <div className="relative z-10 flex flex-col justify-between p-8 xl:p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img 
              src={authLogo} 
              alt="Brokia24 Logo" 
              className="h-12 w-12 object-contain"
            />
            <span className="text-2xl font-semibold text-white tracking-tight">Brokia24</span>
          </div>
          
          {/* Bottom Content */}
          <div className="space-y-6">
            {/* Tagline */}
            <div className="space-y-3">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Impulsa Tus
                <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-orange-400 to-rose-400">
                  Ventas
                </span>
              </h1>
              <p className="text-lg text-white/80 max-w-md">
                Gestiona campañas de WhatsApp, automatiza seguimientos y conecta con tus clientes de forma inteligente.
              </p>
            </div>
            
            {/* Stats */}
            <div className="flex gap-8 pt-4">
              <div className="space-y-1">
                <div className="text-3xl font-bold text-white">10x</div>
                <div className="text-sm text-white/60">Más Respuestas</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-white">85%</div>
                <div className="text-sm text-white/60">Tasa Apertura</div>
              </div>
              <div className="space-y-1">
                <div className="text-3xl font-bold text-white">24/7</div>
                <div className="text-sm text-white/60">Automatización</div>
              </div>
            </div>

            {/* Carousel Dots */}
            <div className="flex gap-2 pt-2">
              <div className="w-8 h-2 rounded-full bg-white" />
              <div className="w-2 h-2 rounded-full bg-white/40" />
              <div className="w-2 h-2 rounded-full bg-white/40" />
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-1/2 xl:w-[45%] flex flex-col bg-background overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <img 
              src={authLogo} 
              alt="Brokia24 Logo" 
              className="h-10 w-10 object-contain"
            />
            <span className="text-xl font-semibold">Brokia24</span>
          </div>
        </div>

        {/* Desktop Sign In Button */}
        <div className="hidden lg:flex justify-end p-6 shrink-0">
          <Button variant="outline" className="rounded-full px-6" disabled>
            Iniciar Sesión
          </Button>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12 min-h-0">
          <div className="w-full max-w-md animate-fade-in">
            {/* Logo & Header */}
            <div className="text-center mb-8 lg:mb-10">
              <img 
                src={authLogo} 
                alt="Brokia24 Logo" 
                className="h-16 w-16 object-contain mx-auto mb-4"
              />
              <h1 className="text-3xl lg:text-4xl font-bold text-foreground mb-3">
                Acceso Administradores
              </h1>
              <p className="text-muted-foreground">
                Solo administradores globales del sistema
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email */}
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Tu Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-secondary/50 border-border hover:border-primary/50 focus:border-primary transition-colors rounded-xl"
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Password */}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-foreground">
                  Contraseña
                </label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 bg-secondary/50 border-border hover:border-primary/50 focus:border-primary transition-colors rounded-xl pr-12"
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Remember me & Forgot password */}
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember"
                    checked={rememberMe}
                    onCheckedChange={(checked) => setRememberMe(checked === true)}
                    disabled={isLoading}
                    className="rounded"
                  />
                  <label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">
                    Recordarme
                  </label>
                </div>
                <Link
                  to="/auth/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                className="w-full h-12 rounded-xl gradient-primary hover:opacity-90 transition-all font-semibold text-base shadow-lg hover:shadow-xl"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Iniciando sesión...
                  </>
                ) : (
                  'Iniciar Sesión'
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer Branding */}
        <div className="p-6 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Brokia24. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Auth;
