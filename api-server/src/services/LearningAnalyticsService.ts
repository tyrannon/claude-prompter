import { DatabaseService } from './DatabaseService';
import { SessionService } from './SessionService';

export interface LearningData {
  experienceLevel: 'Getting Started' | 'Building Knowledge' | 'Experienced' | 'Expert Level';
  sessionCount: number;
  totalQueries: number;
  successRate: number;
  avgQueriesPerSession: number;
  topPatterns: Array<{ pattern: string; frequency: number; category: string }>;
  growthMetrics: {
    weeklyGrowth: number;
    consistencyScore: number;
    diversityIndex: number;
  };
  topicEvolution: Array<{ topic: string; date: string; frequency: number }>;
  recentSessions: Array<{
    id: number;
    date: string;
    topic: string;
    intensity: number;
  }>;
}

export interface PatternAnalysis {
  patterns: Array<{
    pattern: string;
    frequency: number;
    category: 'implementation' | 'architecture' | 'security' | 'testing' | 'deployment';
    trend: 'increasing' | 'stable' | 'decreasing';
    lastSeen: string;
  }>;
  categories: Record<string, { count: number; percentage: number }>;
  masteryLevel: Record<string, 'novice' | 'intermediate' | 'advanced'>;
}

export interface GrowthMetrics {
  totalSessions: number;
  activeDays: number;
  streakDays: number;
  avgSessionsPerWeek: number;
  complexityTrend: Array<{ date: string; complexity: number }>;
  skillProgression: Array<{ skill: string; level: number; sessions: number }>;
  learningVelocity: number; // sessions per week trend
}

export interface TopicEvolution {
  timeline: Array<{
    date: string;
    topics: Array<{ name: string; intensity: number }>;
  }>;
  topicGroups: Array<{
    group: string;
    topics: string[];
    evolution: 'emerging' | 'growing' | 'mature' | 'declining';
  }>;
  recommendations: string[];
}

export class LearningAnalyticsService {
  constructor(
    private dbService: DatabaseService,
    private sessionService: SessionService
  ) {}

  // Main method to get comprehensive learning data
  async getLearningData(): Promise<LearningData> {
    try {
      // Get data from both services
      const [usageReport, sessionAnalytics, patternAnalysis, progression] = await Promise.all([
        this.dbService.getUsageReport('month'),
        this.sessionService.getSessionAnalytics(),
        this.getPatternAnalysis(),
        this.sessionService.getLearningProgression()
      ]);

      // Calculate experience level
      const experienceLevel = this.calculateExperienceLevel(
        sessionAnalytics.totalSessions,
        usageReport.totalRequests,
        sessionAnalytics.avgConversationsPerSession
      );

      // Calculate growth metrics
      const growthMetrics = await this.calculateGrowthMetrics();

      // Get topic evolution
      const topicEvolution = await this.getTopicEvolutionData();

      // Generate mock recent sessions data (to match dashboard structure)
      const recentSessions = this.generateRecentSessionsData(sessionAnalytics.totalSessions);

      return {
        experienceLevel,
        sessionCount: sessionAnalytics.totalSessions,
        totalQueries: usageReport.totalRequests,
        successRate: usageReport.successRate,
        avgQueriesPerSession: sessionAnalytics.avgConversationsPerSession,
        topPatterns: patternAnalysis.patterns.slice(0, 10).map(p => ({
          pattern: p.pattern,
          frequency: p.frequency,
          category: p.category
        })),
        growthMetrics,
        topicEvolution: topicEvolution.slice(-30),
        recentSessions
      };
    } catch (error) {
      console.error('Error generating learning data:', error);
      
      // Return fallback data structure
      return {
        experienceLevel: 'Getting Started',
        sessionCount: 0,
        totalQueries: 0,
        successRate: 100,
        avgQueriesPerSession: 0,
        topPatterns: [],
        growthMetrics: {
          weeklyGrowth: 0,
          consistencyScore: 0,
          diversityIndex: 0
        },
        topicEvolution: [],
        recentSessions: []
      };
    }
  }

