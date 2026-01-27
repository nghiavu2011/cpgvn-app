
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './components/LanguageContext';

console.log("CPGVN App: Initializing...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("CPGVN App: Could not find root element to mount to");
  const errorDiv = document.createElement('div');
  errorDiv.style.color = 'red';
  errorDiv.style.padding = '20px';
  errorDiv.innerText = "Fatal Error: Root element not found. Please refresh.";
  document.body.appendChild(errorDiv);
  throw new Error("Could not find root element to mount to");
}

try {
  console.log("CPGVN App: Creating React root...");
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </React.StrictMode>
  );
  console.log("CPGVN App: Rendered.");
} catch (error) {
  console.error("CPGVN App: Initialization failed", error);
  rootElement.innerHTML = `<div style="color:red; padding: 20px;">App Crash: ${error instanceof Error ? error.message : String(error)}</div>`;
}
