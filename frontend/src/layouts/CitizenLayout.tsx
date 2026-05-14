import { Outlet } from "react-router-dom";
import AiAssistantWidget from "../components/AiAssistantWidget";

// Wraps citizen-facing routes so the AI assistant persists across navigation
// without appearing on /mukhtar/* or /officer/* routes.
const CitizenLayout = () => (
  <>
    <Outlet />
    <AiAssistantWidget />
  </>
);

export default CitizenLayout;
