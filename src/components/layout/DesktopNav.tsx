
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DesktopNavProps {
  isLoggedIn: boolean;
  isActive: (path: string) => boolean;
  handleLogout: () => void;
  isOnDashboard?: boolean;
}

export default function DesktopNav({ 
  isLoggedIn, 
  isActive, 
  handleLogout,
  isOnDashboard = false
}: DesktopNavProps) {
  return (
    <nav className="hidden md:flex space-x-8 items-center">
      {/* Hide the home link when on dashboard */}
      {!isOnDashboard && (
        <Link
          to="/"
          className={cn("nav-link", isActive("/") && "active")}
        >
          Accueil
        </Link>
      )}
      
      {/* Show these links when user is NOT on dashboard, regardless of login status */}
      {!isOnDashboard && (
        <>
          <Link
            to="/projects"
            className={cn("nav-link", isActive("/projects") && "active")}
          >
            Projets
          </Link>
          <Link
            to="/how-it-works"
            className={cn("nav-link", isActive("/how-it-works") && "active")}
          >
            Comment ça marche
          </Link>
          <Link
            to="/about"
            className={cn("nav-link", isActive("/about") && "active")}
          >
            À propos
          </Link>
        </>
      )}
      
      {!isLoggedIn ? (
        // Show login/register buttons only if not logged in
        <>
          <Link to="/login" className="btn-secondary">
            Connexion
          </Link>
          <Link to="/register" className="btn-primary">
            S'inscrire
          </Link>
        </>
      ) : !isOnDashboard ? (
        // Show dashboard button if logged in and not on dashboard
        <Link to="/dashboard" className="btn-primary">
          Tableau de bord
        </Link>
      ) : null}
    </nav>
  );
}
