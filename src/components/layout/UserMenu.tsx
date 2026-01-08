import { LogOut, User, Shield, Building2, LifeBuoy } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

export const UserMenu = () => {
  const navigate = useNavigate();
  const { profile, tenant, isSuperAdmin, tenantRole, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRoleLabel = () => {
    if (isSuperAdmin) return 'Super Admin';
    switch (tenantRole) {
      case 'owner': return 'Owner';
      case 'marketer': return 'Marketer';
      case 'readonly': return 'Solo lectura';
      default: return 'Usuario';
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary transition-colors">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {profile?.name ? getInitials(profile.name) : 'U'}
            </AvatarFallback>
          </Avatar>
          <div className="text-left hidden sm:block">
            <p className="text-sm font-medium text-foreground">{profile?.name || 'Usuario'}</p>
            <p className="text-xs text-muted-foreground">{getRoleLabel()}</p>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p className="font-medium">{profile?.name}</p>
            <p className="text-xs text-muted-foreground font-normal">{profile?.email}</p>
            {tenant && (
              <div className="flex items-center gap-1.5 mt-1">
                <Building2 className="h-3 w-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">{tenant.name}</span>
              </div>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <div className="px-2 py-1.5">
          <Badge variant={isSuperAdmin ? 'default' : 'secondary'} className="text-xs">
            {isSuperAdmin && <Shield className="h-3 w-3 mr-1" />}
            {getRoleLabel()}
          </Badge>
        </div>
        
        <DropdownMenuSeparator />
        
        {isSuperAdmin && (
          <>
            <DropdownMenuItem onClick={() => navigate('/admin')}>
              <Shield className="h-4 w-4 mr-2" />
              Panel de Admin
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
        
        <DropdownMenuItem onClick={() => navigate('/settings')}>
          <User className="h-4 w-4 mr-2" />
          Configuración
        </DropdownMenuItem>

        {tenantRole === 'owner' && (
          <DropdownMenuItem onClick={() => navigate('/support')}>
            <LifeBuoy className="h-4 w-4 mr-2" />
            Soporte técnico
          </DropdownMenuItem>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
