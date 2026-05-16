import { Outlet, useLocation, useNavigate } from "react-router-dom";
import AiAssistantWidget from "../components/AiAssistantWidget";
import NotificationCenter from "../components/NotificationCenter";
import { authService } from "../services/authService";

const CITIZEN_HEADER_ROUTES = ["/citizen", "/application"];

const CitizenHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const userId = currentUser?.user.id;
  const displayName = currentUser?.user.fullName || "Citizen";

  const handleLogout = () => {
    authService.logout();
    navigate("/");
  };

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <header className="fixed inset-x-0 top-0 z-40 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white shadow-lg">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate("/citizen/dashboard")}
          className="flex items-center gap-3 text-left"
          aria-label="Go to citizen dashboard"
        >
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/20">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </span>
          <span className="hidden sm:block">
            <span className="block text-sm font-semibold leading-5">
              Lebanese Passport Platform
            </span>
            <span className="block text-xs text-blue-100">
              Signed in as {displayName}
            </span>
          </span>
        </button>

        <nav className="flex items-center gap-2">
          <button
            onClick={() => navigate("/citizen/dashboard")}
            className={`hidden rounded-full px-3 py-2 text-sm font-medium transition-colors sm:inline-flex ${
              isActive("/citizen/dashboard")
                ? "bg-white text-blue-700"
                : "text-blue-50 hover:bg-white/15"
            }`}
          >
            Dashboard
          </button>

          {userId && <NotificationCenter userId={userId} variant="light" />}

          <button
            onClick={() => navigate("/citizen/profile")}
            className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
              isActive("/citizen/profile")
                ? "bg-white text-blue-700"
                : "text-blue-50 hover:bg-white/15"
            }`}
            aria-label="Open profile"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
            <span className="hidden sm:inline">Profile</span>
          </button>

          <button
            onClick={handleLogout}
            className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
          >
            Logout
          </button>
        </nav>
      </div>
    </header>
  );
};

// Wraps citizen-facing routes so the AI assistant persists across navigation
// without appearing on /mukhtar/* or /officer/* routes.
const CitizenLayout = () => {
  const location = useLocation();
  const currentUser = authService.getCurrentUser();
  const showCitizenHeader =
    currentUser?.role === "citizen" &&
    CITIZEN_HEADER_ROUTES.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <>
      {showCitizenHeader && <CitizenHeader />}
      <main className={showCitizenHeader ? "pt-16" : undefined}>
        <Outlet />
      </main>
      <AiAssistantWidget />
    </>
  );
};

export default CitizenLayout;