  // Get detailed pattern analysis
  async getPatternAnalysis(): Promise<PatternAnalysis> {
    try {
      const [commandFreq, sessionTopics, recentUsage] = await Promise.all([
        this.dbService.getCommandFrequency(20),
        this.sessionService.getTopicAnalysis(),
        this.dbService.getRecentUsage(100)
      ]);

      const patterns: PatternAnalysis['patterns'] = [];
      const categories: Record<string, number> = {};

      // Analyze command patterns
      commandFreq.forEach(cmd => {
        const category = this.categorizeCommand(cmd.command);
        const pattern = {
          pattern: cmd.command,
          frequency: cmd.count,
          category,
          trend: 'stable' as const,
          lastSeen: cmd.lastUsed
        };
        
        patterns.push(pattern);
        categories[category] = (categories[category] || 0) + cmd.count;
      });

      // Analyze topic patterns
      sessionTopics.slice(0, 10).forEach(topic => {
        const category = this.categorizeTopicPattern(topic.topic);
        patterns.push({
          pattern: topic.topic,
          frequency: topic.frequency,
          category,
          trend: 'increasing' as const,
          lastSeen: new Date().toISOString()
        });
        
        categories[category] = (categories[category] || 0) + topic.frequency;
      });

      const totalCount = Object.values(categories).reduce((sum, count) => sum + count, 0);
      const categoryPercentages: Record<string, { count: number; percentage: number }> = {};
      
      Object.entries(categories).forEach(([cat, count]) => {
        categoryPercentages[cat] = {
          count,
          percentage: totalCount > 0 ? (count / totalCount) * 100 : 0
        };
      });

      // Calculate mastery levels
      const masteryLevel: Record<string, 'novice' | 'intermediate' | 'advanced'> = {};
      Object.entries(categoryPercentages).forEach(([cat, data]) => {
        if (data.percentage > 30) masteryLevel[cat] = 'advanced';
        else if (data.percentage > 15) masteryLevel[cat] = 'intermediate';
        else masteryLevel[cat] = 'novice';
      });

      return {
        patterns: patterns.sort((a, b) => b.frequency - a.frequency),
        categories: categoryPercentages,
        masteryLevel
      };
    } catch (error) {
      console.error('Error in pattern analysis:', error);
      return {
        patterns: [],
        categories: {},
        masteryLevel: {}
      };
    }
  }

  // Get growth metrics
  async getGrowthMetrics(): Promise<GrowthMetrics> {
    try {
      const [sessionAnalytics, progression, usagePatterns] = await Promise.all([
        this.sessionService.getSessionAnalytics(),
        this.sessionService.getLearningProgression(),
        this.dbService.getUsagePatterns(30)
      ]);

      // Calculate complexity trend
      const complexityTrend = progression.map(p => ({
        date: p.date,
        complexity: p.complexity
      }));

      // Calculate skill progression from topics
      const skillProgression = this.calculateSkillProgression(progression);

      // Calculate learning velocity (trend in sessions per week)
      const recentActivity = sessionAnalytics.recentActivity;
      const learningVelocity = recentActivity.length > 1
        ? recentActivity.slice(-3).reduce((sum, day) => sum + day.sessions, 0) / 3
        : 0;

      return {
        totalSessions: sessionAnalytics.totalSessions,
        activeDays: recentActivity.filter(day => day.sessions > 0).length,
        streakDays: this.calculateStreak(recentActivity),
        avgSessionsPerWeek: sessionAnalytics.totalSessions > 0 ? sessionAnalytics.totalSessions * 7 / 30 : 0, // rough estimate
        complexityTrend,
        skillProgression,
        learningVelocity
      };
    } catch (error) {
      console.error('Error calculating growth metrics:', error);
      return {
        totalSessions: 0,
        activeDays: 0,
        streakDays: 0,
        avgSessionsPerWeek: 0,
        complexityTrend: [],
        skillProgression: [],
        learningVelocity: 0
      };
    }
  }

