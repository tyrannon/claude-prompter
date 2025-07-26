# Claude Integration Guide - Integrations & Cross-Tool Usage

This document covers integrations with external tools, MCPs, and cross-project usage patterns.

## 🔧 Cross-Project Usage (Updated: 2025-07-21)

### Problem Solved
When using claude-prompter from other project directories (like permitagent or stylemuse), the tool couldn't access the OPENAI_API_KEY from its .env file.

### Solution Implemented
We've created multiple ways to use claude-prompter from any directory:

#### 1. Direct Wrapper Script
```bash
# Works immediately from any directory
/Users/kaiyakramer/claude-prompter-standalone/use-from-anywhere.sh suggest -t "topic" [options]
```

#### 2. Global Command (Recommended)
```bash
# After setting up (one-time):
source ~/.zshrc  # or ~/.bashrc

# Then use from anywhere:
claude-prompter suggest -t "topic" [options]
```

#### 3. Setup Instructions
If the global command isn't working:
```bash
# Run the setup script
/Users/kaiyakramer/claude-prompter-standalone/setup-alias.sh
source ~/.zshrc  # or ~/.bashrc
```

### How It Works
- The wrapper script automatically loads the OPENAI_API_KEY from claude-prompter's .env file
- No need to copy API keys to other projects
- Works seamlessly from any directory on your system

## 🤝 Relationship with MCPs (Model Context Protocol)

### Key Understanding
**Claude-prompter and MCPs are complementary tools, not competitors:**

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **claude-prompter** | Generates intelligent follow-up prompts | After completing tasks, to explore next steps |
| **MCPs** | Provide real-time data/tools to AI | During conversations, for live information |

### Examples of Complementary Usage
1. **Context7 MCP** provides up-to-date documentation → Claude writes accurate code
2. **claude-prompter** suggests what to build next → User gets creative ideas
3. Together: Better code (MCP) + Better questions (claude-prompter) = Optimal workflow

### Recommended MCP Servers
- **context7**: Real-time documentation fetching (prevents outdated code suggestions)
- **filesystem**: Direct file system access
- **github**: Repository operations
- **postgres/sqlite**: Database queries

### Installation Example
```bash
# Install Context7 MCP
npm install -g @upstash/context7-mcp

# Configure in ~/.config/claude/code/mcp_servers.json
{
  "context7": {
    "command": "context7-mcp",
    "args": [],
    "env": {},
    "type": "stdio"
  }
}
```

## 🔮 Meta Usage: Using claude-prompter to Improve claude-prompter

### The Power of Self-Reflection
When working on claude-prompter itself, regularly use the tool to explore enhancement ideas:

```bash
# Generate ideas for new features
claude-prompter prompt -m "What features would make claude-prompter more useful for developers?" --send

# Explore integration possibilities
claude-prompter prompt -m "How can we integrate Context7 MCP's documentation fetching into claude-prompter?" --send

# Get architectural guidance
claude-prompter suggest -t "claude-prompter architecture improvements" --complexity complex --task-type cli-tool
```

### Regular Enhancement Reviews
1. **Weekly**: Use claude-prompter to brainstorm minor improvements
2. **Monthly**: Generate major feature ideas and architectural changes
3. **Before Releases**: Get suggestions for documentation and user experience

### Example Meta-Prompts That Have Led to Improvements:
- "How can claude-prompter better handle cross-project usage?" → Led to wrapper script solution
- "What's the relationship between claude-prompter and MCPs?" → Clarified complementary roles
- "How can Context7 enhance claude-prompter?" → Sparked documentation integration ideas

**Remember**: The best improvements often come from using the tool on itself!

## 🌱 Learning-Aware Suggestions (NEW Feature)

The claude-prompter now includes groundbreaking learning-aware capabilities that show visible growth across sessions!

### How It Works

When you use the `--show-growth` flag, claude-prompter:

1. **Analyzes Previous Sessions**: Scans recent conversation history to identify patterns
2. **Extracts Learning Data**: 
   - Topics you've explored
   - Programming languages you've used
   - Patterns that worked well
   - Areas you haven't explored yet
3. **Generates Growth-Based Suggestions**:
   - 🚀 **Build on Previous Work**: "Based on our previous discussions about X, how can we extend this Y implementation?"
   - 📈 **Pattern Recognition**: "Can you implement Z using the ABC pattern we've used successfully 5 times before?"
   - 💪 **Skill Progression**: "After 15 sessions, I'm ready for advanced concepts. Show me complex patterns for X"
   - 🎓 **Gap Filling**: "I notice I haven't explored testing much. How does X relate to testing?"
   - 🔄 **Cross-Integration**: "How would this differ in Python vs TypeScript based on my experience?"

### Learning Progress Display

