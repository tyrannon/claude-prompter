import { Session, ConversationEntry } from '../types/session.types';
import { SessionManager } from '../data/SessionManager';

// Types for context analysis
export interface ContextAnalysis {
  entities: Entity[];
  topics: string[];
  embedding?: number[];
  keywords: string[];
  intent: 'question' | 'command' | 'continuation' | 'clarification';
  codeReferences: CodeReference[];
}

export interface Entity {
  text: string;
  type: 'file' | 'function' | 'variable' | 'concept' | 'technology';
  confidence: number;
}

export interface CodeReference {
  language: string;
  snippet: string;
  purpose: string;
}

export interface ContextRelevance {
  sessionId: string;
  relevanceScore: number;
  matchedTopics: string[];
  sharedEntities: Entity[];
  temporalRelevance: number;
  semanticSimilarity: number;
  userImportance: number;
  snippet: string;
}

export interface SearchOptions {
  threshold?: number;
  maxResults?: number;
  timeRange?: { start: Date; end: Date };
  includeArchived?: boolean;
}

export class ContextAnalyzer {
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  async analyzeCurrentContext(prompt: string): Promise<ContextAnalysis> {
    const entities = this.extractEntities(prompt);
    const topics = this.extractTopics(prompt);
    const keywords = this.extractKeywords(prompt);
    const intent = this.detectIntent(prompt);
    const codeReferences = this.extractCodeReferences(prompt);

    return {
      entities,
      topics,
      keywords,
      intent,
      codeReferences
    };
  }