  // Get topic evolution data
  async getTopicEvolution(): Promise<TopicEvolution> {
    try {
      const [progression, topicAnalysis] = await Promise.all([
        this.sessionService.getLearningProgression(),
        this.sessionService.getTopicAnalysis()
      ]);

      // Build timeline
      const timeline = this.buildTopicTimeline(progression);

      // Group related topics
      const topicGroups = this.groupRelatedTopics(topicAnalysis);

      // Generate recommendations
      const recommendations = this.generateTopicRecommendations(topicAnalysis, progression);

      return {
        timeline,
        topicGroups,
        recommendations
      };
    } catch (error) {
      console.error('Error in topic evolution:', error);
      return {
        timeline: [],
        topicGroups: [],
        recommendations: []
      };
    }
  }

  // Helper methods
  private calculateExperienceLevel(
    sessions: number, 
    queries: number, 
    avgConversations: number
  ): LearningData['experienceLevel'] {
    const score = sessions * 2 + queries * 0.1 + avgConversations * 1.5;
    
    if (score < 10) return 'Getting Started';
    if (score < 50) return 'Building Knowledge';
    if (score < 150) return 'Experienced';
    return 'Expert Level';
  }

  private async calculateGrowthMetrics(): Promise<LearningData['growthMetrics']> {
    const sessionAnalytics = await this.sessionService.getSessionAnalytics();
    
    return {
      weeklyGrowth: sessionAnalytics.recentActivity.slice(-7).reduce((sum, day) => sum + day.sessions, 0),
      consistencyScore: this.calculateConsistencyScore(sessionAnalytics.recentActivity),
      diversityIndex: sessionAnalytics.topTags.length / Math.max(sessionAnalytics.totalSessions, 1)
    };
  }

  private categorizeCommand(command: string): PatternAnalysis['patterns'][0]['category'] {
    if (command.includes('test') || command.includes('spec')) return 'testing';
    if (command.includes('deploy') || command.includes('build')) return 'deployment';
    if (command.includes('auth') || command.includes('security')) return 'security';
    if (command.includes('architecture') || command.includes('design')) return 'architecture';
    return 'implementation';
  }

  private categorizeTopicPattern(topic: string): PatternAnalysis['patterns'][0]['category'] {
    const securityTerms = ['auth', 'security', 'token', 'password', 'encryption'];
    const architectureTerms = ['architecture', 'design', 'pattern', 'structure', 'system'];
    const testingTerms = ['test', 'testing', 'spec', 'unit', 'integration'];
    const deploymentTerms = ['deploy', 'deployment', 'docker', 'kubernetes', 'ci', 'cd'];

    if (securityTerms.some(term => topic.includes(term))) return 'security';
    if (architectureTerms.some(term => topic.includes(term))) return 'architecture';
    if (testingTerms.some(term => topic.includes(term))) return 'testing';
    if (deploymentTerms.some(term => topic.includes(term))) return 'deployment';
    return 'implementation';
  }

