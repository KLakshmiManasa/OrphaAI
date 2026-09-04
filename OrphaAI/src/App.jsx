import './App.css'
import OrphaAI from './OrphaAI'
import { AuthProvider } from './auth/AuthContext'

function App() {
  return (
    <AuthProvider>
      <OrphaAI/>
    </AuthProvider>
  )
}

export default App
