import React from 'react';
import ReactDOM from 'react-dom/client';
import AariniChatbot from './components/AariniChatbot';

// This creates a reusable widget that can be embedded anywhere
const AariniChatbotWidget = () => {
  return <AariniChatbot />;
};

export default AariniChatbotWidget;

// For script-based embedding
declare global {
  interface Window {
    AariniChatbot?: {
      init: (containerId: string, apiKey: string) => void;
    };
  }
}

// If loaded as a script, expose the init function
if (typeof window !== 'undefined') {
  window.AariniChatbot = {
    init: (containerId: string, apiKey: string) => {
      const container = document.getElementById(containerId);
      if (!container) {
        console.error(`Container with id "${containerId}" not found`);
        return;
      }
      
      // Set API key globally
      (window as any).REACT_APP_GEMINI_API_KEY = apiKey;
      
      const root = ReactDOM.createRoot(container);
      root.render(<AariniChatbotWidget />);
    }
  };
}