The tool shows:
```
🌱 Learning Journey Progress
──────────────────────────────────────
📊 Sessions Completed: 23 (Experienced)
🎯 Recent Focus Areas: authentication, react, api-design
⭐ Mastered Patterns: error-handling, async-patterns, testing
🚀 Growth Opportunities: deployment, performance
```

### Usage Examples

```bash
# Show learning-aware suggestions for any topic
claude-prompter suggest -t "database optimization" --show-growth --claude-analysis

# Include your programming context
claude-prompter suggest -t "microservices" -l typescript --complexity complex --show-growth

# Analyze more session history for deeper insights
claude-prompter suggest -t "testing strategies" --show-growth --sessions 25
```

### Benefits

1. **Visible Progress**: Users can see how their skills have evolved
2. **Personalized Suggestions**: Recommendations based on individual learning patterns  
3. **Continuity**: Build on previous successful approaches
4. **Gap Identification**: Discover unexplored areas for growth
5. **Motivation**: See tangible evidence of learning progress

### When to Use Learning-Aware Mode

- After a user has completed 3+ sessions (enough data for patterns)
- When users seem unsure about next steps
- To show progress in long-term projects
- When celebrating learning milestones
- To identify knowledge gaps and growth areas

This feature transforms claude-prompter from a suggestion tool into a **learning companion** that grows with the user!

## 🤖 **QWEN3 LOCAL PROCESSING INTEGRATION** (2025-07-24)

### 🚀 **BREAKTHROUGH ANALYSIS: HYBRID AI ARCHITECTURE FOR COST OPTIMIZATION**

After comprehensive analysis of claude-prompter's architecture and Qwen3's capabilities, we've identified a **revolutionary opportunity** to integrate local processing that could **reduce API costs by 60-80%** while significantly enhancing intelligent features.

### 💰 **Current Cost Structure Analysis**

#### **High-Cost Operations (Primary Targets)**
```typescript
interface CurrentCostStructure {
  primaryAPIConsumers: {
    promptCommand: {
      usage: 'Every claude-prompter prompt -m "message" --send',
      model: 'GPT-4o (expensive)',
      frequency: 'High - user initiated',
      costPattern: '$0.05-0.25 per request'
    },
    
    chatSessions: {
      usage: 'Interactive chat mode conversations',
      model: 'GPT-4o with streaming',
      frequency: 'High during active sessions',
      costPattern: 'Accumulating per conversation turn'
    },
    
    batchProcessing: {
      usage: 'Multiple prompts from files',
      model: 'GPT-4o for each batch item',
      frequency: 'Occasional but HIGHEST COST RISK',
      costPattern: 'Multiplied by batch size - potentially $100+'
    }
  },
  
  currentMonthlyCosts: {
    lightUser: '$5-15',      // Occasional usage
    moderateUser: '$25-75',  // Regular planning and code generation
    heavyUser: '$100-300',   // Extensive batch processing
    enterprise: '$500+'      // Multiple team members
  }
}
```

### 🏗️ **Hybrid Architecture Design**

#### **Smart Task Routing Matrix**

| Task Type | Complexity | Route To | Cost Savings | Quality |
|-----------|------------|----------|--------------|---------|
| **Task Analysis** | Simple-Medium | 🏠 Local (Qwen3) | 100% | 95%+ |
| **Code Generation** | Simple-Medium | 🏠 Local (Qwen3) | 100% | 90%+ |
| **Plan Optimization** | Medium | 🏠 Local (Qwen3) | 100% | 90%+ |
| **Learning Suggestions** | Simple-Medium | 🏠 Local (Qwen3) | 100% | 95%+ |
| **Complex Architecture** | High | ☁️ Cloud (GPT-4o) | 0% | 100% |
| **Novel Problem Solving** | High | ☁️ Cloud (GPT-4o) | 0% | 100% |
| **Interactive Chat** | Variable | 🔄 Hybrid | 60-80% | 90-100% |
| **Batch Processing** | Variable | 🔄 Smart Batch | 70-90% | 90-95% |

### 📊 **Cost Optimization Impact**

#### **Projected Savings**
```typescript
interface CostOptimizationImpact {
  hybridMonthlyCosts: {
    lightUser: '$1-3',       // 70-80% reduction
    moderateUser: '$5-20',   // 75-80% reduction  
    heavyUser: '$20-75',     // 70-75% reduction
    enterprise: '$100-200'   // 60-70% reduction
  },
  
  annualSavings: {
    lightUser: '$48-144/year',
    moderateUser: '$240-660/year',
    heavyUser: '$960-2,700/year',
    enterprise: '$4,800+/year'
  }
}
```

## 📚 Cross-References

- **Core Usage**: See [core-usage.md](core-usage.md) for basic commands and integration setup
- **Examples**: See [examples.md](examples.md) for integration workflow examples
- **Performance**: See [performance.md](performance.md) for optimization tips with external tools
- **Future Plans**: See [roadmap.md](roadmap.md) for upcoming integration features