  async findRelevantSessions(
    analysis: ContextAnalysis, 
    options: SearchOptions = {}
  ): Promise<ContextRelevance[]> {
    const { threshold = 0.7, maxResults = 10 } = options;
    const sessions = await this.sessionManager.getAllSessions();
    
    const relevanceScores: ContextRelevance[] = [];

    for (const session of sessions) {
      if (!session.history || session.history.length === 0) continue;

      const relevance = await this.calculateRelevance(session, analysis);
      
      if (relevance.relevanceScore >= threshold) {
        relevanceScores.push(relevance);
      }
    }

    // Sort by relevance score and return top results
    return relevanceScores
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);
  }

  private extractEntities(text: string): Entity[] {
    const entities: Entity[] = [];
    
    // Extract file paths
    const filePattern = /(?:[\w\-]+\/)*[\w\-]+\.\w+/g;
    const files = text.match(filePattern) || [];
    files.forEach(file => {
      entities.push({ 
        text: file, 
        type: 'file', 
        confidence: 0.9 
      });
    });

    // Extract function/class names (CamelCase or snake_case)
    const functionPattern = /\b([A-Z][a-zA-Z0-9]*|[a-z]+_[a-z_]+)\b/g;
    const functions = text.match(functionPattern) || [];
    functions.forEach(func => {
      if (func.length > 3 && !this.isCommonWord(func)) {
        entities.push({ 
          text: func, 
          type: func[0] === func[0].toUpperCase() ? 'function' : 'variable',
          confidence: 0.7 
        });
      }
    });

    // Extract technology mentions
    const techKeywords = ['React', 'TypeScript', 'Node.js', 'Express', 'MongoDB', 
                         'PostgreSQL', 'Docker', 'AWS', 'API', 'REST', 'GraphQL',
                         'JWT', 'OAuth', 'Redux', 'Next.js', 'Vue', 'Angular'];
    
    techKeywords.forEach(tech => {
      if (text.toLowerCase().includes(tech.toLowerCase())) {
        entities.push({ 
          text: tech, 
          type: 'technology', 
          confidence: 0.95 
        });
      }
    });

    return entities;
  }

  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    
    // Topic patterns
    const topicPatterns = [
      { pattern: /auth(?:entication|orization)/i, topic: 'authentication' },
      { pattern: /error\s+(handl|log|report)/i, topic: 'error-handling' },
      { pattern: /log(?:ging|s)?|monitor|track/i, topic: 'logging' },
      { pattern: /test(?:ing|s)?/i, topic: 'testing' },
      { pattern: /database|db|sql/i, topic: 'database' },
      { pattern: /api|endpoint|route/i, topic: 'api-development' },
      { pattern: /ui|component|frontend/i, topic: 'frontend' },
      { pattern: /deploy|ci\/cd|docker/i, topic: 'deployment' },
      { pattern: /refactor/i, topic: 'refactoring' },
      { pattern: /bug|fix|issue/i, topic: 'debugging' },
      { pattern: /implement|create|build/i, topic: 'implementation' }
    ];

    topicPatterns.forEach(({ pattern, topic }) => {
      if (pattern.test(text)) {
        topics.push(topic);
      }
    });

    return [...new Set(topics)]; // Remove duplicates
  }

  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful keywords
    const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'a', 'an', 
                              'and', 'or', 'but', 'in', 'with', 'to', 'for',
                              'of', 'as', 'by', 'that', 'this', 'it', 'from',
                              'be', 'are', 'was', 'were', 'been']);
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));

    // Count word frequency
    const wordFreq = new Map<string, number>();
    words.forEach(word => {
      wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
    });

    // Return top keywords by frequency
    return Array.from(wordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private detectIntent(text: string): ContextAnalysis['intent'] {
    const questionPatterns = /^(what|how|why|when|where|can|could|should|would|is|are|does|do)\b/i;
    const commandPatterns = /^(create|implement|add|update|fix|refactor|build|make|generate|write)\b/i;
    const clarificationPatterns = /^(actually|but|however|wait|no|yes|exactly|specifically)\b/i;
    
    if (questionPatterns.test(text.trim())) return 'question';
    if (commandPatterns.test(text.trim())) return 'command';
    if (clarificationPatterns.test(text.trim())) return 'clarification';
    
    return 'continuation';
  }

  private extractCodeReferences(text: string): CodeReference[] {
    const codeRefs: CodeReference[] = [];
    
    // Extract code blocks
    const codeBlockPattern = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockPattern.exec(text)) !== null) {
      const language = match[1] || 'unknown';
      const snippet = match[2].trim();
      
      codeRefs.push({
        language,
        snippet,
        purpose: this.inferCodePurpose(snippet, language)
      });
    }

    // Extract inline code mentions
    const inlineCodePattern = /`([^`]+)`/g;
    while ((match = inlineCodePattern.exec(text)) !== null) {
      const snippet = match[1];
      if (snippet.length > 3) {
        codeRefs.push({
          language: 'inline',
          snippet,
          purpose: 'reference'
        });
      }
    }

    return codeRefs;
  }

  private inferCodePurpose(snippet: string, _language: string): string {
    const lower = snippet.toLowerCase();
    
    if (lower.includes('test') || lower.includes('describe') || lower.includes('expect')) {
      return 'testing';
    }
    if (lower.includes('error') || lower.includes('catch') || lower.includes('throw')) {
      return 'error-handling';
    }
    if (lower.includes('class') || lower.includes('interface')) {
      return 'definition';
    }
    if (lower.includes('function') || lower.includes('def') || lower.includes('async')) {
      return 'implementation';
    }
    if (lower.includes('import') || lower.includes('require')) {
      return 'setup';
    }
    
    return 'general';
  }

  private async calculateRelevance(
    session: Session, 
    analysis: ContextAnalysis
  ): Promise<ContextRelevance> {
    const matchedTopics: string[] = [];
    const sharedEntities: Entity[] = [];
    let topicScore = 0;
    let entityScore = 0;
    let keywordScore = 0;

    // Analyze all conversation entries
    const allText = session.history
      .map(entry => `${entry.prompt} ${entry.response}`)
      .join(' ');

    // Topic matching
    analysis.topics.forEach(topic => {
      if (allText.toLowerCase().includes(topic)) {
        matchedTopics.push(topic);
        topicScore += 0.2;
      }
    });

    // Entity matching
    analysis.entities.forEach(entity => {
      if (allText.includes(entity.text)) {
        sharedEntities.push(entity);
        entityScore += entity.confidence * 0.1;
      }
    });

    // Keyword matching
    const sessionKeywords = this.extractKeywords(allText);
    const commonKeywords = analysis.keywords.filter(kw => 
      sessionKeywords.includes(kw)
    );
    keywordScore = (commonKeywords.length / Math.max(analysis.keywords.length, 1)) * 0.3;

    // Temporal relevance (decay over time)
    const lastEntry = session.history[session.history.length - 1];
    const daysSince = (Date.now() - new Date(lastEntry.timestamp).getTime()) / (1000 * 60 * 60 * 24);
    const temporalRelevance = Math.max(0, 1 - (daysSince / 30)); // Decay over 30 days

    // Code similarity (if both have code)
    let codeSimilarity = 0;
    if (analysis.codeReferences.length > 0) {
      const sessionCode = this.extractCodeReferences(allText);
      if (sessionCode.length > 0) {
        const commonLanguages = analysis.codeReferences
          .filter(ref => sessionCode.some(sc => sc.language === ref.language));
        codeSimilarity = (commonLanguages.length / analysis.codeReferences.length) * 0.2;
      }
    }

    // Calculate final relevance score
    const relevanceScore = Math.min(1, 
      topicScore + 
      entityScore + 
      keywordScore + 
      codeSimilarity + 
      (temporalRelevance * 0.1)
    );

    // Extract snippet from most relevant entry
    const snippet = this.extractRelevantSnippet(session, analysis);

    return {
      sessionId: session.metadata.sessionId,
      relevanceScore,
      matchedTopics,
      sharedEntities,
      temporalRelevance,
      semanticSimilarity: keywordScore, // Simplified for now
      userImportance: 0.5, // Default importance
      snippet
    };
  }

  private extractRelevantSnippet(session: Session, analysis: ContextAnalysis): string {
    // Find the most relevant conversation entry
    let bestEntry: ConversationEntry | null = null;
    let bestScore = 0;

    for (const entry of session.history) {
      const text = `${entry.prompt} ${entry.response}`;
      let score = 0;

      // Score based on keyword matches
      analysis.keywords.forEach(keyword => {
        if (text.toLowerCase().includes(keyword.toLowerCase())) {
          score += 1;
        }
      });

      if (score > bestScore) {
        bestScore = score;
        bestEntry = entry;
      }
    }

    if (bestEntry) {
      // Extract a meaningful snippet
      const text = bestEntry.response || bestEntry.prompt;
      const maxLength = 200;
      
      if (text.length <= maxLength) return text;
      
      // Try to find a keyword and extract around it
      for (const keyword of analysis.keywords) {
        const index = text.toLowerCase().indexOf(keyword.toLowerCase());
        if (index !== -1) {
          const start = Math.max(0, index - 50);
          const end = Math.min(text.length, index + 150);
          return '...' + text.substring(start, end) + '...';
        }
      }
      
      // Fallback to beginning
      return text.substring(0, maxLength) + '...';
    }

    return 'No relevant snippet found';
  }

  private isCommonWord(word: string): boolean {
    const common = ['data', 'user', 'item', 'value', 'result', 'error', 
                   'message', 'status', 'type', 'name', 'config'];
    return common.includes(word.toLowerCase());
  }
}