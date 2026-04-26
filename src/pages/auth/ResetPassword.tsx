import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, ArrowLeft, CheckCircle, AlertCircle, Eye, EyeOff, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { usePartnerBranding } from '@/contexts/PartnerBrandingContext';

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

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'expired' | 'invalid'>('idle');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !email) {
      setStatus('invalid');
    }
  }, [token, email]);

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
      const { data, error: fnError } = await supabase.functions.invoke('auth-password-reset/verify', {
        body: { 
          email: email,
          token: token,
          newPassword: password,
        },
      });

      if (fnError) {
        console.error('Reset verify error:', fnError);
        setStatus('expired');
        return;
      }

      if (!data?.success) {
        setStatus('expired');
        return;
      }

      setStatus('success');
    } catch (err) {
      console.error('Reset verify failed:', err);
      setStatus('expired');
    } finally {
      setIsLoading(false);
    }
  };

  const renderContent = () => {
    if (status === 'invalid') {
      return (
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Enlace inválido
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            El enlace que utilizaste no es válido o está incompleto.
          </p>
          <Link to="/auth">
            <Button variant="outline" className="w-full">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al login
            </Button>
          </Link>
        </div>
      );
    }

    if (status === 'expired') {
      return (
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Enlace expirado
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Este enlace expiró o ya fue utilizado.
          </p>
          <Link to="/auth/forgot-password">
            <Button className="w-full gradient-primary">
              Solicitar nuevo enlace
            </Button>
          </Link>
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
            ¡Contraseña actualizada!
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            Tu contraseña fue actualizada correctamente.
          </p>
          <Link to="/auth">
            <Button className="w-full gradient-primary">
              Iniciar sesión
            </Button>
          </Link>
        </div>
      );
    }

    return (
      <>
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            Crea una nueva contraseña
          </h1>
          <p className="text-muted-foreground text-sm">
            Este enlace es temporal y expirará pronto.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* New Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Nueva contraseña
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
                Actualizando...
              </>
            ) : (
              'Actualizar contraseña'
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

export default ResetPassword;
