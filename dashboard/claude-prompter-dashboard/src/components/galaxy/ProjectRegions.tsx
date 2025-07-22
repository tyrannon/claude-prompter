import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, Box, Sphere } from '@react-three/drei';
import { CosmicDustCloud } from './ParticleEffects';
import * as THREE from 'three';

interface ProjectRegion {
  name: string;
  position: [number, number, number];
  theme: {
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    description: string;
  };
  sessions: number;
  languages: string[];
  patterns: string[];
}

const PROJECT_THEMES = {
  'stylemuse': {
    primaryColor: '#FF6B9D',    // Pink for creativity
    secondaryColor: '#A855F7',  // Purple for design
    accentColor: '#FCD34D',     // Gold for aesthetics
    description: 'UI Design & Creativity'
  },
  'permitagent': {
    primaryColor: '#10B981',    // Green for automation
    secondaryColor: '#3B82F6',  // Blue for efficiency
    accentColor: '#6366F1',     // Indigo for structure
    description: 'Backend Automation'
  },
  'claude-prompter': {
    primaryColor: '#8B5CF6',    // Purple for AI
    secondaryColor: '#06B6D4',  // Cyan for intelligence
    accentColor: '#F59E0B',     // Amber for learning
    description: 'Meta-Learning & AI'
  },
  'default': {
    primaryColor: '#6366F1',    // Indigo
    secondaryColor: '#8B5CF6',  // Purple
    accentColor: '#EC4899',     // Pink
    description: 'General Projects'
  }
};

const ProjectGate: React.FC<{ 
  region: ProjectRegion; 
  onClick: () => void;
  active: boolean;
}> = ({ region, onClick, active }) => {
  const gateRef = useRef<THREE.Group>(null);
  const theme = PROJECT_THEMES[region.name as keyof typeof PROJECT_THEMES] || PROJECT_THEMES.default;

  useFrame((state) => {
    if (gateRef.current) {
      // Gentle floating
      gateRef.current.position.y = region.position[1] + Math.sin(state.clock.elapsedTime + region.position[0]) * 0.1;
      
      // Glowing pulse when active
      if (active) {
        gateRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.05);
      }
    }
  });

  return (
    <group 
      ref={gateRef} 
      position={region.position}
      onClick={onClick}
    >
      {/* Main Gate Structure */}
      <Box args={[0.2, 4, 0.2]} position={[-1.5, 0, 0]}>
        <meshStandardMaterial 
          color={theme.primaryColor} 
          emissive={theme.primaryColor}
          emissiveIntensity={active ? 0.3 : 0.1}
        />
      </Box>
      <Box args={[0.2, 4, 0.2]} position={[1.5, 0, 0]}>
        <meshStandardMaterial 
          color={theme.primaryColor}
          emissive={theme.primaryColor}
          emissiveIntensity={active ? 0.3 : 0.1}
        />
      </Box>
      <Box args={[3, 0.2, 0.2]} position={[0, 2, 0]}>
        <meshStandardMaterial 
          color={theme.primaryColor}
          emissive={theme.primaryColor}
          emissiveIntensity={active ? 0.3 : 0.1}
        />
      </Box>

      {/* Portal Effect */}
      <Sphere args={[1.2]} position={[0, 0.5, 0]}>
        <meshBasicMaterial 
          color={theme.secondaryColor}
          transparent
          opacity={active ? 0.3 : 0.15}
          side={THREE.DoubleSide}
        />
      </Sphere>

      {/* Project Name */}
      <Text
        position={[0, -2.5, 0]}
        fontSize={0.4}
        color={theme.accentColor}
        anchorX="center"
        anchorY="middle"
      >
        {region.name.toUpperCase()}
      </Text>

      {/* Description */}
      <Text
        position={[0, -3.2, 0]}
        fontSize={0.2}
        color="white"
        anchorX="center"
        anchorY="middle"
        maxWidth={4}
      >
        {theme.description}
      </Text>

      {/* Session Count Badge */}
      <Sphere args={[0.3]} position={[2, 1.5, 0]}>
        <meshBasicMaterial color={theme.accentColor} />
      </Sphere>
      <Text
        position={[2, 1.5, 0.35]}
        fontSize={0.2}
        color="black"
        anchorX="center"
        anchorY="middle"
      >
        {region.sessions}
      </Text>

      {/* Language Dust Clouds */}
      {region.languages.map((language, index) => (
        <CosmicDustCloud
          key={language}
          position={[
            Math.cos((index / region.languages.length) * Math.PI * 2) * 2,
            Math.sin((index / region.languages.length) * Math.PI * 2) * 0.5,
            Math.sin((index / region.languages.length) * Math.PI * 2) * 2
          ]}
          language={language}
          density={0.5}
        />
      ))}
    </group>
  );
};

export const ProjectRegions: React.FC<{
  onRegionSelect: (region: string) => void;
  activeRegion: string | null;
}> = ({ onRegionSelect, activeRegion }) => {
  // Sample project data - in real app, this would come from claude-prompter analytics
  const regions: ProjectRegion[] = [
    {
      name: 'stylemuse',
      position: [-15, 0, -10],
      theme: PROJECT_THEMES.stylemuse,
      sessions: 12,
      languages: ['React', 'TypeScript', 'CSS'],
      patterns: ['component-design', 'responsive-layout', 'animations']
    },
    {
      name: 'permitagent',
      position: [15, 0, -10],
      theme: PROJECT_THEMES.permitagent,
      sessions: 8,
      languages: ['Python', 'Node.js', 'API'],
      patterns: ['automation', 'error-handling', 'async-processing']
    },
    {
      name: 'claude-prompter',
      position: [0, 0, 15],
      theme: PROJECT_THEMES['claude-prompter'],
      sessions: 15,
      languages: ['TypeScript', 'React', 'Three.js'],
      patterns: ['meta-learning', 'ai-integration', 'data-visualization']
    }
  ];

  return (
    <>
      {regions.map((region) => (
        <ProjectGate
          key={region.name}
          region={region}
          onClick={() => onRegionSelect(region.name)}
          active={activeRegion === region.name}
        />
      ))}
      
      {/* Central Hub Indicator */}
      <Text
        position={[0, -8, 0]}
        fontSize={0.6}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        🌌 LEARNING GALAXY HUB 🌌
      </Text>
      <Text
        position={[0, -9, 0]}
        fontSize={0.3}
        color="#cccccc"
        anchorX="center"
        anchorY="middle"
        maxWidth={8}
      >
        Navigate to different project regions to explore your learning journey
      </Text>
    </>
  );
};