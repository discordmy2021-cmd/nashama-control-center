import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { MainRouter } from './MainRouter.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MainRouter />
  </StrictMode>
);
