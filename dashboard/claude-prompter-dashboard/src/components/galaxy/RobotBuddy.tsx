import React, { useRef, useState, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Sphere, Cylinder } from '@react-three/drei';
import * as THREE from 'three';

const RobotBuddy: React.FC = () => {
  const robotRef = useRef<THREE.Group>(null);
  const eyeLeftRef = useRef<THREE.Mesh>(null);
  const eyeRightRef = useRef<THREE.Mesh>(null);
  const [isWaving, setIsWaving] = useState(false);
  const [eyeColor, setEyeColor] = useState('#00ffff');
  const [, setMessage] = useState('Hello, space explorer! 🚀');

  // Robot movement and animations
  useFrame((state) => {
    if (robotRef.current) {
      // Gentle floating motion
      robotRef.current.position.y = 2 + Math.sin(state.clock.elapsedTime * 2) * 0.2;
      robotRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.3;
      
      // Gentle rotation to look around
      robotRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.2;
    }

    // Eye animations - make them blink occasionally
    if (Math.random() < 0.002) { // Random blink
      if (eyeLeftRef.current && eyeRightRef.current) {
        eyeLeftRef.current.scale.y = 0.1;
        eyeRightRef.current.scale.y = 0.1;
        setTimeout(() => {
          if (eyeLeftRef.current && eyeRightRef.current) {
            eyeLeftRef.current.scale.y = 1;
            eyeRightRef.current.scale.y = 1;
          }
        }, 100);
      }
    }
  });

  // Random encouraging messages
  const messages = useMemo(() => [
    "Great progress! 🌟",
    "Keep exploring! 🚀",
    "You're doing amazing! ✨",
    "Ready for the next adventure? 🌌",
    "Learning looks good on you! 🤖",
    "To infinity and beyond! 🌠"
  ], []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessage(messages[Math.floor(Math.random() * messages.length)]);
      setEyeColor(Math.random() > 0.5 ? '#00ffff' : '#ff6b6b');
    }, 5000);

    return () => clearInterval(interval);
  }, [messages]);

  const handleClick = () => {
    setIsWaving(true);
    setEyeColor('#ffff00');
    setMessage("Hello there! Click on planets to explore! 👋");
    
    // More interactive feedback
    setTimeout(() => {
      setIsWaving(false);
      setEyeColor('#00ffff');
      setMessage("I'm Galexie, your learning companion! 🤖✨");
    }, 2000);
    
    setTimeout(() => {
      setMessage("Ready for another adventure? 🚀");
    }, 4000);
  };

  return (
    <>
      <group 
        ref={robotRef} 
        position={[3, 2, 3]}
        onClick={handleClick}
        onPointerOver={() => setEyeColor('#ffff00')}
        onPointerOut={() => setEyeColor('#00ffff')}
      >
        {/* Robot Body */}
        <Box args={[0.8, 1, 0.6]} position={[0, 0, 0]}>
          <meshStandardMaterial 
            color="#00bfff" 
            emissive="#0080ff"
            emissiveIntensity={0.3}
            metalness={0.8} 
            roughness={0.1} 
          />
        </Box>

        {/* Robot Head */}
        <Box args={[0.6, 0.6, 0.6]} position={[0, 0.8, 0]}>
          <meshStandardMaterial 
            color="#00d4ff" 
            emissive="#0099ff"
            emissiveIntensity={0.4}
            metalness={0.8} 
            roughness={0.1} 
          />
        </Box>

        {/* Eyes */}
        <Sphere ref={eyeLeftRef} args={[0.08]} position={[-0.15, 0.85, 0.25]}>
          <meshStandardMaterial 
            color={eyeColor} 
            emissive={eyeColor}
            emissiveIntensity={0.8}
          />
        </Sphere>
        <Sphere ref={eyeRightRef} args={[0.08]} position={[0.15, 0.85, 0.25]}>
          <meshStandardMaterial 
            color={eyeColor} 
            emissive={eyeColor}
            emissiveIntensity={0.8}
          />
        </Sphere>

        {/* Antenna */}
        <Cylinder args={[0.02, 0.02, 0.3]} position={[0, 1.25, 0]}>
          <meshStandardMaterial 
            color="#ff3366" 
            emissive="#ff1144"
            emissiveIntensity={0.5}
          />
        </Cylinder>
        <Sphere args={[0.05]} position={[0, 1.4, 0]}>
          <meshStandardMaterial 
            color="#ff3366" 
            emissive="#ff1144"
            emissiveIntensity={1.0}
          />
        </Sphere>

        {/* Arms */}
        <Cylinder 
          args={[0.05, 0.05, 0.4]} 
          position={[-0.5, 0.2, 0]}
          rotation={[0, 0, isWaving ? -Math.PI/4 : Math.PI/6]}
        >
          <meshStandardMaterial 
            color="#00bfff" 
            emissive="#0080ff"
            emissiveIntensity={0.2}
          />
        </Cylinder>
        <Cylinder 
          args={[0.05, 0.05, 0.4]} 
          position={[0.5, 0.2, 0]}
          rotation={[0, 0, isWaving ? Math.PI/4 : -Math.PI/6]}
        >
          <meshStandardMaterial 
            color="#00bfff" 
            emissive="#0080ff"
            emissiveIntensity={0.2}
          />
        </Cylinder>

        {/* Hands */}
        <Sphere args={[0.08]} position={[-0.7, 0.0, 0]}>
          <meshStandardMaterial 
            color="#00d4ff" 
            emissive="#0099ff"
            emissiveIntensity={0.3}
          />
        </Sphere>
        <Sphere args={[0.08]} position={[0.7, 0.0, 0]}>
          <meshStandardMaterial 
            color="#00d4ff" 
            emissive="#0099ff"
            emissiveIntensity={0.3}
          />
        </Sphere>

        {/* Legs */}
        <Cylinder args={[0.06, 0.06, 0.5]} position={[-0.2, -0.75, 0]}>
          <meshStandardMaterial color="#4a90e2" />
        </Cylinder>
        <Cylinder args={[0.06, 0.06, 0.5]} position={[0.2, -0.75, 0]}>
          <meshStandardMaterial color="#4a90e2" />
        </Cylinder>

        {/* Feet */}
        <Box args={[0.15, 0.08, 0.25]} position={[-0.2, -1.05, 0]}>
          <meshStandardMaterial color="#5ba3f5" />
        </Box>
        <Box args={[0.15, 0.08, 0.25]} position={[0.2, -1.05, 0]}>
          <meshStandardMaterial color="#5ba3f5" />
        </Box>

        {/* Jetpack */}
        <Cylinder args={[0.15, 0.15, 0.4]} position={[0, 0.2, -0.4]}>
          <meshStandardMaterial color="#ff9800" metalness={0.8} roughness={0.1} />
        </Cylinder>

        {/* Glowing heart/core */}
        <Sphere args={[0.1]} position={[0, 0.1, 0.35]}>
          <meshStandardMaterial 
            color="#ff3366" 
            emissive="#ff1144"
            emissiveIntensity={1.5}
          />
        </Sphere>
      </group>

      {/* Message bubble (HTML overlay would be better, but this works for now) */}
      {/* We'll add this as an HTML overlay later */}
    </>
  );
};

export default RobotBuddy;