import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Stardust Trail for Robot Buddy
export const StardustTrail: React.FC<{ robotPosition: THREE.Vector3 }> = ({ robotPosition }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const trailPositions = useRef<number[]>([]);
  const trailOpacities = useRef<number[]>([]);
  const maxTrailLength = 50;

  const geometry = useMemo(() => {
    const positions = new Float32Array(maxTrailLength * 3);
    const colors = new Float32Array(maxTrailLength * 3);
    const sizes = new Float32Array(maxTrailLength);
    
    for (let i = 0; i < maxTrailLength; i++) {
      // Cyan stardust color
      colors[i * 3] = 0.4;     // R
      colors[i * 3 + 1] = 0.8; // G  
      colors[i * 3 + 2] = 1.0; // B
      
      sizes[i] = Math.random() * 0.1 + 0.05;
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geom.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
    return geom;
  }, []);

  useFrame(() => {
    if (pointsRef.current && robotPosition) {
      // Add new particle at robot position
      trailPositions.current.unshift(
        robotPosition.x + (Math.random() - 0.5) * 0.2,
        robotPosition.y + (Math.random() - 0.5) * 0.2,
        robotPosition.z + (Math.random() - 0.5) * 0.2
      );
      trailOpacities.current.unshift(1.0);

      // Limit trail length
      if (trailPositions.current.length > maxTrailLength * 3) {
        trailPositions.current.splice(maxTrailLength * 3);
        trailOpacities.current.splice(maxTrailLength);
      }

      // Update positions and fade
      const positions = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < Math.min(trailPositions.current.length / 3, maxTrailLength); i++) {
        positions[i * 3] = trailPositions.current[i * 3] || 0;
        positions[i * 3 + 1] = trailPositions.current[i * 3 + 1] || 0;
        positions[i * 3 + 2] = trailPositions.current[i * 3 + 2] || 0;
        
        // Fade out over time
        trailOpacities.current[i] = Math.max(0, trailOpacities.current[i] - 0.03);
      }

      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <Points ref={pointsRef} geometry={geometry}>
      <PointMaterial
        transparent
        vertexColors
        size={0.1}
        sizeAttenuation={true}
        alphaTest={0.01}
        opacity={0.8}
      />
    </Points>
  );
};

// Achievement Meteors
export const AchievementMeteor: React.FC<{ trigger: boolean; onComplete: () => void }> = ({ 
  trigger, 
  onComplete 
}) => {
  const meteorRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    if (trigger && meteorRef.current) {
      const elapsed = state.clock.elapsedTime;
      const speed = 15;
      
      // Meteor path across screen
      meteorRef.current.position.x = -20 + elapsed * speed;
      meteorRef.current.position.y = 5 + Math.sin(elapsed * 2) * 2;
      meteorRef.current.position.z = Math.cos(elapsed * 3) * 3;
      
      // Remove when off screen
      if (meteorRef.current.position.x > 20) {
        onComplete();
      }
    }
  });

  if (!trigger) return null;

  return (
    <group ref={meteorRef}>
      {/* Meteor core */}
      <mesh>
        <sphereGeometry args={[0.2]} />
        <meshBasicMaterial color="#ffaa00" />
      </mesh>
      
      {/* Meteor trail */}
      <Points ref={trailRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={20}
            array={new Float32Array(60)}
            itemSize={3}
            args={[new Float32Array(60), 3]}
          />
        </bufferGeometry>
        <pointsMaterial size={0.1} color="#ff6600" transparent opacity={0.6} />
      </Points>
    </group>
  );
};

// Planet Halos
export const PlanetHalo: React.FC<{ 
  position: [number, number, number]; 
  size: number; 
  color: string;
  active: boolean;
}> = ({ position, size, color, active }) => {
  const haloRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const count = active ? 100 : 50;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = size * (1.5 + Math.random() * 0.5);
      const height = (Math.random() - 0.5) * 0.4;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;
    }
    
    return positions;
  }, [size, active]);

  useFrame((state) => {
    if (haloRef.current) {
      haloRef.current.rotation.y += 0.01;
      
      // Breathing effect
      const breathe = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
      haloRef.current.scale.setScalar(breathe);
    }
  });

  return (
    <Points ref={haloRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
          args={[particles, 3]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={active ? 0.06 : 0.03} 
        color={color} 
        transparent 
        opacity={active ? 0.8 : 0.4}
        sizeAttenuation={true}
      />
    </Points>
  );
};

// Hover Sparkles
export const HoverSparkles: React.FC<{ 
  position: [number, number, number]; 
  show: boolean 
}> = ({ position, show }) => {
  const sparklesRef = useRef<THREE.Points>(null);
  
  const sparklePositions = useMemo(() => {
    const count = 30;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 2;
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      
      positions[i * 3] = radius * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      positions[i * 3 + 2] = radius * Math.cos(theta);
    }
    
    return positions;
  }, []);

  useFrame((state) => {
    if (sparklesRef.current && show) {
      sparklesRef.current.rotation.x += 0.02;
      sparklesRef.current.rotation.y += 0.03;
      
      // Twinkling effect
      const material = sparklesRef.current.material as THREE.PointsMaterial;
      material.opacity = 0.5 + Math.sin(state.clock.elapsedTime * 5) * 0.3;
    }
  });

  if (!show) return null;

  return (
    <Points ref={sparklesRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={sparklePositions.length / 3}
          array={sparklePositions}
          itemSize={3}
          args={[sparklePositions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.05} 
        color="#ffffff" 
        transparent 
        opacity={0.8}
      />
    </Points>
  );
};

// Cosmic Dust Clouds for Programming Languages
export const CosmicDustCloud: React.FC<{
  position: [number, number, number];
  language: string;
  density: number;
}> = ({ position, language, density }) => {
  const cloudRef = useRef<THREE.Points>(null);
  
  const { particles, color } = useMemo(() => {
    const languageColors: { [key: string]: string } = {
      'React': '#61DAFB',
      'TypeScript': '#3178C6', 
      'JavaScript': '#F7DF1E',
      'Python': '#3776AB',
      'Node.js': '#339933',
      'Three.js': '#000000',
      'default': '#9333EA'
    };
    
    const count = Math.floor(density * 200);
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * 4;
      const y = (Math.random() - 0.5) * 2;
      const z = (Math.random() - 0.5) * 4;
      
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;
    }
    
    return {
      particles: positions,
      color: languageColors[language] || languageColors.default
    };
  }, [language, density]);

  useFrame((state) => {
    if (cloudRef.current) {
      // Slow drift
      cloudRef.current.rotation.y += 0.005;
      cloudRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
    }
  });

  return (
    <Points ref={cloudRef} position={position}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
          args={[particles, 3]}
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.02} 
        color={color} 
        transparent 
        opacity={0.3}
      />
    </Points>
  );
};