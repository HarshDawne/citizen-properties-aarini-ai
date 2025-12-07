import React from 'react';
import AariniChatbot from './components/AariniChatbot';

const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 relative font-sans">
      {/* 
        The app container is now intentionally blank to highlight the floating widget.
        The widget handles its own positioning (fixed bottom-right).
      */}
      <AariniChatbot />
    </div>
  );
};

export default App;