import React, { useEffect, useState } from 'react';
import Recorder from './components/Recorder';
import { Camera } from 'lucide-react';

// Simple global style injection for custom animations
const GlobalStyles = () => (
  <style>{`
    @keyframes slide-down {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes bounce-gentle {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    .animate-slide-down { animation: slide-down 0.5s ease-out forwards; }
    .animate-bounce-gentle { animation: bounce-gentle 3s infinite ease-in-out; }
    .animate-fade-in { animation: fade-in 0.3s ease-out forwards; }
  `}</style>
);

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [needsKey, setNeedsKey] = useState(false);
  const [apiKey, setApiKey] = useState('');

  useEffect(() => {
    // Check for API key in environment variable
    const envKey = import.meta.env.VITE_GROQ_API_KEY;
    if (envKey) {
      setApiKey(envKey);
      setIsReady(true);
    } else {
      setNeedsKey(true);
    }
  }, []);

  const handleStart = () => {
    const key = prompt('Please enter your Groq API Key:');
    if (key && key.trim()) {
      setApiKey(key.trim());
      setNeedsKey(false);
      setIsReady(true);
    }
  };

  if (needsKey) {
    return (
      <>
        <GlobalStyles />
        <div className="min-h-screen bg-pastel-cream flex flex-col items-center justify-center p-4 text-center font-sans">
          <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl animate-fade-in">
            <div className="w-16 h-16 bg-pastel-slate text-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
              <Camera className="w-8 h-8" />
            </div>
            <h1 className="text-3xl font-serif text-pastel-slate font-bold mb-4">Memoria</h1>
            <p className="text-gray-600 mb-8 leading-relaxed">
              Welcome to your digital biographer. To begin capturing your memories with Groq AI, please provide an API key.
            </p>
            
            <button 
              onClick={handleStart}
              className="w-full py-4 bg-pastel-slate text-white rounded-2xl font-bold text-lg hover:bg-gray-700 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              Get Started
            </button>
            
            <p className="mt-6 text-xs text-gray-400">
              Note: This application uses Groq's AI API. 
              <br />
              <a href="https://console.groq.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-pastel-slate">
                Get your API key at console.groq.com
              </a>
            </p>
          </div>
        </div>
      </>
    );
  }

  if (!isReady) {
    return <div className="min-h-screen flex items-center justify-center bg-pastel-cream text-pastel-slate animate-pulse">Initializing Memoria...</div>;
  }

  return (
    <>
      <GlobalStyles />
      <div className="min-h-screen bg-pastel-cream text-slate-800">
        <Recorder apiKey={apiKey} />
      </div>
    </>
  );
};

export default App;
