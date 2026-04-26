import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import CitizenLoginPage from "./pages/CitizenLoginPage";
import CitizenSignupPage from "./pages/CitizenSignupPage";
import CitizenDashboard from "./pages/CitizenDashboard";
import AuthorizedLoginPage from "./pages/AuthorizedLoginPage";
import MukhtarDashboard from "./pages/MukhtarDashboard";
import ProtectedRoute from "./components/auth/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<CitizenLoginPage />} />
        <Route path="/signup" element={<CitizenSignupPage />} />
        <Route path="/authorized-login" element={<AuthorizedLoginPage />} />

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
          path="/mukhtar/dashboard"
          element={
            <ProtectedRoute requiredRole="mukhtar">
              <MukhtarDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
