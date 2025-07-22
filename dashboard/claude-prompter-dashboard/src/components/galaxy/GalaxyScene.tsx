import React, { Suspense, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import SessionPlanets from './SessionPlanets';
import RobotBuddy from './RobotBuddy';
import { StardustTrail, AchievementMeteor, PlanetHalo, HoverSparkles } from './ParticleEffects';
import { ProjectRegions } from './ProjectRegions';
import * as THREE from 'three';

interface GalaxySceneProps {
  sessions: Array<{
    id: string;
    title: string;
    date: string;
    complexity: 'simple' | 'moderate' | 'complex';
    topics: string[];
    patterns: string[];
  }>;
}

const GalaxyScene: React.FC<GalaxySceneProps> = ({ sessions }) => {
  const [robotPosition] = useState(new THREE.Vector3(3, 2, 3));
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [showMeteor, setShowMeteor] = useState(false);
  const [hoveredPlanet, setHoveredPlanet] = useState<string | null>(null);

  // Trigger achievement meteor occasionally
  React.useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        setShowMeteor(true);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: '100%', height: '600px', background: '#000011' }}>
      <Canvas
        camera={{ 
          position: [0, 0, 10], 
          fov: 75,
          near: 0.1,
          far: 1000 
        }}
      >
        {/* Lighting */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4169E1" />
        
        {/* Beautiful starfield background */}
        <Stars 
          radius={300} 
          depth={60} 
          count={3000} 
          factor={7} 
          saturation={0} 
          fade={true}
        />
        
        {/* Camera controls for navigation */}
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
          autoRotate={false}
          autoRotateSpeed={0.5}
        />
        
        <Suspense fallback={null}>
          {/* Project Regions */}
          <ProjectRegions 
            onRegionSelect={setSelectedRegion}
            activeRegion={selectedRegion}
          />
          
          {/* Session planets */}
          <SessionPlanets 
            sessions={sessions} 
            onPlanetHover={setHoveredPlanet}
          />
          
          {/* Planet Halos */}
          {sessions.map((session, index) => {
            const angle = (index / sessions.length) * Math.PI * 4;
            const radius = 2 + (index * 1.5);
            const position: [number, number, number] = [
              Math.cos(angle) * radius,
              (Math.random() - 0.5) * 2,
              Math.sin(angle) * radius
            ];
            
            return (
              <PlanetHalo
                key={session.id}
                position={position}
                size={0.5 + Math.min(session.topics.length * 0.1, 0.4)}
                color={session.complexity === 'simple' ? '#4CAF50' : 
                       session.complexity === 'moderate' ? '#FF9800' : '#F44336'}
                active={hoveredPlanet === session.id}
              />
            );
          })}
          
          {/* Cute robot buddy */}
          <RobotBuddy />
          
          {/* Stardust trail following robot */}
          <StardustTrail robotPosition={robotPosition} />
          
          {/* Achievement meteor */}
          <AchievementMeteor 
            trigger={showMeteor}
            onComplete={() => setShowMeteor(false)}
          />
          
          {/* Hover sparkles */}
          {hoveredPlanet && sessions.map((session, index) => {
            if (session.id !== hoveredPlanet) return null;
            
            const angle = (index / sessions.length) * Math.PI * 4;
            const radius = 2 + (index * 1.5);
            const position: [number, number, number] = [
              Math.cos(angle) * radius,
              (Math.random() - 0.5) * 2,
              Math.sin(angle) * radius
            ];
            
            return (
              <HoverSparkles
                key={`sparkles-${session.id}`}
                position={position}
                show={true}
              />
            );
          })}
        </Suspense>
      </Canvas>
      
      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        fontFamily: 'Arial, sans-serif',
        pointerEvents: 'none',
        zIndex: 10
      }}>
        <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>
          🌌 Learning Galaxy
        </h2>
        <p style={{ margin: '5px 0', opacity: 0.8 }}>
          Navigate your learning journey • {sessions.length} sessions
        </p>
        <p style={{ margin: 0, fontSize: '12px', opacity: 0.6 }}>
          Click and drag to explore • Scroll to zoom
        </p>
      </div>
    </div>
  );
};

export default GalaxyScene;