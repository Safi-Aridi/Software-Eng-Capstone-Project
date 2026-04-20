import { useState, useEffect } from 'react';
import type { Application } from '../types';

export default function OfficerDashboard() {
  const [queue, setQueue] = useState<Application[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('http://localhost:5000/api/applications?role=officer')
      .then(res => res.json())
      .then(data => {
        // The Crash Shield: Only update the queue if it's a real array
        if (Array.isArray(data)) {
          setQueue(data);
        } else {
          setError("Database disconnected or table missing.");
        }
      })
      .catch(() => setError("Failed to fetch from backend."));
  }, []);

  return (
    <div className="p-8 bg-slate-900 text-green-400 min-h-screen font-mono">
      <h1 className="text-xl border-b border-green-800 mb-6">GS-TERMINAL // INCOMING_QUEUE</h1>
      
      {error && <p className="text-red-500 bg-red-900/20 p-4 border border-red-500">[SYSTEM ERROR]: {error}</p>}
      
      {!error && queue.length === 0 && <p>Ready for Final Processing: 0</p>}

      {!error && queue.map(app => (
        <div key={app.application_id} className="mb-4 border border-green-900 p-4">
          <p>[APP_ID]: {app.application_id}</p>
          <p>[CITIZEN]: {app.full_name}</p>
          <p>[REGISTRY]: {app.registry_number}</p>
          <button className="mt-2 bg-green-700 text-black px-4 py-1 hover:bg-green-500 font-bold transition-colors">
            INITIATE PASSPORT PRINTING
          </button>
        </div>
      ))}
    </div>
  );
}