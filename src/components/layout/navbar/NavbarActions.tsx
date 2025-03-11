
import { useState, useEffect } from "react";
import { Bell, Wallet, Home } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import UserMenuDropdown from "./UserMenuDropdown";
import DashboardMenuDropdown from "./DashboardMenuDropdown";
import NotificationDropdown from "./NotificationDropdown";
import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/services/NotificationService";

interface NavbarActionsProps {
  isActive: (path: string) => boolean;
}

export default function NavbarActions({
  isActive
}: NavbarActionsProps) {
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isDashboardMenuOpen, setIsDashboardMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      setIsLoading(true);
      const {
        data
      } = await supabase.auth.getSession();
      const hasSession = !!data.session;
      setIsAuthenticated(hasSession);
      
      // Get wallet balance if authenticated
      if (hasSession) {
        try {
          const { data: profileData, error } = await supabase
            .from('profiles')
            .select('wallet_balance')
            .eq('id', data.session.user.id)
            .maybeSingle();
            
          if (!error && profileData) {
            setWalletBalance(profileData.wallet_balance || 0);
          } else {
            console.error("Error fetching wallet balance:", error);
            setWalletBalance(0);
          }
        } catch (err) {
          console.error("Failed to fetch wallet balance:", err);
          setWalletBalance(0);
        }
      }
      
      setIsLoading(false);
    };
    
    checkAuth();

    // Replace real-time subscription with periodic check
    const authCheckInterval = setInterval(checkAuth, 60000); // Check every minute
    
    return () => {
      clearInterval(authCheckInterval);
    };
  }, [location.pathname]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchUnreadCount();
      
      // Replace real-time subscription with periodic check
      const notificationCheckInterval = setInterval(fetchUnreadCount, 30000); // Check every 30 seconds
      
      return () => {
        clearInterval(notificationCheckInterval);
      };
    }
  }, [isAuthenticated]);

  const fetchUnreadCount = async () => {
    const count = await notificationService.getUnreadCount();
    setUnreadNotificationCount(count);
  };

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (isNotificationOpen || isUserMenuOpen || isDashboardMenuOpen) {
        const target = event.target as HTMLElement;
        if (!target.closest('.notification-dropdown') && !target.closest('.user-dropdown') && !target.closest('.dashboard-menu-dropdown')) {
          setIsNotificationOpen(false);
          setIsUserMenuOpen(false);
          setIsDashboardMenuOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isNotificationOpen, isUserMenuOpen, isDashboardMenuOpen]);

  const isDashboardPage = location.pathname.includes('/dashboard');

  if (isLoading) {
    return null;
  }

  if (isDashboardPage) {
    return (
      <div className="flex items-center space-x-2">
        <Link to="/" className="p-2 rounded-full hover:bg-gray-100 transition-colors">
          <Home className="h-5 w-5 text-bgs-blue" />
        </Link>
        
        <Link 
          to="/dashboard?tab=wallet" 
          className="flex items-center p-2 rounded-full hover:bg-gray-100 transition-colors space-x-1"
        >
          <Wallet className="h-5 w-5 text-bgs-blue" />
          {walletBalance !== null && (
            <span className="text-xs font-medium text-bgs-blue">
              {walletBalance.toLocaleString('fr-FR')}€
            </span>
          )}
        </Link>

        <div className="relative notification-dropdown">
          <button onClick={() => {
            setIsNotificationOpen(!isNotificationOpen);
            if (isUserMenuOpen) setIsUserMenuOpen(false);
            if (isDashboardMenuOpen) setIsDashboardMenuOpen(false);
          }} className="p-2 rounded-full hover:bg-gray-100 transition-colors relative" aria-label="Notifications">
            <Bell className="h-5 w-5 text-bgs-blue" />
            {unreadNotificationCount > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 bg-bgs-orange rounded-full"></span>
            )}
          </button>
          
          <NotificationDropdown isOpen={isNotificationOpen} />
        </div>
      </div>
    );
  }

  return null;
}
