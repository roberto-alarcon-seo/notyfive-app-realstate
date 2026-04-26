import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { z } from 'zod';
import { usePartnerBranding } from '@/contexts/PartnerBrandingContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';

const emailSchema = z.object({
  email: z.string().trim().email({ message: "Email inválido" }),
});

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }

    setIsLoading(true);

    try {
      const { error: fnError } = await supabase.functions.invoke('auth-password-reset/request', {
        body: { 
          email: email.trim().toLowerCase(),
          origin: window.location.origin,
        },
      });

      if (fnError) {
        console.error('Reset request error:', fnError);
      }

      // Always show success to prevent enumeration
      setStatus('success');
    } catch (err) {
      console.error('Reset request failed:', err);
      setStatus('error');
    } finally {
      setIsLoading(false);
    }
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
          {status === 'success' ? (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <CheckCircle className="h-8 w-8 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Revisa tu correo
              </h1>
              <p className="text-muted-foreground text-sm mb-6">
                Si el correo está registrado, recibirás un enlace en unos minutos.
              </p>
              <Link to="/auth">
                <Button variant="outline" className="w-full">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Volver a iniciar sesión
                </Button>
              </Link>
            </div>
          ) : status === 'error' ? (
            <div className="text-center">
              <div className="mb-6 flex justify-center">
                <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-semibold text-foreground mb-2">
                Algo salió mal
              </h1>
              <p className="text-muted-foreground text-sm mb-6">
                No fue posible procesar tu solicitud. Intenta de nuevo.
              </p>
              <Button onClick={() => setStatus('idle')} className="w-full gradient-primary">
                Intentar de nuevo
              </Button>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="text-center mb-8">
                <h1 className="text-2xl font-semibold text-foreground mb-2">
                  Recupera tu contraseña
                </h1>
                <p className="text-muted-foreground text-sm">
                  Te enviaremos un enlace seguro para restablecer tu contraseña.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Email */}
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 bg-secondary border-border focus:border-primary focus:ring-primary"
                    disabled={isLoading}
                  />
                  {error && (
                    <p className="text-xs text-destructive">{error}</p>
                  )}
                </div>

                {/* Submit */}
                <Button
                  type="submit"
                  className="w-full h-11 gradient-primary hover:opacity-90 transition-opacity font-medium"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    'Enviar enlace'
                  )}
                </Button>

                {/* Back to login */}
                <Link 
                  to="/auth" 
                  className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Volver a iniciar sesión
                </Link>
              </form>
            </>
          )}
        </div>

        {/* Branding */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} NotyFive. Todos los derechos reservados.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
