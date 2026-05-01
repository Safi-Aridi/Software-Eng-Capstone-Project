import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CitizenLoginPage from "./pages/CitizenLoginPage";
import CitizenSignupPage from "./pages/CitizenSignupPage";
import CitizenDashboard from "./pages/CitizenDashboard";
import AuthorizedLoginPage from "./pages/AuthorizedLoginPage";
import MukhtarDashboard from "./pages/MukhtarDashboard";
import OfficerDashboard from "./pages/OfficerDashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import IdentityVerificationPage from "./pages/IdentityVerificationPage";
import NewPassportApplicationPage from "./pages/NewPassportApplicationPage";
import ApplicationStatusPage from "./pages/ApplicationStatusPage";
import DocumentResubmissionPage from "./pages/DocumentResubmissionPage";
import PaymentPage from "./pages/PaymentPage";
import { seedTestDataIfNeeded } from "./services/seedTestData";

// Seed 3 test users into localStorage on first load (no-op if already seeded)
seedTestDataIfNeeded();

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<CitizenLoginPage />} />
        <Route path="/signup" element={<CitizenSignupPage />} />
        <Route path="/authorized-login" element={<AuthorizedLoginPage />} />
        <Route
          path="/identity-verification"
          element={<IdentityVerificationPage />}
        />

        {/* Protected Routes */}
        <Route
          path="/citizen/dashboard"
          element={
            <ProtectedRoute requiredRole="citizen">
              <CitizenDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/application/new"
          element={
            <ProtectedRoute requiredRole="citizen">
              <NewPassportApplicationPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/application/status/:applicationId"
          element={
            <ProtectedRoute requiredRole="citizen">
              <ApplicationStatusPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/application/resubmit/:applicationId"
          element={
            <ProtectedRoute requiredRole="citizen">
              <DocumentResubmissionPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/application/pay/:applicationId"
          element={
            <ProtectedRoute requiredRole="citizen">
              <PaymentPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/mukhtar/dashboard"
          element={
            <ProtectedRoute requiredRole="mukhtar">
              <MukhtarDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/officer/dashboard"
          element={
            <ProtectedRoute requiredRole="officer">
              <OfficerDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
