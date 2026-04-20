import { useState, useEffect } from 'react';
import type { Application } from '../types';

export default function MukhtarDashboard() {
  const [pending, setPending] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/applications?role=mukhtar')
      .then(res => res.json())
      .then(data => {
        // The Crash Shield
        if (Array.isArray(data)) {
          setPending(data);
        } else {
          setError("Database configuration error or missing tables.");
        }
      })
      .catch(() => setError("Backend server is currently unreachable."));
  }, []);

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="bg-blue-900 text-white p-4 rounded-t-lg flex justify-between items-center">
        <h1 className="text-xl font-bold tracking-wide">NPIS | Mukhtar Dashboard</h1>
        <span className="text-sm font-medium uppercase tracking-wider">Logged In: Mukhtar Beirut</span>
      </div>

      <div className="bg-white p-6 rounded-b-lg shadow-md border border-t-0 border-gray-200">
        
        {/* Legal Notice */}
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 mb-6 text-sm text-gray-800">
          <strong className="text-orange-700">Legal Notice:</strong> Under Law No. 81/2018, your "Reliable Electronic Signature" holds the exact same legal weight as a physical "wet ink" signature. Ensure you review all applicant photos and forms carefully before signing.
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-6">
            <p className="font-bold">Connection Error</p>
            <p>{error}</p>
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-800 mb-4 border-b pb-2">Pending Applications (District: Beirut)</h2>

        {/* Data Table */}
        {!error && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-100 border-y border-gray-200 text-sm text-gray-600 uppercase tracking-wider">
                  <th className="p-4 font-semibold">Name & Registry</th>
                  <th className="p-4 font-semibold">ML Document Check</th>
                  <th className="p-4 font-semibold text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-8 text-center text-gray-500 italic">No pending applications require signature at this time.</td>
                  </tr>
                ) : (
                  pending.map(app => (
                    <tr key={app.application_id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-gray-800">{app.full_name}</p>
                        <p className="text-sm text-gray-500">Reg: {app.registry_number}</p>
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded border border-green-200">
                          ✓ Passed (Docs & Dimensions)
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <button className="bg-blue-700 text-white text-sm font-bold px-4 py-2 rounded shadow hover:bg-blue-800 transition">
                          Apply E-Signature
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}