  private calculateSkillProgression(progression: Array<{ topics: string[]; complexity: number; sessionId: string }>): Array<{ skill: string; level: number; sessions: number }> {
    const skillMap: Record<string, { complexity: number; sessions: number }> = {};

    progression.forEach(p => {
      p.topics.forEach(topic => {
        if (!skillMap[topic]) {
          skillMap[topic] = { complexity: 0, sessions: 0 };
        }
        skillMap[topic].complexity = Math.max(skillMap[topic].complexity, p.complexity);
        skillMap[topic].sessions += 1;
      });
    });

    return Object.entries(skillMap)
      .map(([skill, data]) => ({
        skill,
        level: Math.min(data.complexity, 5),
        sessions: data.sessions
      }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 10);
  }

  private calculateStreak(recentActivity: Array<{ date: string; sessions: number }>): number {
    let streak = 0;
    for (let i = recentActivity.length - 1; i >= 0; i--) {
      if (recentActivity[i].sessions > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  private calculateConsistencyScore(recentActivity: Array<{ date: string; sessions: number }>): number {
    if (recentActivity.length === 0) return 0;
    
    const activeDays = recentActivity.filter(day => day.sessions > 0).length;
    return (activeDays / recentActivity.length) * 100;
  }

  private buildTopicTimeline(progression: Array<{ date: string; topics: string[]; complexity: number }>): TopicEvolution['timeline'] {
    const timelineMap: Record<string, Record<string, number>> = {};

    progression.forEach(p => {
      if (!timelineMap[p.date]) {
        timelineMap[p.date] = {};
      }
      
      p.topics.forEach(topic => {
        timelineMap[p.date][topic] = (timelineMap[p.date][topic] || 0) + p.complexity;
      });
    });

    return Object.entries(timelineMap)
      .map(([date, topics]) => ({
        date,
        topics: Object.entries(topics).map(([name, intensity]) => ({ name, intensity }))
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }

  private groupRelatedTopics(topicAnalysis: Array<{ topic: string; frequency: number }>): TopicEvolution['topicGroups'] {
    const groups = [
      { group: 'Frontend', keywords: ['react', 'vue', 'angular', 'javascript', 'typescript', 'css', 'html'] },
      { group: 'Backend', keywords: ['nodejs', 'python', 'api', 'server', 'database', 'sql'] },
      { group: 'DevOps', keywords: ['docker', 'kubernetes', 'deployment', 'ci', 'cd', 'aws', 'cloud'] },
      { group: 'Data', keywords: ['data', 'analytics', 'machine', 'learning', 'ai', 'ml'] }
    ];

    return groups.map(group => {
      const matchingTopics = topicAnalysis
        .filter(topic => group.keywords.some(keyword => topic.topic.includes(keyword)))
        .map(topic => topic.topic);

      return {
        group: group.group,
        topics: matchingTopics,
        evolution: matchingTopics.length > 3 ? 'growing' as const : 'emerging' as const
      };
    }).filter(group => group.topics.length > 0);
  }

  private generateTopicRecommendations(
    topicAnalysis: Array<{ topic: string; frequency: number }>, 
    progression: Array<{ complexity: number; topics: string[] }>
  ): string[] {
    const recommendations = [
      'Consider exploring advanced testing patterns to improve code quality',
      'Database optimization could be your next growth area',
      'Security best practices would complement your current skillset',
      'DevOps automation could streamline your development workflow'
    ];

    return recommendations.slice(0, 3);
  }

  private async getTopicEvolutionData(): Promise<Array<{ topic: string; date: string; frequency: number }>> {
    try {
      const progression = await this.sessionService.getLearningProgression();
      
      return progression.flatMap(p => 
        p.topics.map(topic => ({
          topic,
          date: p.date,
          frequency: p.complexity
        }))
      );
    } catch (error) {
      return [];
    }
  }

  private generateRecentSessionsData(totalSessions: number): Array<{ id: number; date: string; topic: string; intensity: number }> {
    const topics = ['React Development', 'Database Design', 'API Integration', 'Testing Strategy', 'DevOps Setup'];
    const recentSessions = [];

    for (let i = 0; i < Math.min(10, totalSessions); i++) {
      const date = new Date();
      date.setDate(date.getDate() - Math.floor(Math.random() * 30));
      
      recentSessions.push({
        id: i + 1,
        date: date.toISOString().split('T')[0],
        topic: topics[Math.floor(Math.random() * topics.length)],
        intensity: Math.floor(Math.random() * 3) + 1
      });
    }

    return recentSessions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
}