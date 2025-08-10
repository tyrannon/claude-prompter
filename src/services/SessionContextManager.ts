import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ProjectAnalyzer, ProjectContext } from './ProjectAnalyzer';

export interface ConversationEntry {
  id: string;
  timestamp: Date;
  userInput: string;
  aiResponse: string;
  model: string;
  context: {
    workingDirectory: string;
    projectContext?: ProjectContext;
    recentFiles?: string[];
    gitBranch?: string;
    command?: string;
  };
  metadata: {
    complexity?: 'simple' | 'moderate' | 'complex';
    taskType?: string;
    language?: string;
    success: boolean;
    errorMessage?: string;
  };
}

export interface SessionContext {
  sessionId: string;
  created: Date;
  lastAccessed: Date;
  projectPath: string;
  projectContext?: ProjectContext;
  conversationHistory: ConversationEntry[];
  persistentMemory: {
    userPreferences: UserPreferences;
    learningPatterns: LearningPattern[];
    frequentTopics: TopicFrequency[];
    codePatterns: CodePattern[];
  };
  totalTokensUsed: number;
  totalCost: number;
}

export interface UserPreferences {
  preferredComplexity: 'simple' | 'moderate' | 'complex';
  preferredLanguages: string[];
  preferredFrameworks: string[];
  communicationStyle: 'concise' | 'detailed' | 'technical';
  autoSuggest: boolean;
  rememberContext: boolean;
  maxContextHistory: number;
}

export interface LearningPattern {
  pattern: string;
  frequency: number;
  successRate: number;
  lastUsed: Date;
  contexts: string[];
  effectiveness: number; // 0-1 score
}

export interface TopicFrequency {
  topic: string;
  count: number;
  lastMentioned: Date;
  relatedTopics: string[];
  expertise: 'beginner' | 'intermediate' | 'advanced';
}

export interface CodePattern {
  pattern: string;
  language: string;
  frequency: number;
  complexity: 'simple' | 'moderate' | 'complex';
  lastUsed: Date;
  examples: string[];
  successfulImplementations: number;
}

/**
 * SessionContextManager - Advanced context persistence and learning system
 * Provides intelligent memory and learning capabilities for claude-prompter
 */
export class SessionContextManager {
  private sessionsDir: string;
  private currentSession?: SessionContext;
  private projectAnalyzer: ProjectAnalyzer;
  private memoryCache: Map<string, SessionContext> = new Map();
  private autoSaveInterval?: NodeJS.Timeout;

  constructor(baseDir: string = '.claude-prompter') {
    this.sessionsDir = path.join(process.cwd(), baseDir, 'sessions');
    this.projectAnalyzer = new ProjectAnalyzer();
    this.ensureDirectoryExists();
  }

  /**
   * Initialize or resume a session for the current project
   */
  async initializeSession(projectPath?: string): Promise<SessionContext> {
    const workingPath = projectPath || process.cwd();
    
    // Check for existing session in this project
    const existingSession = await this.findExistingSession(workingPath);
    
    if (existingSession) {
      this.currentSession = existingSession;
      this.currentSession.lastAccessed = new Date();
      await this.saveSession(this.currentSession);
      return this.currentSession;
    }
    
    // Create new session
    const projectContext = await this.projectAnalyzer.analyzeProject();
    
    const newSession: SessionContext = {
      sessionId: uuidv4(),
      created: new Date(),
      lastAccessed: new Date(),
      projectPath: workingPath,
      projectContext,
      conversationHistory: [],
      persistentMemory: {
        userPreferences: this.getDefaultPreferences(),
        learningPatterns: [],
        frequentTopics: [],
        codePatterns: []
      },
      totalTokensUsed: 0,
      totalCost: 0
    };
    
    this.currentSession = newSession;
    await this.saveSession(newSession);
    this.startAutoSave();
    
    return newSession;
  }

