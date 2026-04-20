import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import CitizenDashboard from './pages/CitizenDashboard';
import MukhtarDashboard from './pages/MukhtarDashboard';
import OfficerDashboard from './pages/OfficerDashboard';

function App() {
  return (
    <Router>
      {/* Navigation Bar for Development */}
      <nav className="p-4 bg-gray-200 border-b flex gap-4 font-bold">
        <Link to="/citizen" className="text-blue-700 hover:underline">Citizen Portal</Link>
        <Link to="/mukhtar" className="text-blue-700 hover:underline">Mukhtar Portal</Link>
        <Link to="/officer" className="text-blue-700 hover:underline">GS Officer Portal</Link>
      </nav>

      {/* The Role-Based Views [cite: 459] */}
      <Routes>
        <Route path="/" element={<div className="p-8"><h1 className="text-2xl font-bold">NPIS System Online</h1><p>Select a portal from the navigation bar.</p></div>} />
        <Route path="/citizen" element={<CitizenDashboard />} />
        <Route path="/mukhtar" element={<MukhtarDashboard />} />
        <Route path="/officer" element={<OfficerDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;