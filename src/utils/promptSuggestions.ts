import chalk from 'chalk';
import { 
  getPersonality, 
  formatWithPersonality, 
  transformSuggestionWithPersonality,
  transformCategoryWithPersonality,
  getAllMightLearningLevelTitle,
  getRandomPhrase
} from './personalitySystem';

export interface PromptSuggestion {
  id: string;
  title: string;
  prompt: string;
  context?: string;
  category: 'follow-up' | 'clarification' | 'deep-dive' | 'alternative' | 'implementation';
  rationale: string;
}

export interface ConversationContext {
  topic: string;
  lastResponse?: string;
  techStack?: string[];
  currentTask?: string;
  userGoal?: string;
}

/**
 * Generate intelligent prompt suggestions based on conversation context
 */
export function generatePromptSuggestions(context: ConversationContext): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  
  // Follow-up suggestions
  if (context.lastResponse) {
    suggestions.push({
      id: 'follow-1',
      title: 'Request Implementation Details',
      prompt: `Can you provide the complete implementation for the ${context.topic} we just discussed?`,
      category: 'follow-up',
      rationale: 'Get practical code implementation'
    });
    
    suggestions.push({
      id: 'follow-2',
      title: 'Ask for Error Handling',
      prompt: `How should I handle errors and edge cases in this ${context.topic} implementation?`,
      category: 'follow-up',
      rationale: 'Ensure robust error handling'
    });
  }
  
  // Clarification suggestions
  suggestions.push({
    id: 'clarify-1',
    title: 'Explain Technical Concepts',
    prompt: `Can you explain the key concepts behind ${context.topic} in simpler terms?`,
    category: 'clarification',
    rationale: 'Better understand the fundamentals'
  });
  
  suggestions.push({
    id: 'clarify-2',
    title: 'Compare Alternatives',
    prompt: `What are the pros and cons of this approach vs alternative solutions for ${context.topic}?`,
    category: 'clarification',
    rationale: 'Evaluate different approaches'
  });
  
  // Deep-dive suggestions
  if (context.techStack && context.techStack.length > 0) {
    suggestions.push({
      id: 'deep-1',
      title: 'Performance Optimization',
      prompt: `How can I optimize the performance of this ${context.topic} implementation using ${context.techStack.join(', ')}?`,
      category: 'deep-dive',
      rationale: 'Improve performance and efficiency'
    });
    
    suggestions.push({
      id: 'deep-2',
      title: 'Best Practices Guide',
      prompt: `What are the best practices for implementing ${context.topic} with ${context.techStack[0]}?`,
      category: 'deep-dive',
      rationale: 'Follow industry standards'
    });
  }
  
  // Alternative approach suggestions
  suggestions.push({
    id: 'alt-1',
    title: 'Different Implementation',
    prompt: `Can you show me a different way to implement ${context.topic}?`,
    category: 'alternative',
    rationale: 'Explore alternative solutions'
  });
  
  // Implementation suggestions
  if (context.currentTask) {
    suggestions.push({
      id: 'impl-1',
      title: 'Step-by-Step Guide',
      prompt: `Can you provide a step-by-step guide to implement ${context.currentTask}?`,
      category: 'implementation',
      rationale: 'Get detailed implementation steps'
    });
    
    suggestions.push({
      id: 'impl-2',
      title: 'Testing Strategy',
      prompt: `What tests should I write for ${context.currentTask}?`,
      category: 'implementation',
      rationale: 'Ensure code quality with tests'
    });
  }
  
  return suggestions;
}

/**
 * Generate prompt suggestions for specific code output
 */
export function generateCodePromptSuggestions(
  codeType: string,
  language: string,
  features: string[]
): PromptSuggestion[] {
  return [
    {
      id: 'code-1',
      title: 'Add Error Handling',
      prompt: `Add comprehensive error handling to the ${codeType} code, including try-catch blocks and user-friendly error messages`,
      category: 'implementation',
      rationale: 'Make the code production-ready'
    },
    {
      id: 'code-2',
      title: 'Write Unit Tests',
      prompt: `Write unit tests for the ${codeType} using ${language === 'typescript' ? 'Jest' : 'appropriate testing framework'}`,
      category: 'implementation',
      rationale: 'Ensure code reliability'
    },
    {
      id: 'code-3',
      title: 'Add Documentation',
      prompt: `Add comprehensive JSDoc/comments to the ${codeType} code explaining each function and its parameters`,
      category: 'implementation',
      rationale: 'Improve code maintainability'
    },
    {
      id: 'code-4',
      title: 'Optimize Performance',
      prompt: `Optimize the ${codeType} for better performance, focusing on ${features.join(', ')}`,
      category: 'deep-dive',
      rationale: 'Improve efficiency'
    },
    {
      id: 'code-5',
      title: 'Add Type Safety',
      prompt: `Enhance type safety in the ${codeType} with stricter TypeScript types and runtime validation`,
      category: 'implementation',
      rationale: 'Prevent runtime errors'
    }
  ];
}

