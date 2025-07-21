# 🧠 Auto-Context System: Intelligent Session Memory

## Vision

Transform claude-prompter into an intelligent assistant that remembers and leverages past conversations, automatically including relevant context from previous sessions to create seamless, continuous interactions.

## 🎯 Core Problem Solved

Users constantly re-explain context, losing time and breaking flow. Auto-Context solves this by:
- Automatically detecting when past sessions are relevant
- Including appropriate context without user intervention
- Building a knowledge graph of interconnected sessions
- Learning from patterns to improve suggestions

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Context Analyzer│───▶│ Relevance Engine│◀───│ Session Graph   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌─────────────────┐             │
         │              │ Smart Inclusion │             │
         │              └─────────────────┘             │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Vector Store    │    │ Context Builder │    │ User Preferences│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🧩 Core Components

### 1. 📊 Context Relevance Analyzer

```typescript
interface ContextRelevance {
  sessionId: string;
  relevanceScore: number; // 0-1
  matchedTopics: string[];
  sharedEntities: string[];
  temporalRelevance: number;
  semanticSimilarity: number;
  userImportance: number;
}

interface RelevanceFactors {
  // Topic matching
  topicOverlap: number;
  keywordMatches: string[];
  
  // Entity recognition
  sharedCode: string[];
  sharedFiles: string[];
  sharedConcepts: string[];
  
  // Temporal factors
  recency: number;
  sessionFrequency: number;
  
  // User signals
  markedImportant: boolean;
  frequentlyReferenced: boolean;
}
```

### 2. 🔍 Cross-Session Search Engine

```typescript
interface SessionSearchEngine {
  // Full-text search across all sessions
  searchSessions(query: string, options?: SearchOptions): SearchResult[];
  
  // Semantic search using embeddings
  semanticSearch(embedding: number[], threshold: number): Session[];
  
  // Entity-based search
  findSessionsWithEntity(entity: string, type: EntityType): Session[];
  
  // Time-based search
  findRecentSessions(timeframe: TimeRange, filters?: Filter[]): Session[];
}

interface SearchResult {
  session: Session;
  matches: Match[];
  relevanceScore: number;
  snippet: string;
  context: string[];
}
```

### 3. 🎯 Smart Context Inclusion

```typescript
interface ContextInclusionStrategy {
  name: string;
  maxTokens: number;
  includePriority: InclusionRule[];
  exclusionRules: ExclusionRule[];
}

interface InclusionRule {
  type: 'recent' | 'relevant' | 'marked' | 'referenced';
  weight: number;
  tokenLimit: number;
  condition?: (context: Context) => boolean;
}

interface AutoContext {
  primary: ContextSegment[];    // Most relevant context
  secondary: ContextSegment[];  // Supporting context
  summary: string;              // AI-generated summary of included context
  metadata: {
    sourceSessions: string[];
    totalTokens: number;
    relevanceScore: number;
    inclusiomReason: string[];
  };
}
```

### 4. 🔗 Session Graph & Relationships

```typescript
interface SessionGraph {
  nodes: SessionNode[];
  edges: SessionEdge[];
  clusters: TopicCluster[];
}

interface SessionNode {
  id: string;
  session: Session;
  embedding: number[];
  topics: string[];
  entities: Entity[];
  importance: number;
}

interface SessionEdge {
  source: string;
  target: string;
  relationship: 'continues' | 'references' | 'related' | 'branches';
  strength: number;
  metadata: {
    sharedEntities: string[];
    topicFlow: string[];
  };
}

interface TopicCluster {
  id: string;
  name: string;
  sessions: string[];
  keywords: string[];
  summary: string;
}
```

## 🔧 Implementation Plan

### Phase 1: Context Analysis Foundation

```typescript
class ContextAnalyzer {
  private vectorStore: VectorStore;
  private tokenizer: TokenCounter;
  
  async analyzeCurrentContext(prompt: string): Promise<ContextAnalysis> {
    // Extract entities and topics
    const entities = await this.extractEntities(prompt);
    const topics = await this.extractTopics(prompt);
    
    // Generate embedding for semantic search
    const embedding = await this.generateEmbedding(prompt);
    
    return {
      entities,
      topics,
      embedding,
      keywords: this.extractKeywords(prompt),
      intent: this.detectIntent(prompt)
    };
  }
  
  async findRelevantSessions(
    analysis: ContextAnalysis, 
    options: SearchOptions
  ): Promise<ContextRelevance[]> {
    const results: ContextRelevance[] = [];
    
    // Semantic search
    const semanticMatches = await this.vectorStore.search(
      analysis.embedding, 
      options.threshold || 0.7
    );
    
    // Entity matching
    const entityMatches = await this.findSessionsWithEntities(
      analysis.entities
    );
    
    // Topic matching
    const topicMatches = await this.findSessionsWithTopics(
      analysis.topics
    );
    
    // Combine and rank results
    return this.rankResults([
      ...semanticMatches,
      ...entityMatches,
      ...topicMatches
    ], analysis);
  }
}
```

