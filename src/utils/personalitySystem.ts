import chalk from 'chalk';

export type PersonalityMode = 'default' | 'allmight' | 'formal' | 'casual';

export interface PersonalityConfig {
  mode: PersonalityMode;
  greetings: string[];
  encouragements: string[];
  progressPhrases: string[];
  suggestionIntros: string[];
  completionPhrases: string[];
  errorPhrases: string[];
  formatters: {
    title: (text: string) => string;
    emphasis: (text: string) => string;
    success: (text: string) => string;
    warning: (text: string) => string;
  };
}

const personalities: Record<PersonalityMode, PersonalityConfig> = {
  default: {
    mode: 'default',
    greetings: ['Welcome!', 'Hello!', 'Ready to help!'],
    encouragements: ['Great job!', 'Well done!', 'Excellent!'],
    progressPhrases: ['Making progress...', 'Working on it...', 'Processing...'],
    suggestionIntros: ['Here are some suggestions:', 'Consider these options:', 'You might want to try:'],
    completionPhrases: ['Task completed!', 'All done!', 'Finished!'],
    errorPhrases: ['An error occurred:', 'Something went wrong:', 'Issue detected:'],
    formatters: {
      title: (text: string) => chalk.bold(text),
      emphasis: (text: string) => chalk.cyan(text),
      success: (text: string) => chalk.green(text),
      warning: (text: string) => chalk.yellow(text)
    }
  },
  
  allmight: {
    mode: 'allmight',
    greetings: [
      'I AM HERE! 💪',
      'FEAR NOT, YOUNG DEVELOPER! I AM HERE!',
      'HAHAHA! WORRY NOT, FOR I AM HERE TO HELP YOU CODE!',
      'IT\'S FINE NOW. WHY? BECAUSE I AM HERE!'
    ],
    encouragements: [
      'PLUS ULTRA! 🔥',
      'GO BEYOND YOUR LIMITS!',
      'THAT\'S THE SPIRIT OF A TRUE HERO!',
      'YOU\'RE SHOWING REAL HERO POTENTIAL!',
      'AMAZING! YOU\'VE GONE BEYOND!',
      'YOUR CODE SHINES WITH THE POWER OF ONE FOR ALL!'
    ],
    progressPhrases: [
      'CHANNELING THE POWER OF ONE FOR ALL...',
      'DETROIT SMASH-ING THROUGH THIS TASK...',
      'UNITED STATES OF PROCESSING...',
      'GATHERING MY STRENGTH FOR THIS MIGHTY TASK...',
      'TEXAS CODING SMASH IN PROGRESS...'
    ],
    suggestionIntros: [
      'LISTEN WELL, YOUNG HERO! HERE ARE YOUR NEXT TRAINING EXERCISES:',
      'A TRUE HERO ALWAYS HAS OPTIONS! CONSIDER THESE PATHS:',
      'TO GO PLUS ULTRA, YOU MUST CHOOSE YOUR NEXT MOVE WISELY:',
      'THE PATH OF A HERO DEVELOPER OFFERS THESE MIGHTY CHOICES:',
      'REMEMBER, A HERO\'S JOURNEY NEVER ENDS! TRY THESE NEXT:'
    ],
    completionPhrases: [
      'MISSION COMPLETE! PLUS ULTRA! 💪✨',
      'YOU DID IT! A TRUE HERO\'S ACCOMPLISHMENT!',
      'SMASHED IT! THAT\'S WHAT I CALL GOING BEYOND!',
      'VICTORY! YOUR CODE SHINES LIKE A TRUE HERO\'S!',
      'HAHAHA! EXCELLENT WORK, YOUNG DEVELOPER!'
    ],
    errorPhrases: [
      'EVEN HEROES FACE SETBACKS! LET\'S OVERCOME THIS:',
      'A TEMPORARY OBSTACLE! WE\'LL SMASH THROUGH IT:',
      'FEAR NOT! EVERY HERO STUMBLES BEFORE THEY SOAR:',
      'THIS CHALLENGE WILL ONLY MAKE US STRONGER:'
    ],
    formatters: {
      title: (text: string) => chalk.bold.yellow(`⚡ ${text.toUpperCase()} ⚡`),
      emphasis: (text: string) => chalk.bold.cyan(text.toUpperCase()),
      success: (text: string) => chalk.bold.green(`✨ ${text.toUpperCase()} ✨`),
      warning: (text: string) => chalk.bold.red(`⚠️  ${text.toUpperCase()} ⚠️`)
    }
  },
  
  formal: {
    mode: 'formal',
    greetings: ['Greetings.', 'Welcome to claude-prompter.', 'Ready to assist you.'],
    encouragements: ['Excellent work.', 'Task completed successfully.', 'Well executed.'],
    progressPhrases: ['Processing request...', 'Working on task...', 'Analyzing...'],
    suggestionIntros: ['Please consider the following options:', 'Available suggestions:', 'Recommended actions:'],
    completionPhrases: ['Task completed.', 'Process finished.', 'Operation successful.'],
    errorPhrases: ['Error encountered:', 'Issue detected:', 'Problem identified:'],
    formatters: {
      title: (text: string) => chalk.bold.white(text),
      emphasis: (text: string) => chalk.white(text),
      success: (text: string) => chalk.green(text),
      warning: (text: string) => chalk.yellow(text)
    }
  },
  
  casual: {
    mode: 'casual',
    greetings: ['Hey there! 👋', 'What\'s up?', 'Ready to roll!'],
    encouragements: ['Nice! 🎉', 'Sweet!', 'Awesome sauce!', 'You rock!'],
    progressPhrases: ['Working on it...', 'Give me a sec...', 'Processing...'],
    suggestionIntros: ['Check these out:', 'Here\'s what you could try:', 'Some ideas for you:'],
    completionPhrases: ['Done! 🎯', 'All set!', 'Boom! Finished!'],
    errorPhrases: ['Oops! Hit a snag:', 'Uh oh, something\'s off:', 'Hmm, ran into this:'],
    formatters: {
      title: (text: string) => chalk.bold.magenta(text),
      emphasis: (text: string) => chalk.cyan(text),
      success: (text: string) => chalk.green(`✅ ${text}`),
      warning: (text: string) => chalk.yellow(`⚠️  ${text}`)
    }
  }
};

