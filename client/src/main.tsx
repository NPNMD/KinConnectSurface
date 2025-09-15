import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Import debug helpers for rate limiting monitoring
import './utils/debugHelpers';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