### Phase 2: Smart Inclusion Engine

```typescript
class SmartInclusionEngine {
  private contextAnalyzer: ContextAnalyzer;
  private compressionEngine: CompressionEngine;
  
  async buildAutoContext(
    currentPrompt: string,
    options: AutoContextOptions
  ): Promise<AutoContext> {
    // Analyze current context
    const analysis = await this.contextAnalyzer.analyzeCurrentContext(
      currentPrompt
    );
    
    // Find relevant sessions
    const relevantSessions = await this.contextAnalyzer.findRelevantSessions(
      analysis,
      { threshold: options.relevanceThreshold || 0.7 }
    );
    
    // Build context with token budget
    const contextBuilder = new ContextBuilder(options.maxTokens || 20000);
    
    // Add primary context (highest relevance)
    const primary = await this.selectPrimaryContext(
      relevantSessions.slice(0, 3),
      analysis
    );
    contextBuilder.addPrimary(primary);
    
    // Add secondary context (supporting info)
    const secondary = await this.selectSecondaryContext(
      relevantSessions.slice(3, 10),
      analysis,
      contextBuilder.remainingTokens()
    );
    contextBuilder.addSecondary(secondary);
    
    // Generate summary of included context
    const summary = await this.generateContextSummary(
      primary,
      secondary,
      analysis
    );
    
    return contextBuilder.build(summary);
  }
}
```

### Phase 3: Session Graph Builder

```typescript
class SessionGraphBuilder {
  private graph: SessionGraph;
  private embeddings: Map<string, number[]>;
  
  async buildGraph(sessions: Session[]): Promise<SessionGraph> {
    // Create nodes
    const nodes = await this.createNodes(sessions);
    
    // Find relationships
    const edges = await this.findEdges(nodes);
    
    // Cluster by topic
    const clusters = await this.clusterByTopic(nodes, edges);
    
    return {
      nodes,
      edges,
      clusters
    };
  }
  
  private async findEdges(nodes: SessionNode[]): Promise<SessionEdge[]> {
    const edges: SessionEdge[] = [];
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const relationship = await this.detectRelationship(
          nodes[i],
          nodes[j]
        );
        
        if (relationship.strength > 0.5) {
          edges.push({
            source: nodes[i].id,
            target: nodes[j].id,
            relationship: relationship.type,
            strength: relationship.strength,
            metadata: relationship.metadata
          });
        }
      }
    }
    
    return edges;
  }
}
```

## 🎮 User Experience

### Commands

```bash
# Enable auto-context
claude-prompter session auto-context on

# Configure preferences
claude-prompter session config --relevance-threshold 0.8 --max-tokens 15000

# View context that will be included
claude-prompter session preview-context "My current prompt"

# Manually link sessions
claude-prompter session link --current abc123 --related def456

# Search across all sessions
claude-prompter session search "React authentication"

# View session graph visualization
claude-prompter session graph --output graph.html
```

### Real-World Usage

```bash
# User starts new conversation
You: Help me add error handling to my React auth component

# System automatically detects relevant context
🧠 Auto-Context: Found 3 relevant sessions
  ✓ "React authentication component with JWT" (2 days ago)
  ✓ "Error handling patterns in React" (1 week ago)  
  ✓ "JWT token refresh implementation" (3 days ago)

# Included context summary
📋 Included from past sessions:
  - JWT auth component structure in AuthProvider.tsx
  - Token refresh logic using axios interceptors
  - Previous error handling discussion for API calls

# Claude responds with full context awareness
Claude: Based on your AuthProvider.tsx component and the token refresh logic we implemented, I'll help you add comprehensive error handling...
```

## 🚀 Advanced Features

### 1. Learning & Adaptation
- Track which auto-included context was helpful
- Learn user preferences for context inclusion
- Adapt relevance scoring based on feedback

### 2. Context Compression
- Intelligently compress older context
- Preserve key decisions and code
- Generate summaries of lengthy discussions

### 3. Multi-User Support
- Personal context graphs per user
- Shared team knowledge bases
- Privacy controls for sensitive sessions

## 📊 Success Metrics

1. **Context Hit Rate**: % of relevant past context successfully included
2. **Token Efficiency**: Optimal use of token budget
3. **User Satisfaction**: Reduced need to re-explain context
4. **Speed Improvement**: Faster task completion with auto-context
5. **Accuracy**: Improved response quality with historical context

## 🔗 Integration Points

### With Context Overflow System
- Use compression algorithms for older context
- Respect token limits when including auto-context
- Prioritize recent + relevant over just recent

### With Learning System
- Learn which contexts are most valuable
- Identify patterns in context relationships
- Improve relevance scoring over time

### With Planning System
- Include past planning decisions automatically
- Track implementation progress across sessions
- Link related implementation sessions

---

This system transforms every conversation into a continuation of your journey with claude-prompter, making it truly intelligent and context-aware! 🚀