let currentPersonality: PersonalityMode = 'default';

export function setPersonality(mode: PersonalityMode): void {
  if (personalities[mode]) {
    currentPersonality = mode;
  }
}

export function getPersonality(): PersonalityConfig {
  return personalities[currentPersonality];
}

export function getRandomPhrase(phraseType: keyof Omit<PersonalityConfig, 'mode' | 'formatters'>): string {
  const personality = getPersonality();
  const phrases = personality[phraseType];
  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function formatWithPersonality(text: string, formatter: keyof PersonalityConfig['formatters']): string {
  const personality = getPersonality();
  return personality.formatters[formatter](text);
}

export function transformSuggestionWithPersonality(suggestion: string): string {
  const personality = getPersonality();
  
  if (personality.mode === 'allmight') {
    const heroicPrefixes = [
      'HERO TRAINING: ',
      'PLUS ULTRA CHALLENGE: ',
      'MIGHTY TASK: ',
      'HEROIC QUEST: ',
      'POWER-UP MISSION: '
    ];
    
    const prefix = heroicPrefixes[Math.floor(Math.random() * heroicPrefixes.length)];
    return prefix + suggestion;
  }
  
  return suggestion;
}

export function getAllMightLearningLevelTitle(sessionCount: number): string {
  if (sessionCount < 5) return 'ASPIRING HERO (U.A. STUDENT)';
  if (sessionCount < 20) return 'HERO IN TRAINING (PROVISIONAL LICENSE)';
  if (sessionCount < 50) return 'PRO HERO (RISING RANKS)';
  if (sessionCount < 100) return 'TOP HERO (SYMBOL OF CODING)';
  return 'LEGENDARY HERO (ONE FOR ALL INHERITOR)';
}

export function transformCategoryWithPersonality(category: string): string {
  const personality = getPersonality();
  
  if (personality.mode === 'allmight') {
    const categoryMap: Record<string, string> = {
      'follow-up': 'HEROIC FOLLOW-UP TRAINING',
      'clarification': 'HERO KNOWLEDGE QUEST',
      'deep-dive': 'PLUS ULTRA DEEP DIVE',
      'alternative': 'ALTERNATE HERO PATHS',
      'implementation': 'HERO IMPLEMENTATION TRAINING'
    };
    
    return categoryMap[category] || category.toUpperCase();
  }
  
  return category;
}