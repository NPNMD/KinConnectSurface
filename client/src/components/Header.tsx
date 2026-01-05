import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { signOutUser } from '@/lib/firebase';
import {
  Heart,
  LayoutDashboard,
  Pill,
  Calendar,
  Users,
  Bell,
  LogOut,
  User,
  Settings
} from 'lucide-react';
import PatientSwitcher from '@/components/PatientSwitcher';

export default function Header() {
  const { user, firebaseUser } = useAuth();
  const { userRole, activePatientAccess } = useFamily();
  const location = useLocation();

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40" role="banner">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/dashboard" className="flex items-center">
                <Heart className="w-8 h-8 text-primary-600" />
                <span className="ml-2 text-xl font-bold text-gray-900 hidden md:block">FamMedicalCare</span>
                <span className="ml-2 text-xl font-bold text-gray-900 md:hidden">FMC</span>
              </Link>
            </div>
            
            {/* Desktop Navigation */}
            <nav className="hidden md:ml-8 md:flex md:space-x-8">
              <Link 
                to="/dashboard" 
                className={`${isActive('/dashboard') 
                  ? 'border-primary-500 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} 
                  inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Dashboard
              </Link>
              <Link 
                to="/medications" 
                className={`${isActive('/medications') 
                  ? 'border-primary-500 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} 
                  inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                <Pill className="w-4 h-4 mr-2" />
                Medications
              </Link>
              <Link 
                to="/calendar" 
                className={`${isActive('/calendar') 
                  ? 'border-primary-500 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} 
                  inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Calendar
              </Link>
              <Link 
                to={userRole === 'patient' ? "/family-management" : "/family/invite"} 
                className={`${isActive('/family') || isActive('/family-management')
                  ? 'border-primary-500 text-gray-900' 
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'} 
                  inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
              >
                <Users className="w-4 h-4 mr-2" />
                Family
              </Link>
            </nav>
          </div>

          <div className="flex items-center">
            {/* Patient Switcher for Family Members */}
            <div className="mr-2 md:mr-4">
              <PatientSwitcher />
            </div>

            <div className="flex items-center space-x-2 md:space-x-4">
              <button
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors relative"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
              </button>
              
              <Link to="/profile" className="flex items-center space-x-2 group">
                {firebaseUser?.photoURL ? (
                  <img
                    src={firebaseUser.photoURL}
                    alt="Profile"
                    className="w-8 h-8 rounded-full border-2 border-transparent group-hover:border-primary-200 transition-colors"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 border-2 border-transparent group-hover:border-primary-200 transition-colors">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <span className="hidden md:inline-block text-sm font-medium text-gray-700 group-hover:text-gray-900">
                  {user?.name?.split(' ')[0] || 'Profile'}
                </span>
              </Link>
              
              <div className="h-6 w-px bg-gray-200 hidden md:block" />

              <button
                onClick={handleSignOut}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}