/**
 * Format suggestions for CLI display
 */
export function formatSuggestionsForCLI(suggestions: PromptSuggestion[]): string {
  const personality = getPersonality();
  const grouped = suggestions.reduce((acc, sug) => {
    if (!acc[sug.category]) acc[sug.category] = [];
    acc[sug.category].push(sug);
    return acc;
  }, {} as Record<string, PromptSuggestion[]>);
  
  let output = '';
  
  // Add personality-specific intro
  if (personality.mode === 'allmight') {
    output = `\n${formatWithPersonality(getRandomPhrase('suggestionIntros'), 'title')}\n\n`;
  }
  
  const categoryEmojis = {
    'follow-up': personality.mode === 'allmight' ? '💪' : '🔄',
    'clarification': personality.mode === 'allmight' ? '🎓' : '❓',
    'deep-dive': personality.mode === 'allmight' ? '🔥' : '🔍',
    'alternative': personality.mode === 'allmight' ? '⚡' : '🔀',
    'implementation': personality.mode === 'allmight' ? '🦸' : '🛠️'
  };
  
  const categoryTitles = {
    'follow-up': 'Follow-up Questions',
    'clarification': 'Clarification',
    'deep-dive': 'Deep Dive',
    'alternative': 'Alternative Approaches',
    'implementation': 'Implementation Help'
  };
  
  Object.entries(grouped).forEach(([category, sugs]) => {
    const emoji = categoryEmojis[category as keyof typeof categoryEmojis];
    const title = transformCategoryWithPersonality(categoryTitles[category as keyof typeof categoryTitles]);
    
    output += `\n${emoji} ${formatWithPersonality(title, 'emphasis')}\n${'─'.repeat(50)}\n`;
    
    sugs.forEach((sug, index) => {
      const transformedTitle = transformSuggestionWithPersonality(sug.title);
      output += `${index + 1}. ${personality.mode === 'allmight' ? chalk.bold.white(transformedTitle) : transformedTitle}\n`;
      output += `   ${sug.prompt}\n`;
      
      // Transform rationale for All Might mode
      const rationale = personality.mode === 'allmight' 
        ? `⚡ HERO TIP: ${sug.rationale.toUpperCase()}`
        : `💡 ${sug.rationale}`;
      output += `   ${rationale}\n\n`;
    });
  });
  
  // Add personality-specific outro
  if (personality.mode === 'allmight') {
    output += `\n${formatWithPersonality('REMEMBER: GO BEYOND! PLUS ULTRA! 🔥💪', 'success')}\n`;
  }
  
  return output;
}

/**
 * Learning-informed suggestion context
 */
export interface LearningContext {
  previousTopics: string[];
  commonPatterns: Array<{ pattern: string; frequency: number; category: string; success?: boolean }>;
  userPreferences: {
    preferredComplexity?: 'simple' | 'moderate' | 'complex';
    preferredCategories?: string[];
    commonLanguages?: string[];
  };
  sessionCount: number;
  growthAreas?: string[];
}

/**
 * Generate prompt suggestions based on Claude's analysis
 */
export function generateClaudePromptSuggestions(
  topic: string,
  analysis: {
    codeGenerated?: boolean;
    language?: string;
    features?: string[];
    complexity?: 'simple' | 'moderate' | 'complex';
    taskType?: string;
  }
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  
  // If code was generated
  if (analysis.codeGenerated && analysis.language) {
    suggestions.push(...generateCodePromptSuggestions(
      topic,
      analysis.language,
      analysis.features || []
    ));
  }
  
  // Based on complexity
  if (analysis.complexity === 'complex') {
    suggestions.push({
      id: 'complex-1',
      title: 'Break Down Complexity',
      prompt: `Can you break down the ${topic} into smaller, manageable components?`,
      category: 'clarification',
      rationale: 'Simplify complex implementation'
    });
    
    suggestions.push({
      id: 'complex-2',
      title: 'Architecture Diagram',
      prompt: `Can you create an architecture diagram or flow chart for the ${topic} implementation?`,
      category: 'clarification',
      rationale: 'Visualize the system design'
    });
  }
  
  // Task-specific suggestions
  if (analysis.taskType) {
    switch (analysis.taskType) {
      case 'api-integration':
        suggestions.push({
          id: 'api-1',
          title: 'API Error Handling',
          prompt: `How should I handle API rate limits and network errors in the ${topic}?`,
          category: 'implementation',
          rationale: 'Build resilient API integration'
        });
        break;
        
      case 'ui-component':
        suggestions.push({
          id: 'ui-1',
          title: 'Accessibility Features',
          prompt: `How can I make the ${topic} component accessible (ARIA labels, keyboard navigation)?`,
          category: 'implementation',
          rationale: 'Ensure accessibility compliance'
        });
        break;
        
      case 'cli-tool':
        suggestions.push({
          id: 'cli-1',
          title: 'Add More Commands',
          prompt: `What additional commands would be useful for the ${topic} CLI tool?`,
          category: 'alternative',
          rationale: 'Expand CLI functionality'
        });
        break;
    }
  }
  
  // Always include these universal suggestions
  suggestions.push({
    id: 'universal-1',
    title: 'Real-World Example',
    prompt: `Can you show me a real-world example of ${topic} in production use?`,
    category: 'deep-dive',
    rationale: 'See practical applications'
  });
  
  suggestions.push({
    id: 'universal-2',
    title: 'Common Pitfalls',
    prompt: `What are common mistakes to avoid when implementing ${topic}?`,
    category: 'clarification',
    rationale: 'Avoid common errors'
  });
  
  return suggestions;
}

