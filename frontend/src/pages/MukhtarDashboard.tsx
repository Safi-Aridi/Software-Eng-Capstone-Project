import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { authService } from "../services/authService";

interface Application {
  application_id: string;
  full_name: string;
  registry_number: string;
  status?: string;
}

const MukhtarDashboard = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    // Redirect if no user or wrong role
    if (!currentUser) {
      navigate("/authorized-login");
      return;
    }

    if (currentUser.role !== "mukhtar") {
      authService.logout();
      navigate("/authorized-login");
      return;
    }
  }, [currentUser, navigate]);

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          "http://localhost:5000/api/applications?role=mukhtar",
        );

        if (!response.ok) {
          throw new Error("Failed to fetch applications");
        }

        const data = await response.json();

        if (Array.isArray(data)) {
          setApplications(data);
        } else {
          setError("Invalid data format received");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    if (currentUser && currentUser.role === "mukhtar") {
      fetchApplications();
    }
  }, [currentUser]);

  const handleLogout = () => {
    authService.logout();
    navigate("/authorized-login");
  };

  if (!currentUser || currentUser.role !== "mukhtar") {
    return null; // Will redirect
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-800 text-white p-4 shadow-md">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold tracking-wide">
              Authorized Personnel Dashboard
            </h1>
            <p className="text-sm text-gray-300">
              National Passport Issuance System
            </p>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-sm">
              Welcome, {currentUser.user.fullName}
            </span>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-amber-800 mb-2">Legal Notice</h3>
            <p className="text-amber-700 text-sm">
              Under Law No. 81/2018, your electronic signature holds the same
              legal weight as a physical signature. Review all applicant
              information carefully before taking action.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-800">Error: {error}</p>
            </div>
          )}

          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Applications Requiring Review
          </h2>

          {applications.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-lg">
              <svg
                className="w-12 h-12 text-gray-400 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="text-gray-600 mb-2">No applications found</p>
              <p className="text-sm text-gray-500">
                No applications currently require your review.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 border-b border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                    <th className="p-4 font-semibold">Applicant Name</th>
                    <th className="p-4 font-semibold">Registry Number</th>
                    <th className="p-4 font-semibold">Application ID</th>
                    <th className="p-4 font-semibold">Status</th>
                    <th className="p-4 font-semibold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((app) => (
                    <tr
                      key={app.application_id}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4 font-medium text-gray-800">
                        {app.full_name}
                      </td>
                      <td className="p-4 text-gray-600">
                        {app.registry_number}
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-xs text-gray-600">
                          {app.application_id}
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            app.status === "approved"
                              ? "bg-green-100 text-green-800"
                              : app.status === "pending"
                                ? "bg-yellow-100 text-yellow-800"
                                : app.status === "rejected"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {app.status || "Unknown"}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button className="bg-blue-600 text-white text-sm font-medium px-3 py-1 rounded hover:bg-blue-700 transition-colors mr-2">
                          Review
                        </button>
                        <button className="bg-gray-600 text-white text-sm font-medium px-3 py-1 rounded hover:bg-gray-700 transition-colors">
                          Sign (Coming Soon)
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MukhtarDashboard;
