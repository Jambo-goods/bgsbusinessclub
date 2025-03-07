
import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { toast } from "sonner";
import NavbarHeader from "./NavbarHeader";
import NavLogo from "./NavLogo";
import DesktopNav from "./DesktopNav";
import MobileMenuToggle from "./MobileMenuToggle";
import MobileMenu from "./MobileMenu";
import { logoutUser, getCurrentUser } from "@/services/authService";

interface NavbarProps {
  isScrolled?: boolean;
}

export default function Navbar({ isScrolled }: NavbarProps) {
  const [internalIsScrolled, setInternalIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { toast: uiToast } = useToast();
  
  const logoPath = "lovable-uploads/d9a3204a-06aa-470d-8255-7f3bd0852557.png";

  // Use passed isScrolled prop or internal state
  const effectiveIsScrolled = isScrolled !== undefined ? isScrolled : internalIsScrolled;

  useEffect(() => {
    // Only track scrolling internally if no isScrolled prop is provided
    if (isScrolled === undefined) {
      const handleScroll = () => {
        setInternalIsScrolled(window.scrollY > 10);
      };
      
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }
  }, [isScrolled]);

  useEffect(() => {
    // Check if user is logged in
    const checkAuth = async () => {
      const { user } = await getCurrentUser();
      setIsLoggedIn(!!user);
    };
    
    checkAuth();
  }, [location.pathname]);

  useEffect(() => {
    setIsMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = async () => {
    const { success, error } = await logoutUser();
    
    if (success) {
      setIsLoggedIn(false);
      toast.success("Déconnexion réussie");
      
      uiToast({
        title: "Déconnexion réussie",
        description: "Vous avez été déconnecté avec succès",
      });
      
      navigate("/");
    } else {
      toast.error("Erreur lors de la déconnexion: " + error);
    }
  };

  const isActive = (path: string) => location.pathname === path;
  
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  return (
    <NavbarHeader isScrolled={effectiveIsScrolled}>
      <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
        <NavLogo logoPath={logoPath} />

        {/* Desktop Navigation */}
        <DesktopNav 
          isLoggedIn={isLoggedIn}
          isActive={isActive}
          handleLogout={handleLogout}
        />

        {/* Mobile Menu Button */}
        <MobileMenuToggle 
          isMenuOpen={isMenuOpen} 
          toggleMenu={toggleMenu} 
        />
      </div>

      {/* Mobile Navigation */}
      <MobileMenu 
        isMenuOpen={isMenuOpen}
        isLoggedIn={isLoggedIn}
        isActive={isActive}
        handleLogout={handleLogout}
      />
    </NavbarHeader>
  );
}
