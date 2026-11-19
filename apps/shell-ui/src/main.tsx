import '@fontsource-variable/manrope';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design-system/theme.css';
import { ShellApp } from './app/ShellApp';

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element in index.html');

createRoot(container).render(
  <StrictMode>
    <ShellApp />
  </StrictMode>,
);
