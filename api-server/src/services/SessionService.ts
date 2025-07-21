import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import os from 'os';

// Types based on the existing session types
export interface SessionMetadata {
  sessionId: string;
  createdDate: Date;
  lastAccessed: Date;
  projectName: string;
  description?: string;
  tags: string[];
  status: 'active' | 'completed' | 'archived';
}

export interface ConversationEntry {
  prompt: string;
  response: string;
  timestamp: Date;
  source: 'claude' | 'gpt-4o' | 'user';
  metadata?: any;
}

export interface Decision {
  id: string;
  decision: string;
  rationale: string;
  timestamp: Date;
  relatedFiles?: string[];
}

export interface TrackedIssue {
  id: string;
  title: string;
  status: 'planning' | 'in-progress' | 'completed' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  metadata: SessionMetadata;
  history: ConversationEntry[];
  context: {
    variables: Record<string, any>;
    decisions: Decision[];
    trackedIssues: TrackedIssue[];
  };
}

export interface SessionSummary {
  sessionId: string;
  projectName: string;
  createdDate: Date;
  lastAccessed: Date;
  conversationCount: number;
  status: 'active' | 'completed' | 'archived';
  tags: string[];
}

export class SessionService {
  private sessionDirectory: string;

  constructor() {
    const homeDir = os.homedir();
    this.sessionDirectory = path.join(homeDir, '.claude-prompter', 'sessions');
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!fs.existsSync(this.sessionDirectory)) {
      fs.mkdirSync(this.sessionDirectory, { recursive: true });
    }
  }

  private getSessionPath(sessionId: string): string {
    return path.join(this.sessionDirectory, `${sessionId}.json`);
  }

  // Load a single session
  public async loadSession(sessionId: string): Promise<Session | null> {
    const sessionPath = this.getSessionPath(sessionId);
    
    try {
      const sessionData = await fsPromises.readFile(sessionPath, 'utf-8');
      const session: Session = JSON.parse(sessionData, (key, value) => {
        // Convert date strings back to Date objects
        if (key.includes('Date') || key === 'timestamp' || key.includes('At')) {
          return new Date(value);
        }
        return value;
      });
      
      return session;
    } catch (error) {
      return null;
    }
  }

  // Get recent sessions with analytics
  public async getRecentSessions(limit: number = 10): Promise<SessionSummary[]> {
    try {
      const files = await fsPromises.readdir(this.sessionDirectory);
      const sessions: SessionSummary[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const session = await this.loadSession(sessionId);
          if (session) {
            sessions.push({
              sessionId: session.metadata.sessionId,
              projectName: session.metadata.projectName,
              createdDate: session.metadata.createdDate,
              lastAccessed: session.metadata.lastAccessed,
              conversationCount: session.history.length,
              status: session.metadata.status,
              tags: session.metadata.tags
            });
          }
        }
      }

      return sessions
        .sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime())
        .slice(0, limit);
    } catch (error) {
      console.error('Error getting recent sessions:', error);
      return [];
    }
  }

  // Search sessions by content
  public async searchSessions(query: string): Promise<SessionSummary[]> {
    try {
      const allSessions = await this.getAllSessions();
      const results: SessionSummary[] = [];

      for (const session of allSessions) {
        // Search in project name, description, and conversation history
        const searchable = [
          session.metadata.projectName,
          session.metadata.description || '',
          ...session.history.map(h => `${h.prompt} ${h.response}`),
          ...session.metadata.tags
        ].join(' ').toLowerCase();

        if (searchable.includes(query.toLowerCase())) {
          results.push({
            sessionId: session.metadata.sessionId,
            projectName: session.metadata.projectName,
            createdDate: session.metadata.createdDate,
            lastAccessed: session.metadata.lastAccessed,
            conversationCount: session.history.length,
            status: session.metadata.status,
            tags: session.metadata.tags
          });
        }
      }

      return results.sort((a, b) => b.lastAccessed.getTime() - a.lastAccessed.getTime());
    } catch (error) {
      console.error('Error searching sessions:', error);
      return [];
    }
  }

  // Get all sessions for analytics
  private async getAllSessions(): Promise<Session[]> {
    try {
      const files = await fsPromises.readdir(this.sessionDirectory);
      const sessions: Session[] = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const sessionId = file.replace('.json', '');
          const session = await this.loadSession(sessionId);
          if (session) {
            sessions.push(session);
          }
        }
      }

      return sessions;
    } catch (error) {
      console.error('Error getting all sessions:', error);
      return [];
    }
  }

  // Get session analytics for learning insights
  public async getSessionAnalytics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    avgConversationsPerSession: number;
    topProjects: Array<{ project: string; sessions: number }>;
    recentActivity: Array<{ date: string; sessions: number }>;
    topTags: Array<{ tag: string; count: number }>;
  }> {
    const allSessions = await this.getAllSessions();

    const totalSessions = allSessions.length;
    const activeSessions = allSessions.filter(s => s.metadata.status === 'active').length;
    const avgConversationsPerSession = totalSessions > 0 
      ? allSessions.reduce((sum, s) => sum + s.history.length, 0) / totalSessions 
      : 0;

    // Top projects
    const projectCounts: Record<string, number> = {};
    allSessions.forEach(session => {
      projectCounts[session.metadata.projectName] = (projectCounts[session.metadata.projectName] || 0) + 1;
    });
    const topProjects = Object.entries(projectCounts)
      .map(([project, sessions]) => ({ project, sessions }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 5);

    // Recent activity (last 7 days)
    const recentActivity: Array<{ date: string; sessions: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const sessionsOnDate = allSessions.filter(session => 
        session.metadata.lastAccessed.toISOString().split('T')[0] === dateStr
      ).length;

      recentActivity.push({ date: dateStr, sessions: sessionsOnDate });
    }

    // Top tags
    const tagCounts: Record<string, number> = {};
    allSessions.forEach(session => {
      session.metadata.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    const topTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSessions,
      activeSessions,
      avgConversationsPerSession,
      topProjects,
      recentActivity,
      topTags
    };
  }

  // Get topic extraction from session history
  public async getTopicAnalysis(): Promise<Array<{ topic: string; frequency: number; sessions: string[] }>> {
    const allSessions = await this.getAllSessions();
    const topicMap: Record<string, { frequency: number; sessions: Set<string> }> = {};

    // Extract topics from project names and conversation content
    for (const session of allSessions) {
      const topics = this.extractTopics(session);
      
      topics.forEach(topic => {
        if (!topicMap[topic]) {
          topicMap[topic] = { frequency: 0, sessions: new Set() };
        }
        topicMap[topic].frequency += 1;
        topicMap[topic].sessions.add(session.metadata.sessionId);
      });
    }

    return Object.entries(topicMap)
      .map(([topic, data]) => ({
        topic,
        frequency: data.frequency,
        sessions: Array.from(data.sessions)
      }))
      .sort((a, b) => b.frequency - a.frequency);
  }

  // Extract topics from session data (simplified extraction)
  private extractTopics(session: Session): string[] {
    const topics: string[] = [];
    
    // Extract from project name
    const projectWords = session.metadata.projectName.toLowerCase()
      .split(/[\s-_]+/)
      .filter(word => word.length > 2);
    topics.push(...projectWords);

    // Extract from conversation content (look for technical terms)
    const techTerms = new Set<string>();
    session.history.forEach(entry => {
      const text = `${entry.prompt} ${entry.response}`.toLowerCase();
      
      // Common technical patterns
      const patterns = [
        /\b(react|vue|angular|nodejs|python|typescript|javascript)\b/g,
        /\b(api|database|authentication|frontend|backend|testing)\b/g,
        /\b(docker|kubernetes|aws|deployment|ci\/cd)\b/g,
        /\b(machine\s+learning|ai|data\s+science|analytics)\b/g,
      ];

      patterns.forEach(pattern => {
        const matches = text.match(pattern) || [];
        matches.forEach(match => techTerms.add(match.trim()));
      });
    });

    topics.push(...Array.from(techTerms));
    
    // Extract from tags
    topics.push(...session.metadata.tags.map(tag => tag.toLowerCase()));

    return [...new Set(topics)].filter(topic => topic.length > 2);
  }

  // Get learning progression from session history
  public async getLearningProgression(): Promise<Array<{ 
    sessionId: string; 
    date: string; 
    complexity: number; 
    topics: string[];
    conversationCount: number;
  }>> {
    const allSessions = await this.getAllSessions();
    
    return allSessions
      .map(session => ({
        sessionId: session.metadata.sessionId,
        date: session.metadata.createdDate.toISOString().split('T')[0],
        complexity: this.calculateSessionComplexity(session),
        topics: this.extractTopics(session),
        conversationCount: session.history.length
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  // Calculate session complexity based on conversation content
  private calculateSessionComplexity(session: Session): number {
    let complexityScore = 1;
    
    // Factors that increase complexity
    complexityScore += session.history.length * 0.1; // More conversations = more complex
    complexityScore += session.context.decisions.length * 0.5; // Architectural decisions
    complexityScore += session.context.trackedIssues.length * 0.3; // Multiple issues being tracked
    
    // Content-based complexity
    session.history.forEach(entry => {
      const text = `${entry.prompt} ${entry.response}`.toLowerCase();
      
      // Technical complexity indicators
      if (text.includes('architecture') || text.includes('design pattern')) complexityScore += 0.3;
      if (text.includes('performance') || text.includes('optimization')) complexityScore += 0.2;
      if (text.includes('security') || text.includes('authentication')) complexityScore += 0.2;
      if (text.includes('database') || text.includes('sql')) complexityScore += 0.2;
      if (text.includes('deployment') || text.includes('production')) complexityScore += 0.2;
    });

    return Math.min(complexityScore, 5); // Cap at 5 for normalization
  }
}