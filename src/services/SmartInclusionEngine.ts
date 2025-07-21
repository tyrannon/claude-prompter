import { ContextAnalyzer, ContextAnalysis, ContextRelevance } from './ContextAnalyzer';
import { TokenCounter } from '../utils/tokenCounter';
import { Session } from '../types/session.types';
import { SessionManager } from '../data/SessionManager';

export interface AutoContextOptions {
  maxTokens?: number;
  relevanceThreshold?: number;
  includeCodeBlocks?: boolean;
  includeSummaries?: boolean;
  preserveRecent?: number;
  strategy?: 'balanced' | 'aggressive' | 'conservative';
}

export interface ContextSegment {
  sessionId: string;
  content: string;
  tokens: number;
  type: 'primary' | 'secondary' | 'summary';
  relevance: number;
  timestamp: Date;
  metadata: {
    source: string;
    reason: string;
    entities?: string[];
    topics?: string[];
  };
}

export interface AutoContext {
  primary: ContextSegment[];
  secondary: ContextSegment[];
  summary: string;
  metadata: {
    sourceSessions: string[];
    totalTokens: number;
    relevanceScore: number;
    inclusionReasons: string[];
    strategy: string;
  };
}

export class SmartInclusionEngine {
  private contextAnalyzer: ContextAnalyzer;
  private tokenCounter: TokenCounter;
  private sessionManager: SessionManager;

  constructor() {
    this.contextAnalyzer = new ContextAnalyzer();
    this.tokenCounter = new TokenCounter();
    this.sessionManager = new SessionManager();
  }

  async buildAutoContext(
    currentPrompt: string,
    options: AutoContextOptions = {}
  ): Promise<AutoContext> {
    const {
      maxTokens = 20000,
      relevanceThreshold = 0.7,
      strategy = 'balanced'
    } = options;

    // Analyze current context
    const analysis = await this.contextAnalyzer.analyzeCurrentContext(currentPrompt);
    
    // Find relevant sessions
    const relevantSessions = await this.contextAnalyzer.findRelevantSessions(
      analysis,
      { threshold: relevanceThreshold }
    );

    if (relevantSessions.length === 0) {
      return this.createEmptyAutoContext();
    }

    // Build context with token budget
    const contextBuilder = new ContextBuilder(maxTokens, this.tokenCounter);
    
    // Apply inclusion strategy
    const strategyConfig = this.getStrategyConfig(strategy);
    
    // Add primary context (highest relevance)
    const primary = await this.selectPrimaryContext(
      relevantSessions,
      analysis,
      strategyConfig
    );
    
    for (const segment of primary) {
      if (!contextBuilder.canAdd(segment.tokens)) break;
      contextBuilder.addPrimary(segment);
    }
    
    // Add secondary context if space allows
    const secondary = await this.selectSecondaryContext(
      relevantSessions,
      analysis,
      contextBuilder.remainingTokens(),
      strategyConfig
    );
    
    for (const segment of secondary) {
      if (!contextBuilder.canAdd(segment.tokens)) break;
      contextBuilder.addSecondary(segment);
    }
    
    // Generate summary of included context
    const summary = await this.generateContextSummary(
      contextBuilder.getPrimary(),
      contextBuilder.getSecondary(),
      analysis
    );
    
    return contextBuilder.build(summary, strategy);
  }

  private async selectPrimaryContext(
    relevantSessions: ContextRelevance[],
    analysis: ContextAnalysis,
    config: StrategyConfig
  ): Promise<ContextSegment[]> {
    const segments: ContextSegment[] = [];
    const processedSessions = new Set<string>();

    // Take top sessions based on relevance
    const topSessions = relevantSessions.slice(0, config.primarySessionCount);

    for (const relevance of topSessions) {
      if (processedSessions.has(relevance.sessionId)) continue;
      processedSessions.add(relevance.sessionId);

      const session = await this.sessionManager.loadSession(relevance.sessionId);
      if (!session) continue;

      // Extract most relevant parts
      const extractedSegments = await this.extractRelevantSegments(
        session,
        analysis,
        relevance,
        'primary'
      );

      segments.push(...extractedSegments);
    }

    // Sort by relevance and recency
    return segments.sort((a, b) => {
      const relevanceDiff = b.relevance - a.relevance;
      if (Math.abs(relevanceDiff) > 0.1) return relevanceDiff;
      
      // If relevance is similar, prefer more recent
      return b.timestamp.getTime() - a.timestamp.getTime();
    });
  }

  private async selectSecondaryContext(
    relevantSessions: ContextRelevance[],
    analysis: ContextAnalysis,
    remainingTokens: number,
    config: StrategyConfig
  ): Promise<ContextSegment[]> {
    const segments: ContextSegment[] = [];
    const processedSessions = new Set<string>();
    
    // Skip sessions already used for primary context
    const secondarySessions = relevantSessions.slice(
      config.primarySessionCount,
      config.primarySessionCount + config.secondarySessionCount
    );

    for (const relevance of secondarySessions) {
      if (processedSessions.has(relevance.sessionId)) continue;
      processedSessions.add(relevance.sessionId);

      const session = await this.sessionManager.loadSession(relevance.sessionId);
      if (!session) continue;

      // Extract summaries or key points only
      const summarySegment = await this.createSummarySegment(
        session,
        analysis,
        relevance
      );

      if (summarySegment && summarySegment.tokens <= remainingTokens) {
        segments.push(summarySegment);
        remainingTokens -= summarySegment.tokens;
      }
    }

    return segments;
  }