  /**
   * Add a conversation entry to the current session
   */
  async addConversation(
    userInput: string,
    aiResponse: string,
    model: string,
    metadata: Partial<ConversationEntry['metadata']> = {}
  ): Promise<void> {
    if (!this.currentSession) {
      await this.initializeSession();
    }

    const projectContext = await this.projectAnalyzer.analyzeProject();
    const recentFiles = await this.projectAnalyzer.getRecentChangedFiles(5);
    
    const entry: ConversationEntry = {
      id: uuidv4(),
      timestamp: new Date(),
      userInput,
      aiResponse,
      model,
      context: {
        workingDirectory: process.cwd(),
        projectContext,
        recentFiles,
        gitBranch: projectContext.gitStatus?.branch
      },
      metadata: {
        success: true,
        ...metadata
      }
    };

    this.currentSession!.conversationHistory.push(entry);
    this.currentSession!.lastAccessed = new Date();
    
    // Update learning patterns
    await this.updateLearningPatterns(entry);
    
    // Auto-save
    await this.saveSession(this.currentSession!);
  }

  /**
   * Get contextual suggestions based on current session and learning patterns
   */
  async getContextualSuggestions(limit: number = 5): Promise<string[]> {
    if (!this.currentSession) return [];
    
    const suggestions: string[] = [];
    const { persistentMemory, conversationHistory } = this.currentSession;
    
    // Recent context suggestions
    if (conversationHistory.length > 0) {
      const recentEntry = conversationHistory[conversationHistory.length - 1];
      const recentTopics = this.extractTopicsFromText(recentEntry.userInput);
      
      for (const topic of recentTopics) {
        const relatedPattern = persistentMemory.learningPatterns.find(p => 
          p.pattern.toLowerCase().includes(topic.toLowerCase()) && p.effectiveness > 0.7
        );
        
        if (relatedPattern) {
          suggestions.push(`Continue exploring ${topic} - you've had ${relatedPattern.frequency} successful interactions with this`);
        }
      }
    }
    
    // Learning-based suggestions
    const topPatterns = persistentMemory.learningPatterns
      .sort((a, b) => (b.effectiveness * b.frequency) - (a.effectiveness * a.frequency))
      .slice(0, 3);
    
    for (const pattern of topPatterns) {
      if (suggestions.length < limit) {
        suggestions.push(`Based on your ${pattern.frequency} successful uses: ${pattern.pattern}`);
      }
    }
    
    // Project-specific suggestions
    if (this.currentSession.projectContext) {
      const { projectContext } = this.currentSession;
      
      if (projectContext.type === 'react-native' && projectContext.domain === 'fashion') {
        suggestions.push('Consider implementing style variation components for fashion items');
        suggestions.push('Add image optimization for fashion product displays');
      } else if (projectContext.type === 'nodejs' && projectContext.frameworks.includes('express')) {
        suggestions.push('Review API rate limiting and security middleware');
        suggestions.push('Consider adding request logging and monitoring');
      }
    }
    
    return suggestions.slice(0, limit);
  }

  /**
   * Get conversation context for AI interactions
   */
  getConversationContext(maxEntries: number = 5): string {
    if (!this.currentSession || this.currentSession.conversationHistory.length === 0) {
      return '';
    }
    
    const recentEntries = this.currentSession.conversationHistory.slice(-maxEntries);
    
    let context = 'Previous conversation context:\n';
    
    recentEntries.forEach((entry, index) => {
      context += `\n${index + 1}. User: ${entry.userInput}\n`;
      context += `   AI: ${entry.aiResponse.substring(0, 200)}${entry.aiResponse.length > 200 ? '...' : ''}\n`;
    });
    
    // Add project context
    if (this.currentSession.projectContext) {
      const { projectContext } = this.currentSession;
      context += `\nCurrent project: ${projectContext.type} (${projectContext.domain})`;
      context += `\nTech stack: ${projectContext.frameworks.join(', ')}`;
      context += `\nLanguages: ${projectContext.languages.join(', ')}`;
    }
    
    return context;
  }

