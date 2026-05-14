import { createBrowserRouter, RouterProvider } from "react-router-dom";
import CitizenLoginPage from "./pages/CitizenLoginPage";
import CitizenSignupPage from "./pages/CitizenSignupPage";
import CitizenDashboard from "./pages/CitizenDashboard";
import AuthorizedLoginPage from "./pages/AuthorizedLoginPage";
import MukhtarDashboard from "./pages/MukhtarDashboard";
import OfficerDashboard from "./pages/OfficerDashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import IdentityVerificationPage from "./pages/IdentityVerificationPage";
import NewPassportApplicationPage from "./pages/NewPassportApplicationPage";
import PreApplicationChecklistPage from "./pages/PreApplicationChecklistPage";
import CitizenProfilePage from "./pages/CitizenProfilePage";
import ApplicationStatusPage from "./pages/ApplicationStatusPage";
import DocumentResubmissionPage from "./pages/DocumentResubmissionPage";
import PaymentPage from "./pages/PaymentPage";
import { seedTestDataIfNeeded } from "./services/seedTestData";
import DevStatusPanel from "./components/DevStatusPanel";
import CitizenLayout from "./layouts/CitizenLayout";

// Seed 3 test users into localStorage on first load (no-op if already seeded)
seedTestDataIfNeeded();

// Data router enables useBlocker (used by PaymentPage's unsaved-payment guard).
// Citizen-facing routes are nested under CitizenLayout so the AI assistant
// only renders for citizens — never on /authorized-login, /mukhtar/*, /officer/*.
const router = createBrowserRouter([
  {
    element: <CitizenLayout />,
    children: [
      { path: "/", element: <CitizenLoginPage /> },
      { path: "/signup", element: <CitizenSignupPage /> },
      { path: "/identity-verification", element: <IdentityVerificationPage /> },
      {
        path: "/citizen/dashboard",
        element: (
          <ProtectedRoute requiredRole="citizen">
            <CitizenDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: "/citizen/profile",
        element: (
          <ProtectedRoute requiredRole="citizen">
            <CitizenProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/application/checklist",
        element: (
          <ProtectedRoute requiredRole="citizen">
            <PreApplicationChecklistPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/application/new",
        element: (
          <ProtectedRoute requiredRole="citizen">
            <NewPassportApplicationPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/application/status/:applicationId",
        element: (
          <ProtectedRoute requiredRole="citizen">
            <ApplicationStatusPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/application/resubmit/:applicationId",
        element: (
          <ProtectedRoute requiredRole="citizen">
            <DocumentResubmissionPage />
          </ProtectedRoute>
        ),
      },
      {
        path: "/application/pay/:applicationId",
        element: (
          <ProtectedRoute requiredRole="citizen">
            <PaymentPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: "/authorized-login", element: <AuthorizedLoginPage /> },
  {
    path: "/mukhtar/dashboard",
    element: (
      <ProtectedRoute requiredRole="mukhtar">
        <MukhtarDashboard />
      </ProtectedRoute>
    ),
  },
  {
    path: "/officer/dashboard",
    element: (
      <ProtectedRoute requiredRole="officer">
        <OfficerDashboard />
      </ProtectedRoute>
    ),
  },
]);

function App() {
  return (
    <>
      {import.meta.env.DEV && <DevStatusPanel />}
      <RouterProvider router={router} />
    </>
  );
}

export default App;
