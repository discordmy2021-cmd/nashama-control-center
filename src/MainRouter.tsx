import { useState, useEffect } from 'react';
import { AdminApp } from './App.tsx';
import { AgentApp } from './AgentApp.tsx';
import { navigate } from './lib/navigate.ts';

function usePathname(): string {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    function handler() { setPath(window.location.pathname); }
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);
  return path;
}

function MainRouter() {
  const path = usePathname();
  const isAgent = path.startsWith('/agent');

  if (isAgent) return <AgentApp onNavigate={navigate} />;
  return <AdminApp onNavigate={navigate} />;
}

export { MainRouter };
export default MainRouter;