/**
 * Generate learning-informed prompt suggestions that show growth across sessions
 */
export function generateLearningAwareSuggestions(
  topic: string,
  analysis: {
    codeGenerated?: boolean;
    language?: string;
    features?: string[];
    complexity?: 'simple' | 'moderate' | 'complex';
    taskType?: string;
  },
  learningContext?: LearningContext
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  
  // If no learning context, fall back to standard suggestions
  if (!learningContext) {
    return generateClaudePromptSuggestions(topic, analysis);
  }
  
  // 🎯 GROWTH-BASED CATEGORY: Level Up from Previous Work
  if (learningContext.previousTopics.length > 0) {
    const relatedTopics = learningContext.previousTopics
      .filter(prev => topic.toLowerCase().includes(prev.toLowerCase()) || prev.toLowerCase().includes(topic.toLowerCase()))
      .slice(0, 3);
    
    if (relatedTopics.length > 0) {
      suggestions.push({
        id: 'growth-1',
        title: `Build on Previous ${relatedTopics[0]} Work`,
        prompt: `Based on our previous discussions about ${relatedTopics.join(', ')}, how can we extend this ${topic} implementation?`,
        category: 'follow-up',
        rationale: `🚀 Building on ${learningContext.sessionCount} previous sessions`
      });
    }
  }
  
  // 🎯 GROWTH-BASED CATEGORY: Pattern Recognition
  if (learningContext.commonPatterns.length > 0) {
    const successfulPatterns = learningContext.commonPatterns
      .filter(p => p.success !== false)
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 2);
    
    if (successfulPatterns.length > 0) {
      suggestions.push({
        id: 'pattern-1',
        title: `Apply Your Favorite Pattern`,
        prompt: `Can you implement ${topic} using the ${successfulPatterns[0].pattern} pattern that we've used successfully ${successfulPatterns[0].frequency} times before?`,
        category: 'alternative',
        rationale: `📈 Leveraging your proven pattern (used ${successfulPatterns[0].frequency}x)`
      });
    }
  }
  
  // 🎯 GROWTH-BASED CATEGORY: Skill Progression  
  const currentComplexity = analysis.complexity || 'moderate';
  const nextComplexityMap = { simple: 'moderate', moderate: 'complex', complex: 'advanced' };
  const nextLevel = nextComplexityMap[currentComplexity as keyof typeof nextComplexityMap];
  
  if (learningContext.sessionCount >= 5 && nextLevel) {
    suggestions.push({
      id: 'progression-1',
      title: `Level Up Complexity`,
      prompt: `After ${learningContext.sessionCount} sessions, I'm ready for more advanced concepts. Can you show me ${nextLevel} patterns for ${topic}?`,
      category: 'deep-dive',
      rationale: `💪 Ready for next level after ${learningContext.sessionCount} sessions`
    });
  }
  
  // 🎯 GROWTH-BASED CATEGORY: Gap Filling
  if (learningContext.growthAreas && learningContext.growthAreas.length > 0) {
    const relevantGaps = learningContext.growthAreas
      .filter(gap => topic.toLowerCase().includes(gap.toLowerCase()));
    
    if (relevantGaps.length > 0) {
      suggestions.push({
        id: 'growth-gap-1',
        title: `Address Knowledge Gap`,
        prompt: `I notice I haven't explored ${relevantGaps[0]} much in our previous sessions. How does ${topic} relate to ${relevantGaps[0]}?`,
        category: 'clarification',
        rationale: `🎓 Filling identified knowledge gaps`
      });
    }
  }
  
  // 🎯 GROWTH-BASED CATEGORY: Cross-Session Integration
  if (learningContext.userPreferences.commonLanguages && learningContext.userPreferences.commonLanguages.length > 1) {
    const otherLanguages = learningContext.userPreferences.commonLanguages
      .filter(lang => lang !== analysis.language)
      .slice(0, 2);
    
    if (otherLanguages.length > 0) {
      suggestions.push({
        id: 'integration-1',
        title: `Cross-Language Integration`,
        prompt: `How would this ${topic} implementation differ if we used ${otherLanguages.join(' or ')} instead of ${analysis.language}?`,
        category: 'alternative',
        rationale: `🔄 Leveraging your multi-language experience`
      });
    }
  }
  
  // Always include core suggestions, but prioritize learning-based ones
  const coreSuggestions = generateClaudePromptSuggestions(topic, analysis)
    .slice(0, 3) // Limit core suggestions to make room for learning ones
    .map(s => ({ ...s, rationale: s.rationale + ' (core)' }));
  
  return [...suggestions, ...coreSuggestions];
}

