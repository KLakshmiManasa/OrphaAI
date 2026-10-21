import { useEffect } from 'react';
import './App.css';
import OrphaAI from './OrphaAI';
import { AuthProvider } from './auth/AuthContext';
import { PredictionProvider } from './context/PredictionContext';
import CapsuleBotLauncher from './components/CapsuleBotLauncher';

export default function App() {
  useEffect(() => {
    // Prevent duplicate script injection
    if (document.getElementById('hellotars-script')) return;

    window.tarsSettings = {
      convid: "s_oIBs",
      branding: false,
      hide_branding: true,
    };

    const script = document.createElement('script');
    script.id = 'hellotars-script';
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://tars-file-upload.s3.amazonaws.com/bulb/v1/tars.js';

    script.onerror = () => {
      // Fallback to active HelloTars widget CDN if bulb endpoint is unavailable
      if (!document.getElementById('hellotars-fallback-script')) {
        const fallback = document.createElement('script');
        fallback.id = 'hellotars-fallback-script';
        fallback.type = 'text/javascript';
        fallback.async = true;
        fallback.src = 'https://tars-file-upload.s3.amazonaws.com/share/js/widget.js';
        document.body.appendChild(fallback);
      }
    };

    document.body.appendChild(script);

    return () => {
      // Keep widget persistent across routes
    };
  }, []);

  return (
    <AuthProvider>
      <PredictionProvider>
        <OrphaAI />
        <CapsuleBotLauncher />
      </PredictionProvider>
    </AuthProvider>
  );
}
