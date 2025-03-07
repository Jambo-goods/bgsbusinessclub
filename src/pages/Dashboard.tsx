
import { useEffect, useState, useCallback } from "react";
import { Helmet } from "react-helmet-async";
import { toast } from "sonner";
import { useLocation } from "react-router-dom";
import DashboardLayout from "../layouts/DashboardLayout";
import DashboardMain from "../components/dashboard/DashboardMain";
import { useProfileData } from "@/hooks/dashboard/useProfileData";
import { useInvestmentsData } from "@/hooks/dashboard/useInvestmentsData";
import { supabase } from "@/integrations/supabase/client";
import { useRealTimeSubscriptions } from "@/hooks/dashboard/useRealTimeSubscriptions";
import { useSidebarState } from "@/hooks/useSidebarState";

export default function Dashboard() {
  const location = useLocation();
  const [userId, setUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(() => {
    // Check if we have a state with activeTab
    if (location.state && location.state.activeTab) {
      return location.state.activeTab;
    }
    return 'overview';
  });
  const { isSidebarOpen, setIsSidebarOpen, toggleSidebar } = useSidebarState();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Update activeTab when location state changes
  useEffect(() => {
    if (location.state && location.state.activeTab) {
      setActiveTab(location.state.activeTab);
    }
  }, [location.state]);
  
  // Fetch user ID from auth session - only once at component mount
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session?.user) {
          setUserId(sessionData.session.user.id);
        } else {
          console.log("No session or user ID found");
        }
      } catch (error) {
        console.error("Error fetching user session:", error);
        toast.error("Erreur de connexion", {
          description: "Impossible de récupérer vos informations utilisateur."
        });
      }
    };
    
    fetchUserId();
  }, []);
  
  // User profile data
  const { 
    userData, 
    isLoading: profileLoading, 
    refreshProfileData 
  } = useProfileData(userId);
  
  // User investments data
  const { 
    userInvestments, 
    isLoading: investmentsLoading, 
    refreshInvestmentsData 
  } = useInvestmentsData(userId);
  
  // Set up real-time subscriptions when user ID is available
  const { realTimeStatus } = useRealTimeSubscriptions({
    userId: userId || '',
    onProfileUpdate: refreshProfileData,
    onInvestmentUpdate: refreshInvestmentsData,
    onTransactionUpdate: refreshProfileData  // Wallet balance is part of profile
  });
  
  // Log real-time status changes
  useEffect(() => {
    console.log("Dashboard real-time status:", realTimeStatus);
    
    if (realTimeStatus === 'connected') {
      toast.success("Données en temps réel activées", {
        id: "realtime-connected",
        description: "Vos données sont maintenant synchronisées en temps réel."
      });
    } else if (realTimeStatus === 'error') {
      toast.error("Erreur de connexion", {
        id: "realtime-error",
        description: "Impossible de se connecter au temps réel. Vos données ne seront pas automatiquement mises à jour."
      });
    }
  }, [realTimeStatus]);
  
  // Handle manual data refresh with debounce protection
  const refreshAllData = useCallback(async () => {
    if (isRefreshing) return;
    
    setIsRefreshing(true);
    toast.info("Actualisation des données...");
    
    try {
      await Promise.all([
        refreshProfileData(),
        refreshInvestmentsData()
      ]);
      toast.success("Données actualisées avec succès");
    } catch (error) {
      console.error("Error refreshing data:", error);
      toast.error("Erreur lors de l'actualisation des données");
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshProfileData, refreshInvestmentsData, isRefreshing]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Déconnexion réussie");
      window.location.href = "/login";
    } catch (error) {
      console.error("Error signing out:", error);
      toast.error("Erreur lors de la déconnexion");
    }
  };

  return (
    <>
      <Helmet>
        <title>Tableau de bord | BGS Invest</title>
        <meta name="description" content="Gérez vos investissements et suivez vos rendements avec BGS Invest" />
      </Helmet>
      
      <DashboardLayout
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        toggleSidebar={toggleSidebar}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        realTimeStatus={realTimeStatus}
        handleLogout={handleLogout}
      >
        <DashboardMain 
          isSidebarOpen={isSidebarOpen} 
          userData={userData || {
            firstName: "",
            lastName: "",
            email: "",
            investmentTotal: 0,
            projectsCount: 0,
            walletBalance: 0
          }} 
          activeTab={activeTab} 
          userInvestments={userInvestments}
          setActiveTab={setActiveTab}
          refreshData={refreshAllData}
          realTimeStatus={realTimeStatus}
        />
      </DashboardLayout>
    </>
  );
}
