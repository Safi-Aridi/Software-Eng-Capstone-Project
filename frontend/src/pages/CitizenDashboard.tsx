import { useEffect, useState } from 'react';
import type { Application } from '../types';

export default function CitizenDashboard() {
  const [myApps, setMyApps] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/applications?role=citizen')
      .then(res => res.json())
      .then(data => {
        // The Crash Shield
        if (Array.isArray(data)) {
          setMyApps(data);
        } else {
          setError("Unable to retrieve applications. The National Database may be offline.");
        }
      })
      .catch(() => setError("Failed to connect to the government server."));
  }, []);

  return (
    <div className="p-8 max-w-4xl mx-auto font-sans">
      <h1 className="text-3xl font-bold mb-6 text-red-800 border-b-4 border-green-600 pb-2">
        Official Citizen Issuance Portal
      </h1>

      {/* Error State */}
      {error && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 shadow" role="alert">
          <p className="font-bold">System Notice</p>
          <p>{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!error && myApps.length === 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded p-8 text-center text-gray-600 italic shadow-sm">
          No active applications found. Please start a new passport application.
        </div>
      )}

      {/* Active Applications */}
      {!error && myApps.map(app => (
        <div key={app.application_id} className="border border-gray-200 p-6 rounded-lg shadow bg-white mb-4">
          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <h2 className="text-xl font-semibold text-gray-800">{app.full_name}</h2>
            <span className="px-3 py-1 border border-green-600 text-green-700 rounded text-sm font-bold bg-green-50">
              {app.status}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
            <p><strong>Registry Number:</strong> {app.registry_number}</p>
            <p><strong>Application ID:</strong> <span className="font-mono text-xs">{app.application_id}</span></p>
          </div>
        </div>
      ))}
    </div>
  );
}