import { NavLink as RouterNavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/history', label: 'History' },
  { to: '/recurring', label: 'Recurring' },
  { to: '/imports', label: 'Imports' },
];

export function AppNav() {
  const { signOut } = useAuth();

  return (
    <nav className="border-b">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-12 gap-6">
        <span className="text-sm font-medium text-foreground mr-4">Cash Clarity</span>
        {navItems.map(item => (
          <RouterNavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `text-sm ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground hover:text-foreground'} transition-colors`
            }
          >
            {item.label}
          </RouterNavLink>
        ))}
        <div className="ml-auto">
          <Button variant="ghost" size="sm" onClick={signOut} className="text-sm text-muted-foreground">
            Sign out
          </Button>
        </div>
      </div>
    </nav>
  );
}
