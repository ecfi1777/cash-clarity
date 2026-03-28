import { NavLink as RouterNavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/history', label: 'History' },
  { to: '/recurring', label: 'Recurring' },
];

export function AppNav() {
  return (
    <nav className="border-b">
      <div className="max-w-5xl mx-auto px-4 flex items-center h-12 gap-6">
        <span className="text-sm font-medium text-foreground mr-4">ECFI</span>
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
      </div>
    </nav>
  );
}
