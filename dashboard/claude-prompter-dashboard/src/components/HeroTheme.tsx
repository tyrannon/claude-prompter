import React, { createContext, useContext, useState } from 'react';
import './HeroTheme.css';

interface HeroTheme {
  mode: 'default' | 'allmight' | 'deku' | 'endeavor';
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
    success: string;
    warning: string;
    error: string;
  };
  animations: boolean;
  heroRanks: string[];
  catchphrases: string[];
  emojis: {
    strength: string;
    speed: string;
    lightning: string;
    star: string;
    fire: string;
  };
}

const heroThemes: Record<string, HeroTheme> = {
  default: {
    mode: 'default',
    colors: {
      primary: '#3b82f6',
      secondary: '#6b7280',
      accent: '#10b981',
      background: '#111827',
      text: '#f9fafb',
      success: '#059669',
      warning: '#d97706',
      error: '#dc2626'
    },
    animations: false,
    heroRanks: ['Beginner', 'Intermediate', 'Advanced', 'Expert'],
    catchphrases: ['Keep learning!', 'Good progress!', 'Well done!'],
    emojis: {
      strength: '💪',
      speed: '⚡',
      lightning: '⚡',
      star: '⭐',
      fire: '🔥'
    }
  },
  
  allmight: {
    mode: 'allmight',
    colors: {
      primary: '#fbbf24', // All Might's bright yellow
      secondary: '#3b82f6', // Hero blue
      accent: '#ef4444', // Power red
      background: '#0f172a', // Dark hero background
      text: '#fbbf24',
      success: '#22c55e',
      warning: '#f59e0b',
      error: '#ef4444'
    },
    animations: true,
    heroRanks: [
      'ASPIRING HERO (U.A. STUDENT)',
      'HERO IN TRAINING (PROVISIONAL LICENSE)', 
      'PRO HERO (RISING RANKS)',
      'TOP HERO (SYMBOL OF CODING)',
      'LEGENDARY HERO (ONE FOR ALL INHERITOR)'
    ],
    catchphrases: [
      'I AM HERE!',
      'PLUS ULTRA!',
      'GO BEYOND!',
      'FEAR NOT!',
      'IT\'S FINE NOW!',
      'SMASH!',
      'UNITED STATES OF SMASH!',
      'YOU\'RE NEXT!'
    ],
    emojis: {
      strength: '💪',
      speed: '⚡',
      lightning: '⚡',
      star: '✨',
      fire: '🔥'
    }
  },
  
  deku: {
    mode: 'deku',
    colors: {
      primary: '#22c55e', // Deku's green
      secondary: '#1f2937',
      accent: '#fbbf24',
      background: '#111827',
      text: '#f3f4f6',
      success: '#16a34a',
      warning: '#ca8a04',
      error: '#dc2626'
    },
    animations: true,
    heroRanks: [
      'QUIRKLESS DREAMER',
      'ONE FOR ALL SUCCESSOR',
      'U.A. FIRST YEAR',
      'RISING HERO DEKU',
      'SYMBOL OF HOPE'
    ],
    catchphrases: [
      'I can do it!',
      'One For All: Full Cowl!',
      'Detroit... SMASH!',
      'Everyone gave me this power!',
      'I\'ll save everyone!'
    ],
    emojis: {
      strength: '💚',
      speed: '💨',
      lightning: '⚡',
      star: '🌟',
      fire: '💫'
    }
  }
};

interface HeroThemeContextType {
  currentTheme: HeroTheme;
  setTheme: (themeName: string) => void;
  getHeroRank: (sessionCount: number) => string;
  getRandomCatchphrase: () => string;
  isHeroMode: () => boolean;
}

const HeroThemeContext = createContext<HeroThemeContextType | undefined>(undefined);

export const HeroThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentThemeName, setCurrentThemeName] = useState<string>('default');
  const currentTheme = heroThemes[currentThemeName];

  const setTheme = (themeName: string) => {
    if (heroThemes[themeName]) {
      setCurrentThemeName(themeName);
      // Apply CSS custom properties
      const root = document.documentElement;
      const theme = heroThemes[themeName];
      Object.entries(theme.colors).forEach(([key, value]) => {
        root.style.setProperty(`--hero-${key}`, value);
      });
      
      // Add hero class for animations
      document.body.className = theme.mode === 'default' ? '' : `hero-theme-${theme.mode}`;
    }
  };

  const getHeroRank = (sessionCount: number): string => {
    const ranks = currentTheme.heroRanks;
    if (sessionCount < 5) return ranks[0];
    if (sessionCount < 20) return ranks[1];
    if (sessionCount < 50) return ranks[2];
    if (sessionCount < 100) return ranks[3];
    return ranks[4] || ranks[ranks.length - 1];
  };

  const getRandomCatchphrase = (): string => {
    const phrases = currentTheme.catchphrases;
    return phrases[Math.floor(Math.random() * phrases.length)];
  };

  const isHeroMode = (): boolean => {
    return currentTheme.mode !== 'default';
  };

  // Initialize theme on mount
  React.useEffect(() => {
    setTheme(currentThemeName);
  }, [currentThemeName]);

  return (
    <HeroThemeContext.Provider value={{
      currentTheme,
      setTheme,
      getHeroRank,
      getRandomCatchphrase,
      isHeroMode
    }}>
      {children}
    </HeroThemeContext.Provider>
  );
};

export const useHeroTheme = (): HeroThemeContextType => {
  const context = useContext(HeroThemeContext);
  if (!context) {
    throw new Error('useHeroTheme must be used within a HeroThemeProvider');
  }
  return context;
};

export default HeroThemeProvider;