  private async extractRelevantSegments(
    session: Session,
    _analysis: ContextAnalysis,
    relevance: ContextRelevance,
    type: 'primary' | 'secondary'
  ): Promise<ContextSegment[]> {
    const segments: ContextSegment[] = [];

    // Focus on entries that match the current context
    for (const entry of session.history) {
      const entryText = `User: ${entry.prompt}\n\nAssistant: ${entry.response}`;
      const entryAnalysis = await this.contextAnalyzer.analyzeCurrentContext(entryText);
      
      // Check relevance to current analysis
      const overlap = this.calculateOverlap(_analysis, entryAnalysis);
      
      if (overlap > 0.5) {
        const tokens = this.tokenCounter.count(entryText);
        
        segments.push({
          sessionId: session.metadata.sessionId,
          content: entryText,
          tokens,
          type,
          relevance: relevance.relevanceScore * overlap,
          timestamp: new Date(entry.timestamp),
          metadata: {
            source: `${session.metadata?.projectName || 'Untitled session'}`,
            reason: this.explainInclusion(relevance, overlap),
            entities: relevance.sharedEntities.map(e => e.text),
            topics: relevance.matchedTopics
          }
        });
      }
    }

    return segments;
  }

  private async createSummarySegment(
    session: Session,
    _analysis: ContextAnalysis,
    relevance: ContextRelevance
  ): Promise<ContextSegment | null> {
    // Create a concise summary of the session
    const keyPoints: string[] = [];
    
    // Extract key decisions and outcomes
    for (const entry of session.history) {
      const text = entry.response;
      
      // Look for decision points, implementations, or conclusions
      if (text.includes('implemented') || 
          text.includes('created') || 
          text.includes('fixed') ||
          text.includes('decided') ||
          text.includes('solution')) {
        
        // Extract the key sentence
        const sentences = text.split(/[.!?]+/);
        const keySentence = sentences.find(s => 
          s.includes('implemented') || 
          s.includes('created') || 
          s.includes('fixed')
        );
        
        if (keySentence) {
          keyPoints.push(keySentence.trim());
        }
      }
    }

    if (keyPoints.length === 0) return null;

    const summary = `📋 From session "${session.metadata?.projectName || 'Previous session'}":\n` +
                   keyPoints.slice(0, 3).map(p => `• ${p}`).join('\n');
    
    const tokens = this.tokenCounter.count(summary);

    return {
      sessionId: session.metadata.sessionId,
      content: summary,
      tokens,
      type: 'secondary',
      relevance: relevance.relevanceScore * 0.7, // Slightly lower for summaries
      timestamp: new Date(session.history[session.history.length - 1].timestamp),
      metadata: {
        source: session.metadata?.projectName || 'Previous session',
        reason: 'Summary of related work',
        topics: relevance.matchedTopics
      }
    };
  }

  private calculateOverlap(analysis1: ContextAnalysis, analysis2: ContextAnalysis): number {
    let overlap = 0;
    let factors = 0;

    // Topic overlap
    const commonTopics = analysis1.topics.filter(t => 
      analysis2.topics.includes(t)
    );
    if (analysis1.topics.length > 0) {
      overlap += (commonTopics.length / analysis1.topics.length) * 0.3;
      factors++;
    }

    // Entity overlap
    const commonEntities = analysis1.entities.filter(e1 =>
      analysis2.entities.some(e2 => e2.text === e1.text && e2.type === e1.type)
    );
    if (analysis1.entities.length > 0) {
      overlap += (commonEntities.length / analysis1.entities.length) * 0.3;
      factors++;
    }

    // Keyword overlap
    const commonKeywords = analysis1.keywords.filter(k =>
      analysis2.keywords.includes(k)
    );
    if (analysis1.keywords.length > 0) {
      overlap += (commonKeywords.length / analysis1.keywords.length) * 0.2;
      factors++;
    }

    // Code language overlap
    if (analysis1.codeReferences.length > 0 && analysis2.codeReferences.length > 0) {
      const langs1 = new Set(analysis1.codeReferences.map(r => r.language));
      const langs2 = new Set(analysis2.codeReferences.map(r => r.language));
      const commonLangs = [...langs1].filter(l => langs2.has(l));
      overlap += (commonLangs.length / langs1.size) * 0.2;
      factors++;
    }

    return factors > 0 ? overlap : 0;
  }

