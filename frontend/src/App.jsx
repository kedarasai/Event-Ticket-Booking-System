import Smoke3D from './Smoke3D'
import './App.css'

function App() {
  return (
    <main style={{ padding: '2rem', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <header>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem', background: 'linear-gradient(to right, #6366f1, #a855f7)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Ticket Booking System
        </h1>
        <p style={{ color: '#94a3b8', fontSize: '1.1rem' }}>
          3D Canvas Smoke Test
        </p>
      </header>

      <Smoke3D />

      <footer style={{ marginTop: '1rem', color: '#64748b', fontSize: '0.9rem' }}>
        React + Vite + Three.js + @react-three/fiber + @react-three/drei
      </footer>
    </main>
  )
}

export default App
