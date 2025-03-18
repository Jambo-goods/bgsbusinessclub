
import React from "react";
import { 
  User, 
  Bell, 
  Home, 
  Settings, 
  LogOut, 
  ChevronRight,
  Wallet,
  LineChart,
  BarChart3,
  Briefcase,
  Users
} from "lucide-react";
import SidebarNavItem from "./SidebarNavItem";
import SidebarSection from "./SidebarSection";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  isSidebarOpen: boolean;
  handleLogout: () => void;
  toggleSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  isSidebarOpen, 
  handleLogout,
  toggleSidebar
}) => {
  return (
    <div className="h-full flex flex-col justify-between py-2 overflow-y-auto">
      {/* Main Navigation */}
      <div className="flex-1 px-2 py-1 space-y-3">
        <SidebarSection title="Tableau de bord">
          <SidebarNavItem 
            icon={<Home size={18} />}
            label="Vue d'ensemble"
            isActive={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            isOpen={isSidebarOpen}
          />
          
          <SidebarNavItem 
            icon={<Wallet size={18} />}
            label="Portefeuille"
            isActive={activeTab === "wallet"}
            onClick={() => setActiveTab("wallet")}
            isOpen={isSidebarOpen}
          />
          
          <SidebarNavItem 
            icon={<LineChart size={18} />}
            label="Rendements"
            isActive={activeTab === "yield"}
            onClick={() => setActiveTab("yield")}
            isOpen={isSidebarOpen}
          />
        
          {/* Investment items (without the section header) */}
          <SidebarNavItem 
            icon={<BarChart3 size={18} />}
            label="Mes investissements"
            isActive={activeTab === "investments"}
            onClick={() => setActiveTab("investments")}
            isOpen={isSidebarOpen}
          />
          
          <SidebarNavItem 
            icon={<Briefcase size={18} />}
            label="Projets"
            isActive={activeTab === "projects"}
            onClick={() => setActiveTab("projects")}
            isOpen={isSidebarOpen}
            badge="Nouveau"
            badgeColor="bg-green-500"
          />
          
          {/* Program items (without the section header) */}
          <SidebarNavItem 
            icon={<Users size={18} />}
            label="Parrainage"
            isActive={activeTab === "referral"}
            onClick={() => setActiveTab("referral")}
            isOpen={isSidebarOpen}
            badge="10%"
            badgeColor="bg-amber-500"
          />
          
          {/* Moved user navigation items here */}
          <SidebarNavItem 
            icon={<User size={18} />}
            label="Mon Profil"
            isActive={activeTab === "profile"}
            onClick={() => setActiveTab("profile")}
            isOpen={isSidebarOpen}
          />
          
          <SidebarNavItem 
            icon={<Bell size={18} />}
            label="Notifications"
            isActive={activeTab === "notifications"}
            onClick={() => setActiveTab("notifications")}
            isOpen={isSidebarOpen}
          />
          
          <SidebarNavItem 
            icon={<Settings size={18} />}
            label="Paramètres"
            isActive={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
            isOpen={isSidebarOpen}
          />
        </SidebarSection>
      </div>
      
      {/* User Navigation - now only contains logout */}
      <div className="px-2 py-1 border-t border-gray-100 space-y-1">
        <SidebarNavItem 
          icon={<LogOut size={18} />}
          label="Déconnexion"
          isActive={false}
          onClick={handleLogout}
          isOpen={isSidebarOpen}
        />
      </div>
      
      {/* Mobile Sidebar Toggle */}
      <div className="md:hidden px-2 pt-2 border-t border-gray-100">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-medium text-gray-600 hover:text-bgs-blue hover:bg-bgs-blue/5 rounded-md transition-colors"
        >
          <span>Fermer le menu</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