/**
 * Display learning growth information alongside suggestions
 */
export function formatGrowthInfo(learningContext?: LearningContext): string {
  if (!learningContext) return '';
  
  const personality = getPersonality();
  
  if (personality.mode === 'allmight') {
    let growthInfo = formatWithPersonality('\n🦸 HERO ACADEMIA PROGRESS REPORT 🦸\n', 'title');
    growthInfo += chalk.yellow('⚡'.repeat(50)) + '\n';
    
    // Session count and growth - Hero style
    if (learningContext.sessionCount > 0) {
      const heroLevel = getAllMightLearningLevelTitle(learningContext.sessionCount);
      
      growthInfo += `💪 TRAINING SESSIONS COMPLETED: ${formatWithPersonality(learningContext.sessionCount.toString(), 'emphasis')} `;
      growthInfo += `(${formatWithPersonality(heroLevel, 'success')})\n`;
    }
    
    // Topic evolution - Hero style
    if (learningContext.previousTopics.length > 0) {
      const recentTopics = learningContext.previousTopics.slice(-3);
      growthInfo += `🎯 RECENT HERO TRAINING AREAS: ${formatWithPersonality(recentTopics.join(', ').toUpperCase(), 'emphasis')}\n`;
    }
    
    // Pattern mastery - Hero style
    if (learningContext.commonPatterns.length > 0) {
      const masteredPatterns = learningContext.commonPatterns
        .filter(p => p.frequency >= 3)
        .map(p => p.pattern);
      
      if (masteredPatterns.length > 0) {
        growthInfo += `⭐ MASTERED HERO TECHNIQUES: ${formatWithPersonality(masteredPatterns.slice(0, 3).join(', ').toUpperCase(), 'success')}\n`;
      }
    }
    
    // Growth areas - Hero style
    if (learningContext.growthAreas && learningContext.growthAreas.length > 0) {
      growthInfo += `🔥 PLUS ULTRA OPPORTUNITIES: ${formatWithPersonality(learningContext.growthAreas.slice(0, 2).join(', ').toUpperCase(), 'warning')}\n`;
    }
    
    growthInfo += chalk.yellow('⚡'.repeat(50)) + '\n';
    growthInfo += formatWithPersonality(getRandomPhrase('encouragements'), 'success') + '\n';
    
    return growthInfo + '\n';
  }
  
  // Default personality formatting
  let growthInfo = chalk.bold('\n🌱 Learning Journey Progress\n');
  growthInfo += chalk.gray('─'.repeat(40)) + '\n';
  
  // Session count and growth
  if (learningContext.sessionCount > 0) {
    const experienceLevel = learningContext.sessionCount < 5 ? 'Getting Started' 
      : learningContext.sessionCount < 20 ? 'Building Knowledge' 
      : learningContext.sessionCount < 50 ? 'Experienced' 
      : 'Expert Level';
    
    growthInfo += `📊 Sessions Completed: ${chalk.cyan(learningContext.sessionCount.toString())} (${chalk.yellow(experienceLevel)})\n`;
  }
  
  // Topic evolution
  if (learningContext.previousTopics.length > 0) {
    const recentTopics = learningContext.previousTopics.slice(-3);
    growthInfo += `🎯 Recent Focus Areas: ${chalk.green(recentTopics.join(', '))}\n`;
  }
  
  // Pattern mastery
  if (learningContext.commonPatterns.length > 0) {
    const masteredPatterns = learningContext.commonPatterns
      .filter(p => p.frequency >= 3)
      .map(p => p.pattern);
    
    if (masteredPatterns.length > 0) {
      growthInfo += `⭐ Mastered Patterns: ${chalk.blue(masteredPatterns.slice(0, 3).join(', '))}\n`;
    }
  }
  
  // Growth areas
  if (learningContext.growthAreas && learningContext.growthAreas.length > 0) {
    growthInfo += `🚀 Growth Opportunities: ${chalk.magenta(learningContext.growthAreas.slice(0, 2).join(', '))}\n`;
  }
  
  return growthInfo + '\n';
}