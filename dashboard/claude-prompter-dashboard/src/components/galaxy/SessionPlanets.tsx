import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, Text } from '@react-three/drei';
import * as THREE from 'three';

interface Session {
  id: string;
  title: string;
  date: string;
  complexity: 'simple' | 'moderate' | 'complex';
  topics: string[];
  patterns: string[];
}

interface SessionPlanetsProps {
  sessions: Session[];
  onPlanetHover?: (sessionId: string | null) => void;
}

const SessionPlanet: React.FC<{ 
  session: Session; 
  position: [number, number, number];
  index: number;
  onHover?: (sessionId: string | null) => void;
}> = ({ session, position, index, onHover }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const [clicked, setClicked] = useState(false);

  // Gentle rotation animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.005;
      
      // Gentle floating animation
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + index) * 0.1;
    }
  });

  // Color based on complexity
  const getColor = () => {
    switch (session.complexity) {
      case 'simple': return '#4CAF50';     // Green
      case 'moderate': return '#FF9800';   // Orange  
      case 'complex': return '#F44336';    // Red
      default: return '#2196F3';           // Blue
    }
  };

  // Size based on number of topics
  const getSize = () => {
    const baseSize = 0.5;
    const topicMultiplier = Math.min(session.topics.length * 0.1, 0.4);
    return baseSize + topicMultiplier;
  };

  return (
    <group position={position}>
      {/* Main planet */}
      <Sphere
        ref={meshRef}
        args={[getSize(), 32, 32]}
        scale={hovered ? 1.2 : 1}
        onClick={() => {
          setClicked(!clicked);
          console.log('Clicked session:', session.title);
        }}
        onPointerOver={() => {
          setHovered(true);
          onHover?.(session.id);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover?.(null);
        }}
      >
        <meshStandardMaterial 
          color={getColor()}
          emissive={getColor()}
          emissiveIntensity={hovered ? 0.3 : 0.1}
          transparent
          opacity={0.8}
        />
      </Sphere>

      {/* Glowing ring around planet */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[getSize() * 1.2, getSize() * 1.4, 32]} />
        <meshBasicMaterial 
          color={getColor()} 
          transparent 
          opacity={hovered ? 0.4 : 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Session title (visible when hovered) */}
      {hovered && (
        <Text
          position={[0, getSize() + 1, 0]}
          fontSize={0.3}
          color="white"
          anchorX="center"
          anchorY="middle"
        >
          {session.title}
        </Text>
      )}

      {/* Topic orbits (simple circles for now) */}
      {session.topics.slice(0, 3).map((topic, topicIndex) => (
        <mesh 
          key={topicIndex}
          rotation={[Math.PI / 2, 0, topicIndex * Math.PI / 3]}
        >
          <ringGeometry args={[getSize() * (1.8 + topicIndex * 0.3), getSize() * (1.9 + topicIndex * 0.3), 32]} />
          <meshBasicMaterial 
            color="#ffffff" 
            transparent 
            opacity={0.1}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

const SessionPlanets: React.FC<SessionPlanetsProps> = ({ sessions, onPlanetHover }) => {
  // Arrange planets in a spiral galaxy pattern
  const getPosition = (index: number, total: number): [number, number, number] => {
    const radius = 2 + (index * 1.5);
    const angle = (index / total) * Math.PI * 4; // 2 full rotations
    const height = (Math.random() - 0.5) * 2; // Random height variation
    
    return [
      Math.cos(angle) * radius,
      height,
      Math.sin(angle) * radius
    ];
  };

  return (
    <>
      {sessions.map((session, index) => (
        <SessionPlanet
          key={session.id}
          session={session}
          position={getPosition(index, sessions.length)}
          index={index}
          onHover={onPlanetHover}
        />
      ))}
    </>
  );
};

export default SessionPlanets;