import './App.css';
import OrphaAI from './OrphaAI';
import { AuthProvider } from './auth/AuthContext';
import { PredictionProvider } from './context/PredictionContext';
import CapsuleBotLauncher from './components/CapsuleBotLauncher';

export default function App() {


  return (
    <AuthProvider>
      <PredictionProvider>
        <OrphaAI />
        <CapsuleBotLauncher />
      </PredictionProvider>
    </AuthProvider>
  );
}
