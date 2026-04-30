import { Link, useLocation } from 'react-router-dom';
import { Trophy, Calendar, Layers, BookOpen, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/standings', icon: Trophy, label: 'Standings' },
  { to: '/schedule', icon: Calendar, label: 'Schedule' },
  { to: '/pools', icon: Layers, label: 'Pools' },
  { to: '/decks', icon: BookOpen, label: 'Decks' },
];

export function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center justify-around h-16">
        {tabs.map((tab) => {
          const isActive = location.pathname === tab.to;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full text-xs transition-colors',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <tab.icon className="h-5 w-5 mb-1" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
