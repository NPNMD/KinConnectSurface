import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import {
  Heart,
  Pill,
  Calendar,
  User,
  Users
} from 'lucide-react';

interface MobileNavProps {
  onHomeClick?: () => void;
}

export default function MobileNav({ onHomeClick }: MobileNavProps) {
  const { userRole } = useFamily();
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path || (path !== '/dashboard' && location.pathname.startsWith(path));
  };

  const NavItem = ({ to, icon: Icon, label, onClick }: { to: string, icon: any, label: string, onClick?: () => void }) => {
    const active = isActive(to);
    
    // Determine color based on active state and type (simplified to brand colors)
    let colorClass = "text-gray-500 hover:text-gray-700";
    let bgClass = "bg-transparent";
    
    if (active) {
      if (label === 'Home') {
        colorClass = "text-rose-600";
        bgClass = "bg-rose-100";
      } else if (label === 'Medications') {
        colorClass = "text-blue-600";
        bgClass = "bg-blue-100";
      } else if (label === 'Calendar') {
        colorClass = "text-purple-600";
        bgClass = "bg-purple-100";
      } else if (label === 'Profile') {
        colorClass = "text-green-600";
        bgClass = "bg-green-100";
      } else if (label === 'Family') {
        colorClass = "text-amber-600";
        bgClass = "bg-amber-100";
      }
    } else {
      // Hover states
      if (label === 'Home') colorClass = "text-gray-500 hover:text-rose-600";
      else if (label === 'Medications') colorClass = "text-gray-500 hover:text-blue-600";
      else if (label === 'Calendar') colorClass = "text-gray-500 hover:text-purple-600";
      else if (label === 'Profile') colorClass = "text-gray-500 hover:text-green-600";
      else if (label === 'Family') colorClass = "text-gray-500 hover:text-amber-600";
    }

    const Component = onClick ? 'button' : Link;
    const props = onClick ? { onClick } : { to };

    return (
      <Component
        {...props}
        className={`flex-1 flex flex-col items-center space-y-0.5 py-1 px-1 transition-colors ${colorClass}`}
        aria-label={`Go to ${label} page`}
        aria-current={active ? 'page' : undefined}
      >
        <div className={`p-1.5 rounded-lg transition-colors ${bgClass}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className={`text-xs ${active ? 'font-medium' : ''}`}>{label}</span>
      </Component>
    );
  };

  return (
    <nav className="mobile-nav-container md:hidden" role="navigation" aria-label="Main navigation">
      <div className="flex items-center justify-between">
        <NavItem 
          to="/dashboard" 
          icon={Heart} 
          label="Home" 
          onClick={onHomeClick ? onHomeClick : undefined}
        />
        
        <NavItem 
          to="/medications" 
          icon={Pill} 
          label="Medications" 
        />
        
        <NavItem 
          to="/calendar" 
          icon={Calendar} 
          label="Calendar" 
        />
        
        <NavItem 
          to="/profile" 
          icon={User} 
          label="Profile" 
        />
        
        <NavItem 
          to={userRole === 'patient' ? "/family-management" : "/family/invite"} 
          icon={Users} 
          label="Family" 
        />
      </div>
    </nav>
  );
}