  /**
   * Update learning patterns based on conversation
   */
  private async updateLearningPatterns(entry: ConversationEntry): Promise<void> {
    if (!this.currentSession) return;
    
    const { persistentMemory } = this.currentSession;
    const topics = this.extractTopicsFromText(entry.userInput);
    
    // Update topic frequencies
    for (const topic of topics) {
      let topicEntry = persistentMemory.frequentTopics.find(t => t.topic === topic);
      
      if (topicEntry) {
        topicEntry.count++;
        topicEntry.lastMentioned = new Date();
      } else {
        persistentMemory.frequentTopics.push({
          topic,
          count: 1,
          lastMentioned: new Date(),
          relatedTopics: topics.filter(t => t !== topic),
          expertise: 'beginner'
        });
      }
    }
    
    // Update learning patterns
    const patterns = this.extractPatternsFromConversation(entry);
    
    for (const patternText of patterns) {
      let pattern = persistentMemory.learningPatterns.find(p => p.pattern === patternText);
      
      if (pattern) {
        pattern.frequency++;
        pattern.lastUsed = new Date();
        pattern.effectiveness = entry.metadata.success ? 
          Math.min(1.0, pattern.effectiveness + 0.1) : 
          Math.max(0.0, pattern.effectiveness - 0.1);
      } else {
        persistentMemory.learningPatterns.push({
          pattern: patternText,
          frequency: 1,
          successRate: entry.metadata.success ? 1.0 : 0.0,
          lastUsed: new Date(),
          contexts: [entry.context.workingDirectory],
          effectiveness: entry.metadata.success ? 0.8 : 0.3
        });
      }
    }
    
    // Update code patterns if relevant
    if (entry.metadata.language) {
      const codePatterns = this.extractCodePatterns(entry.aiResponse, entry.metadata.language);
      
      for (const codePattern of codePatterns) {
        let pattern = persistentMemory.codePatterns.find(p => 
          p.pattern === codePattern && p.language === entry.metadata.language
        );
        
        if (pattern) {
          pattern.frequency++;
          pattern.lastUsed = new Date();
          if (entry.metadata.success) {
            pattern.successfulImplementations++;
          }
        } else {
          persistentMemory.codePatterns.push({
            pattern: codePattern,
            language: entry.metadata.language,
            frequency: 1,
            complexity: entry.metadata.complexity || 'moderate',
            lastUsed: new Date(),
            examples: [entry.aiResponse.substring(0, 500)],
            successfulImplementations: entry.metadata.success ? 1 : 0
          });
        }
      }
    }
    
    // Update user preferences based on usage
    this.updatePreferences(entry);
  }

  /**
   * Update user preferences based on interaction patterns
   */
  private updatePreferences(entry: ConversationEntry): void {
    if (!this.currentSession) return;
    
    const { userPreferences } = this.currentSession.persistentMemory;
    
    // Update preferred complexity
    if (entry.metadata.complexity && entry.metadata.success) {
      userPreferences.preferredComplexity = entry.metadata.complexity;
    }
    
    // Update preferred languages
    if (entry.metadata.language) {
      if (!userPreferences.preferredLanguages.includes(entry.metadata.language)) {
        userPreferences.preferredLanguages.push(entry.metadata.language);
      }
    }
    
    // Update frameworks from project context
    if (entry.context.projectContext?.frameworks) {
      for (const framework of entry.context.projectContext.frameworks) {
        if (!userPreferences.preferredFrameworks.includes(framework)) {
          userPreferences.preferredFrameworks.push(framework);
        }
      }
    }
  }

