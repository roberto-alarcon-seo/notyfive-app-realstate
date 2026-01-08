import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, Eye, EyeOff, Check, X } from 'lucide-react';
import authLogo from '@/assets/auth-logo.png';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

interface PasswordRequirement {
  label: string;
  test: (password: string) => boolean;
}

const passwordRequirements: PasswordRequirement[] = [
  { label: 'Mínimo 8 caracteres', test: (p) => p.length >= 8 },
  { label: '1 mayúscula', test: (p) => /[A-Z]/.test(p) },
  { label: '1 número', test: (p) => /\d/.test(p) },
  { label: '1 símbolo (recomendado)', test: (p) => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
];

const CompleteSignup = () => {
  const navigate = useNavigate();
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [status, setStatus] = useState<'idle' | 'success' | 'error' | 'no-session'>('idle');
  const [error, setError] = useState('');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has a valid session from the recovery link
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Session error:', error);
          setStatus('no-session');
          return;
        }

        if (!session) {
          // Try to get session from URL hash (recovery flow)
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          const type = hashParams.get('type');

          if (accessToken && refreshToken && type === 'recovery') {
            const { data, error: setError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (setError || !data.session) {
              console.error('Set session error:', setError);
              setStatus('no-session');
              return;
            }

            setUserEmail(data.session.user.email || null);
          } else {
            setStatus('no-session');
            return;
          }
        } else {
          setUserEmail(session.user.email || null);
        }
      } catch (err) {
        console.error('Check session error:', err);
        setStatus('no-session');
      } finally {
        setIsCheckingSession(false);
      }
    };

    checkSession();
  }, []);

  const isPasswordValid = passwordRequirements.slice(0, 3).every(req => req.test(password));
  const doPasswordsMatch = password === confirmPassword && password.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!isPasswordValid) {
      setError('La contraseña no cumple con los requisitos mínimos');
      return;
    }

    if (!doPasswordsMatch) {
      setError('Las contraseñas no coinciden');
      return;
    }

    setIsLoading(true);

    try {
      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        console.error('Update password error:', updateError);
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Update profile to active
        await supabase
          .from('profiles')
          .update({
            status: 'active',
            first_login_required: false,
            password_set_at: new Date().toISOString(),
            last_login_at: new Date().toISOString(),
          })
          .eq('id', user.id);

        // Log security event
        const { data: profile } = await supabase
          .from('profiles')
          .select('tenant_id')
          .eq('id', user.id)
          .single();

        if (profile?.tenant_id) {
          await supabase.from('security_events').insert({
            event_type: 'tenant_owner_activated',
            user_id: user.id,
            tenant_id: profile.tenant_id,
            metadata: { activated_at: new Date().toISOString() },
          });
        }
      }

      setStatus('success');

      // Force a full reload into the app shell so AuthContext refetches profile/roles
      // and we don't get stuck needing a second password change.
      setTimeout(() => {
        try {
          window.location.replace('/');
        } catch {
          // no-op
        }
      }, 800);
    } catch (err: any) {
      console.error('Complete signup error:', err);
      setError(err.message || 'Error al activar la cuenta');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoToApp = () => {
    // Use hard navigation to ensure auth/profile state is fresh.
    window.location.replace('/');
  };

  const renderContent = () => {
    if (isCheckingSession) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Verificando sesión...</p>
        </div>
      );
    }

    if (status === 'no-session') {
      return (
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Enlace inválido o expirado
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            El enlace de activación que utilizaste no es válido, ha expirado o ya fue utilizado.
            Contacta a tu administrador para solicitar un nuevo enlace.
          </p>
          <Button variant="outline" onClick={() => navigate('/auth')}>
            Ir al login
          </Button>
        </div>
      );
    }

    if (status === 'success') {
      return (
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            ¡Cuenta activada!
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Tu cuenta ha sido activada correctamente. Ya puedes acceder a la plataforma.
          </p>
          <Button className="w-full gradient-primary" onClick={handleGoToApp}>
            Ir a la aplicación
          </Button>
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Error de activación
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {error || 'Ocurrió un error al activar tu cuenta. Por favor, intenta nuevamente.'}
          </p>
          <Button variant="outline" onClick={() => setStatus('idle')}>
            Intentar de nuevo
          </Button>
        </div>
      );
    }

    return (
      <>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Activa tu cuenta
          </h1>
          <p className="text-muted-foreground text-sm">
            Crea una contraseña para acceder a NotyFive.
          </p>
          {userEmail && (
            <p className="text-sm text-primary mt-2">{userEmail}</p>
          )}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
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
                className="h-11 bg-secondary border-border focus:border-primary focus:ring-primary pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Password requirements */}
          <div className="space-y-2">
            {passwordRequirements.map((req, index) => (
              <div 
                key={index}
                className={`flex items-center gap-2 text-xs ${
                  req.test(password) ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {req.test(password) ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <X className="h-3 w-3" />
                )}
                {req.label}
              </div>
            ))}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirmar contraseña
            </label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11 bg-secondary border-border focus:border-primary focus:ring-primary pr-10"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && !doPasswordsMatch && (
              <p className="text-xs text-destructive">Las contraseñas no coinciden</p>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          {/* Submit */}
          <Button
            type="submit"
            className="w-full h-11 gradient-primary hover:opacity-90 transition-opacity font-medium"
            disabled={isLoading || !isPasswordValid || !doPasswordsMatch}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Activando cuenta...
              </>
            ) : (
              'Activar cuenta'
            )}
          </Button>
        </form>
      </>
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative overflow-hidden">
      {/* Gradient background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-t from-primary/30 via-primary/10 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-gradient-to-tr from-violet-600/20 via-transparent to-transparent blur-2xl" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-gradient-to-tl from-indigo-600/20 via-transparent to-transparent blur-2xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-background via-transparent to-transparent" />
      </div>
      
      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <img 
            src={authLogo} 
            alt="NotyFive Logo" 
            className="h-24 w-24 object-contain" 
          />
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl p-8 border border-border shadow-xl">
          {renderContent()}
        </div>

        {/* Branding */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} NotyFive. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};

export default CompleteSignup;