  private explainInclusion(relevance: ContextRelevance, overlap: number): string {
    const reasons: string[] = [];

    if (relevance.matchedTopics.length > 0) {
      reasons.push(`Related topics: ${relevance.matchedTopics.join(', ')}`);
    }

    if (relevance.sharedEntities.length > 0) {
      const entities = relevance.sharedEntities.slice(0, 3).map(e => e.text);
      reasons.push(`Shared context: ${entities.join(', ')}`);
    }

    if (relevance.temporalRelevance > 0.8) {
      reasons.push('Recent conversation');
    }

    if (overlap > 0.7) {
      reasons.push('High content similarity');
    }

    return reasons.join('; ') || 'General relevance';
  }

  private async generateContextSummary(
    primary: ContextSegment[],
    secondary: ContextSegment[],
    analysis: ContextAnalysis
  ): Promise<string> {
    if (primary.length === 0 && secondary.length === 0) {
      return 'No relevant context found from previous sessions.';
    }

    const parts: string[] = ['🧠 Auto-Context Summary:'];

    // Summarize included sessions
    const sessionIds = new Set([
      ...primary.map(s => s.sessionId),
      ...secondary.map(s => s.sessionId)
    ]);

    parts.push(`\n📚 Including context from ${sessionIds.size} relevant session(s)`);

    // Main topics covered
    const allTopics = new Set<string>();
    primary.forEach(s => s.metadata.topics?.forEach(t => allTopics.add(t)));
    
    if (allTopics.size > 0) {
      parts.push(`\n🏷️ Topics: ${[...allTopics].join(', ')}`);
    }

    // Key entities referenced
    const allEntities = new Set<string>();
    primary.forEach(s => s.metadata.entities?.forEach(e => allEntities.add(e)));
    
    if (allEntities.size > 0) {
      parts.push(`\n🔗 References: ${[...allEntities].slice(0, 5).join(', ')}`);
    }

    // Current task context
    if (analysis.intent === 'continuation') {
      parts.push('\n✨ Continuing from previous work');
    } else if (analysis.intent === 'question') {
      parts.push('\n❓ Answering based on prior context');
    }

    return parts.join('\n');
  }

  private getStrategyConfig(strategy: string): StrategyConfig {
    const configs: Record<string, StrategyConfig> = {
      conservative: {
        primarySessionCount: 2,
        secondarySessionCount: 3,
        maxSegmentsPerSession: 2,
        summaryPreference: 0.8
      },
      balanced: {
        primarySessionCount: 3,
        secondarySessionCount: 5,
        maxSegmentsPerSession: 3,
        summaryPreference: 0.6
      },
      aggressive: {
        primarySessionCount: 5,
        secondarySessionCount: 8,
        maxSegmentsPerSession: 5,
        summaryPreference: 0.4
      }
    };

    return configs[strategy] || configs.balanced;
  }

  private createEmptyAutoContext(): AutoContext {
    return {
      primary: [],
      secondary: [],
      summary: 'No relevant context found from previous sessions.',
      metadata: {
        sourceSessions: [],
        totalTokens: 0,
        relevanceScore: 0,
        inclusionReasons: [],
        strategy: 'none'
      }
    };
  }
}

interface StrategyConfig {
  primarySessionCount: number;
  secondarySessionCount: number;
  maxSegmentsPerSession: number;
  summaryPreference: number;
}

class ContextBuilder {
  private primary: ContextSegment[] = [];
  private secondary: ContextSegment[] = [];
  private usedTokens = 0;

  constructor(
    private maxTokens: number,
    private tokenCounter: TokenCounter
  ) {}

  canAdd(tokens: number): boolean {
    return this.usedTokens + tokens <= this.maxTokens;
  }

  addPrimary(segment: ContextSegment): void {
    this.primary.push(segment);
    this.usedTokens += segment.tokens;
  }

  addSecondary(segment: ContextSegment): void {
    this.secondary.push(segment);
    this.usedTokens += segment.tokens;
  }

  remainingTokens(): number {
    return this.maxTokens - this.usedTokens;
  }

  getPrimary(): ContextSegment[] {
    return this.primary;
  }

  getSecondary(): ContextSegment[] {
    return this.secondary;
  }

  build(summary: string, strategy: string): AutoContext {
    const summaryTokens = this.tokenCounter.count(summary);
    
    return {
      primary: this.primary,
      secondary: this.secondary,
      summary,
      metadata: {
        sourceSessions: [...new Set([
          ...this.primary.map(s => s.sessionId),
          ...this.secondary.map(s => s.sessionId)
        ])],
        totalTokens: this.usedTokens + summaryTokens,
        relevanceScore: this.calculateOverallRelevance(),
        inclusionReasons: this.gatherInclusionReasons(),
        strategy
      }
    };
  }

  private calculateOverallRelevance(): number {
    if (this.primary.length === 0) return 0;
    
    const totalRelevance = [...this.primary, ...this.secondary]
      .reduce((sum, segment) => sum + segment.relevance, 0);
    
    return totalRelevance / (this.primary.length + this.secondary.length);
  }

  private gatherInclusionReasons(): string[] {
    const reasons = new Set<string>();
    
    [...this.primary, ...this.secondary].forEach(segment => {
      reasons.add(segment.metadata.reason);
    });
    
    return Array.from(reasons);
  }
}