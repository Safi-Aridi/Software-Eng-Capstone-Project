import { useState, useEffect } from 'react';
import { authService } from '../../services/authService';

interface Application {
  id: string;
  type: string;
  status: string;
  submittedDate: string;
  fullName?: string;
}

const CitizenDashboardContent = () => {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        setLoading(true);
        const response = await fetch('http://localhost:5000/api/applications?role=citizen');
        
        if (!response.ok) {
          throw new Error('Failed to fetch applications');
        }
        
        const data = await response.json();
        setApplications(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/';
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading applications...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Citizen Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome, {currentUser?.user?.fullName}</p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">Your Applications</h2>
            
            {applications.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-600 mb-2">No applications found</p>
                <p className="text-sm text-gray-500">You haven't submitted any passport applications yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-gray-800">
                          {app.type} Application
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Submitted: {new Date(app.submittedDate).toLocaleDateString()}
                        </p>
                        {app.fullName && (
                          <p className="text-sm text-gray-600">
                            Applicant: {app.fullName}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          app.status === 'approved' ? 'bg-green-100 text-green-800' :
                          app.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          app.status === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {app.status.charAt(0).toUpperCase() + app.status.slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200 pt-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">Ready to Apply?</h3>
              <p className="text-blue-700 text-sm mb-3">
                You can now submit new passport applications through our secure portal.
              </p>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors">
                New Application (Coming Soon)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CitizenDashboardContent;