  /**
   * Find existing session for a project path
   */
  private async findExistingSession(projectPath: string): Promise<SessionContext | null> {
    try {
      const sessionFiles = await fs.readdir(this.sessionsDir);
      
      for (const file of sessionFiles) {
        if (file.endsWith('.json')) {
          const sessionPath = path.join(this.sessionsDir, file);
          const sessionData = JSON.parse(await fs.readFile(sessionPath, 'utf-8'));
          
          if (sessionData.projectPath === projectPath) {
            // Deserialize dates
            sessionData.created = new Date(sessionData.created);
            sessionData.lastAccessed = new Date(sessionData.lastAccessed);
            sessionData.conversationHistory.forEach((entry: any) => {
              entry.timestamp = new Date(entry.timestamp);
            });
            
            return sessionData;
          }
        }
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save session to disk
   */
  private async saveSession(session: SessionContext): Promise<void> {
    try {
      await this.ensureDirectoryExists();
      const sessionPath = path.join(this.sessionsDir, `${session.sessionId}.json`);
      await fs.writeFile(sessionPath, JSON.stringify(session, null, 2), 'utf-8');
      
      // Cache in memory
      this.memoryCache.set(session.sessionId, session);
    } catch (error) {
      console.warn(`Failed to save session: ${error}`);
    }
  }

  /**
   * Extract topics from user input text
   */
  private extractTopicsFromText(text: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const keywords = text.toLowerCase()
      .split(/\s+/)
      .filter(word => 
        word.length > 4 && 
        !['with', 'that', 'this', 'from', 'have', 'will', 'would', 'could', 'should'].includes(word)
      )
      .slice(0, 5);
    
    return keywords;
  }

  /**
   * Extract patterns from conversation
   */
  private extractPatternsFromConversation(entry: ConversationEntry): string[] {
    const patterns: string[] = [];
    
    // Extract question patterns
    if (entry.userInput.startsWith('How')) {
      patterns.push('how-to questions');
    } else if (entry.userInput.includes('implement')) {
      patterns.push('implementation requests');
    } else if (entry.userInput.includes('debug') || entry.userInput.includes('fix')) {
      patterns.push('debugging assistance');
    } else if (entry.userInput.includes('optimize')) {
      patterns.push('optimization requests');
    }
    
    // Extract task type patterns
    if (entry.metadata.taskType) {
      patterns.push(`${entry.metadata.taskType} tasks`);
    }
    
    return patterns;
  }

  /**
   * Extract code patterns from AI response
   */
  private extractCodePatterns(response: string, language: string): string[] {
    const patterns: string[] = [];
    
    if (language === 'typescript' || language === 'javascript') {
      if (response.includes('async') && response.includes('await')) {
        patterns.push('async-await');
      }
      if (response.includes('interface') || response.includes('type ')) {
        patterns.push('typescript-types');
      }
      if (response.includes('useState') || response.includes('useEffect')) {
        patterns.push('react-hooks');
      }
      if (response.includes('try') && response.includes('catch')) {
        patterns.push('error-handling');
      }
    }
    
    if (language === 'python') {
      if (response.includes('def ') && response.includes('async def')) {
        patterns.push('async-functions');
      }
      if (response.includes('class ')) {
        patterns.push('class-definitions');
      }
    }
    
    return patterns;
  }

  /**
   * Get default user preferences
   */
  private getDefaultPreferences(): UserPreferences {
    return {
      preferredComplexity: 'moderate',
      preferredLanguages: [],
      preferredFrameworks: [],
      communicationStyle: 'detailed',
      autoSuggest: true,
      rememberContext: true,
      maxContextHistory: 10
    };
  }

  /**
   * Ensure sessions directory exists
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.sessionsDir, { recursive: true });
    } catch (error) {
      // Directory already exists
    }
  }

  /**
   * Start auto-save interval
   */
  private startAutoSave(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    
    this.autoSaveInterval = setInterval(() => {
      if (this.currentSession) {
        this.saveSession(this.currentSession);
      }
    }, 30000); // Save every 30 seconds
  }

  /**
   * Get current session
   */
  getCurrentSession(): SessionContext | undefined {
    return this.currentSession;
  }

  /**
   * Clear current session (but keep on disk)
   */
  clearCurrentSession(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.currentSession = undefined;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    this.memoryCache.clear();
  }
}