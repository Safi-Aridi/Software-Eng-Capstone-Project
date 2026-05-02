import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { authService, type UserRole } from "../../services/authService";

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  fallbackPath?: string;
}

const ProtectedRoute = ({
  children,
  requiredRole,
  fallbackPath = "/",
}: ProtectedRouteProps) => {
  const location = useLocation();
  const currentUser = authService.getCurrentUser();

  if (!currentUser) {
    // Redirect to login with return path
    const loginPath = requiredRole === "mukhtar" ? "/authorized-login" : "/";
    return <Navigate to={loginPath} state={{ from: location }} replace />;
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    // User has wrong role, redirect to appropriate dashboard or logout
    authService.logout();
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
