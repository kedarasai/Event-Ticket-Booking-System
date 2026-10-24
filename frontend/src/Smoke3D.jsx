import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function SpinningBox() {
  const meshRef = useRef(null)

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.8
      meshRef.current.rotation.y += delta * 1.2
    }
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#6366f1" roughness={0.2} metalness={0.8} />
    </mesh>
  )
}

export default function Smoke3D() {
  return (
    <div
      id="smoke3d-container"
      style={{
        width: '100%',
        maxWidth: '600px',
        height: '380px',
        margin: '2rem auto',
        borderRadius: '16px',
        overflow: 'hidden',
        background: 'radial-gradient(circle at center, #1e1b4b 0%, #030712 100%)',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(99, 102, 241, 0.2)'
      }}
    >
      <Canvas camera={{ position: [0, 0, 5], fov: 60 }}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={1.5} />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#818cf8" />
        <SpinningBox />
        <OrbitControls enableZoom={false} />
      </Canvas>
    </div>
  )
}
