import { Link } from 'react-router-dom';
import { Menu, X, Sun, Moon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/context/AuthContext';
import { primaryName } from '@/lib/userDisplay';

const mainNavItems = [
  { to: '/standings', label: 'Standings' },
  { to: '/schedule', label: 'Schedule' },
  { to: '/pools', label: 'Card Pools' },
  { to: '/decks', label: 'Decklists' },
  { to: '/history', label: 'History' },
];

const adminNavItem = { to: '/admin', label: 'Admin' };

const navLinkClass =
  'text-muted-foreground transition-colors hover:text-foreground';

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { user, logout, isLoading } = useAuth();

  const navItems = useMemo(() => {
    if (!isLoading && user?.role === 'admin') {
      return [...mainNavItems, adminNavItem];
    }
    return mainNavItems;
  }, [isLoading, user?.role]);

  const mobileNavItems = useMemo(
    () => [{ to: '/', label: 'Dashboard' }, ...navItems],
    [navItems],
  );

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link to="/" className="mr-6 flex items-center space-x-2">
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            MTG Chaperone
          </span>
        </Link>

        <nav className="hidden md:flex items-center space-x-6 text-sm font-medium">
          {navItems.map((item) => (
            <Link key={item.to} to={item.to} className={navLinkClass}>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end space-x-2">
          <button
            onClick={toggleTheme}
            className="inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          {user ? (
            <div className="hidden md:flex items-center gap-2">
              <Link
                to={`/profile/${user.slug}`}
                className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-accent"
              >
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt={primaryName(user)} className="h-5 w-5 rounded-full" />
                ) : (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                    {primaryName(user).slice(0, 1).toUpperCase()}
                  </span>
                )}
                {primaryName(user)}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden md:inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          )}
          <button
            className="md:hidden inline-flex items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container mx-auto px-4 py-4 space-y-3">
            {mobileNavItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`block text-sm font-medium ${navLinkClass}`}
                onClick={closeMobileMenu}
              >
                {item.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  to={`/profile/${user.slug}`}
                  className="block text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                  onClick={closeMobileMenu}
                >
                  {primaryName(user)}
                </Link>
                <button
                  type="button"
                  className={`block text-sm font-medium ${navLinkClass}`}
                  onClick={() => {
                    logout();
                    closeMobileMenu();
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link
                to="/login"
                className="block text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                onClick={closeMobileMenu}
              >
                Sign In
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
