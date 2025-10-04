import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Import the main App component

// Find the root DOM element where the React app will be mounted
const rootElement = document.getElementById('root');

// Create a root for the application
const root = ReactDOM.createRoot(rootElement);

// Render the main component
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);