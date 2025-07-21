# Claude Integration Guide for claude-prompter

This document provides instructions for Claude (Anthropic's AI assistant) on how to use the claude-prompter tool to generate intelligent prompt suggestions for users.

## 🤖 Overview

The claude-prompter tool is specifically designed with Claude integration in mind. As Claude, you can invoke this tool to:
- Generate contextual prompt suggestions based on what you've created
- Help users explore follow-up questions
- Guide productive conversations
- Bridge between Claude and GPT-4o for enhanced assistance

## 🎯 When to Use This Tool

Use the claude-prompter to generate suggestions when:

1. **After Code Generation** - You've helped create code and want to suggest next steps
2. **Complex Topics** - The user is working on something that has many aspects to explore
3. **Learning Scenarios** - The user would benefit from guided exploration
4. **Project Completion** - You want to suggest improvements or extensions
5. **Error Resolution** - After fixing issues, suggest preventive measures

### 🔄 Regular Usage Reminder
**IMPORTANT**: Use claude-prompter regularly throughout conversations:
- After completing any significant task or feature
- When the user seems unsure about next steps
- Every 3-5 interactions when working on complex projects
- Before ending a session to provide future direction
- When switching between different aspects of a project

**NEW: Learning-Aware Usage**:
- Use `--show-growth` flag to display visible learning progress
- Let users see how their skills have evolved across sessions
- Generate suggestions that build on previous successful patterns
- Identify knowledge gaps and suggest areas for growth

This ensures users always have clear pathways forward and can see their tangible progress over time!

## 📋 Command Syntax

### Basic Suggestion Generation
```bash
node dist/cli.js suggest -t "<topic>" [options]
```

### Options Reference
- `-t, --topic <topic>` - **Required**: The topic or feature you've been working on
- `-c, --code` - Flag indicating code was generated
- `-l, --language <language>` - Programming language used (e.g., typescript, python)
- `--complexity <level>` - Options: simple, moderate, complex
- `--task-type <type>` - Options: api-integration, ui-component, cli-tool, backend-service, etc.
- `--claude-analysis` - **Important**: Use this flag when YOU are generating suggestions
- `--show-growth` - **NEW**: Display learning progress and generate growth-based suggestions
- `--sessions <number>` - Number of recent sessions to analyze for learning patterns (default: 10)

## 🔍 Context Analysis Guide

Before invoking the tool, analyze the conversation to determine:

### 1. Topic Identification
```bash
# Be specific about what was created
-t "React authentication component with JWT"  # ✅ Good
-t "authentication"                           # ❌ Too vague
```

### 2. Code Detection
Use `--code` flag if you:
- Generated actual code snippets
- Created functions or classes
- Built components or modules
- Fixed bugs with code changes

### 3. Language Selection
```bash
# Common language options
-l typescript   # For TS/JS projects
-l python       # For Python scripts
-l react        # For React components
-l nodejs       # For Node.js backends
```

### 4. Complexity Assessment
- **simple**: Basic features, single functions, straightforward logic
- **moderate**: Multiple components, some integration, standard patterns
- **complex**: Architecture decisions, multiple systems, advanced patterns

### 5. Task Type Classification
- `api-integration`: Working with external APIs
- `ui-component`: Building user interface elements
- `cli-tool`: Command-line applications
- `backend-service`: Server-side logic
- `data-processing`: ETL, analysis, transformations
- `authentication`: Auth/authorization systems
- `database`: Database schema, queries, migrations

## 📚 Usage Examples

### Example 1: After Creating a React Component
```bash
node dist/cli.js suggest \
  -t "React todo list component with local storage" \
  --code \
  -l react \
  --complexity moderate \
  --task-type ui-component \
  --claude-analysis
```

### Example 2: After Building an API Integration
```bash
node dist/cli.js suggest \
  -t "OpenAI API integration with error handling" \
  --code \
  -l typescript \
  --complexity moderate \
  --task-type api-integration \
  --claude-analysis
```

### Example 3: After Creating a CLI Tool
```bash
node dist/cli.js suggest \
  -t "File processing CLI with progress tracking" \
  --code \
  -l nodejs \
  --complexity complex \
  --task-type cli-tool \
  --claude-analysis
```

### Example 4: General Architecture Discussion
```bash
node dist/cli.js suggest \
  -t "Microservices architecture design" \
  --complexity complex \
  --task-type backend-service \
  --claude-analysis
```

### Example 5: Learning-Aware Suggestions (NEW!)
```bash
node dist/cli.js suggest \
  -t "React state management with Redux" \
  --code \
  -l react \
  --complexity moderate \
  --task-type ui-component \
  --show-growth \
  --claude-analysis
```

This will analyze the user's previous sessions and show:
- 🌱 Learning Journey Progress (sessions completed, experience level)
- 🎯 Recent focus areas from previous conversations  
- ⭐ Mastered patterns from repeated successful solutions
- 🚀 Growth opportunities in unexplored areas
- Growth-based suggestions that build on previous work

## 🎨 Presenting Suggestions to Users

When you run the suggest command:

1. **Show the command you're running**:
   ```
   Let me generate some intelligent follow-up prompts for you:
   [command here]
   ```

2. **Explain what the suggestions mean**:
   ```
   Based on what we've created, here are categorized suggestions for next steps:
   ```

3. **Guide the user**:
   ```
   You can copy any of these prompts and use:
   node dist/cli.js prompt -m "chosen prompt" --send
   ```

## 💡 Best Practices

### DO:
- ✅ Be specific with topic descriptions
- ✅ Use --claude-analysis flag when YOU are generating
- ✅ Include all relevant context (language, complexity, type)
- ✅ Run the command and show output to users
- ✅ Explain the categories to new users

### DON'T:
- ❌ Use vague topics
- ❌ Skip the --claude-analysis flag
- ❌ Generate suggestions for unrelated topics
- ❌ Overwhelm users with too many suggestions at once

## 🔄 Complete Workflow Example

1. **User asks**: "Help me create a REST API with Express"

2. **You create**: Express server with routes, middleware, error handling

3. **You analyze**:
   - Topic: "Express REST API with CRUD operations"
   - Code was generated: Yes
   - Language: TypeScript/Node.js
   - Complexity: Moderate
   - Type: backend-service

4. **You run**:
   ```bash
   node dist/cli.js suggest \
     -t "Express REST API with CRUD operations" \
     --code \
     -l nodejs \
     --complexity moderate \
     --task-type backend-service \
     --claude-analysis
   ```

5. **Tool generates** suggestions like:
   - Add authentication middleware
   - Write API tests
   - Implement rate limiting
   - Add API documentation
   - Set up database migrations

6. **User picks** a suggestion and continues the conversation

## 🚀 Advanced Integration

### Chaining Suggestions
After implementing a suggestion, you can generate new suggestions based on the updated context:

```bash
# First round: Basic API
-t "Express REST API"

# Second round: After adding auth
-t "Express REST API with JWT authentication"

# Third round: After adding tests
-t "Tested Express API with auth and CI/CD"
```

### Multi-Feature Projects
For complex projects with multiple features:

```bash
# Focus on specific aspects
-t "User authentication system in MERN stack" --task-type authentication
-t "React dashboard components for MERN app" --task-type ui-component
-t "MongoDB schema design for user system" --task-type database
```

## 🔗 Integration with Main Conversation

Always connect the suggestions back to the main conversation:

1. Reference what was just built
2. Show how suggestions extend the work
3. Explain the value of each suggestion category
4. Help users understand the progression

## 📝 Remember

This tool is designed to:
- Enhance your ability to guide users
- Provide structured follow-up options
- Bridge between different AI assistants
- Create a more interactive development experience

Use it whenever you feel the user would benefit from seeing their options laid out clearly!

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

### 🎯 Always-On Followup Questions

**NEW ENHANCEMENT**: Every prompt suggestion now includes intelligent followup questions! This ensures continuous learning momentum and deeper exploration of topics.

Example flow:
1. **Initial Question**: "Help me implement authentication"
2. **Claude's Response**: [Provides authentication code]
3. **claude-prompter suggests**: 
   - "How can we add password reset functionality to this auth system?"
   - "What security vulnerabilities should we test for in this implementation?"
   - "How would you scale this authentication for 1M+ users?"
   - "Can you show me how to add OAuth integration to this setup?"

This creates an **endless learning chain** where each answer leads to deeper, more sophisticated questions!

## 🎨 GUI Dashboard Architecture (2025-07-21)

### 🌟 Phase 2: Enhanced Interactive Dashboard

Building on our successful foundation (React + TypeScript dashboard with D3.js charts), we're expanding into a comprehensive learning analytics platform:

#### 📋 Component Architecture

```
Dashboard App
├── Core Components (✅ Completed)
│   ├── Dashboard.tsx - Main container with API integration
│   ├── ProgressOverview.tsx - Experience level & metrics
│   ├── PatternChart.tsx - D3.js frequency visualization
│   └── SessionTimeline.tsx - Learning journey timeline
│
├── New Interactive Components (🚧 In Progress)
│   ├── SessionBrowser.tsx - Interactive session explorer
│   │   ├── SearchBar.tsx - Real-time session search
│   │   ├── FilterPanel.tsx - Project, date, complexity filters
│   │   ├── SessionList.tsx - Virtualized session list
│   │   └── PaginationControls.tsx - Efficient navigation
│   │
│   ├── ProjectAnalytics.tsx - Project-specific insights
│   │   ├── ProjectSelector.tsx - Switch between projects
│   │   ├── ProjectMetrics.tsx - Usage, patterns, growth per project
│   │   └── ProjectComparison.tsx - Cross-project learning analysis
│   │
│   ├── UsageAnalytics.tsx - Cost & efficiency metrics
│   │   ├── CostBreakdown.tsx - Token costs over time
│   │   ├── EfficiencyMetrics.tsx - Success rates, response times
│   │   └── ResourceUsage.tsx - API usage patterns
│   │
│   └── SessionDetailsView.tsx - Deep-dive session analysis
│       ├── SessionMetadata.tsx - Date, duration, project context
│       ├── ActivityTimeline.tsx - Chronological interaction flow
│       ├── UserInteractions.tsx - Prompt/response analysis
│       └── ResourceUsage.tsx - Tokens, costs, performance
│
└── API Layer (✅ Completed)
    ├── Express server (port 3001) with CORS support
    ├── Learning analytics endpoints
    ├── WebSocket support for real-time updates
    └── Mock data services (ready for real DB integration)
```

#### 🎯 Project-Specific Learning Analytics

**Multi-Project Intelligence**: Track learning across different codebases:

- **StyleMuse Project**: UI/UX patterns, design system evolution
- **CodeAgent Project**: Code generation patterns, refactoring insights  
- **claude-prompter Project**: Meta-learning about prompt engineering
- **Custom Projects**: Automatic project detection and categorization

**Cross-Project Insights**:
- Pattern transfer between projects
- Skill progression across different domains
- Complexity evolution per project
- Resource efficiency comparisons

#### 📊 Enhanced Visual Features

**Interactive Session Browser**:
- Real-time search with highlighting
- Multi-dimensional filtering (project, date, complexity, success rate)
- Sortable columns with performance indicators
- Infinite scroll for large session lists

**Cost & Usage Analytics**:
- Token usage trends with cost projections
- Efficiency metrics (tokens per successful interaction)
- Resource optimization recommendations
- Budget tracking and alerts

**Session Deep-Dive**:
- Conversational flow visualization
- Prompt effectiveness analysis
- Response quality metrics
- Learning outcome tracking

## 🚀 Planned Enhancements (2025-07-21)

Based on real-world experience with complex planning workflows and the success of learning-aware suggestions, these features are planned to make claude-prompter even more powerful:

### 🖥️ GUI Dashboard Interface (HIGH PRIORITY)

A beautiful web-based interface to visualize your learning journey!

#### Features:
```bash
claude-prompter gui --port 3000  # Launch web dashboard
```

**📊 Learning Analytics Dashboard:**
- 📈 **Interactive Charts**: Pattern frequency over time, topic evolution graphs  
- 🎯 **Progress Tracking**: Session timeline, mastery progression, skill level growth
- 🌐 **Topic Network**: Visual map of how your topics interconnect
- 💡 **Suggestion History**: Track which suggestions led to breakthroughs
- ⭐ **Achievement System**: Celebrate learning milestones and pattern mastery
- 🎨 **Beautiful Metrics**: All those lovely progress bars and growth visualizations!

**🔧 Interactive Features:**
- Click on any topic to see related sessions
- Drill down into pattern usage across time periods  
- Filter by language, complexity, or project
- Export beautiful progress reports
- Set learning goals and track progress
- Share learning achievements

**💻 Technical Implementation:**
- React-based dashboard with real-time updates
- D3.js for interactive charts and network graphs
- WebSocket connection for live session updates  
- Responsive design for desktop and mobile
- Dark/light theme support
- Export to PNG/PDF capabilities

#### Mock-up Interface:
```
┌─────────────────── claude-prompter Dashboard ────────────────────┐
│ 🌱 Learning Journey | 📊 Analytics | 💡 Suggestions | ⚙️ Settings │
├─────────────────────────────────────────────────────────────────│
│                                                                  │
│  🎯 Your Progress                     📈 Pattern Mastery         │
│  ┌─────────────────────┐             ┌─────────────────────┐     │
│  │ 🚀 73 Sessions      │             │ async-await    ████ │     │
│  │ Expert Level        │             │ error-handling ███  │     │  
│  │ 15 Languages        │             │ testing       ██   │     │
│  │ 127 Patterns        │             │ deployment    █    │     │
│  └─────────────────────┘             └─────────────────────┘     │
│                                                                  │
│  📊 Topic Evolution (Last 30 Days)                              │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │     ┌─React─┐                                               ││
│  │          │    ┌─API Design─┐                                ││
│  │          └──────┤           ├──┐                            ││
│  │                 └───────────┘  │                            ││
│  │                                └─┬─Database─┬─Performance─┐ ││
│  │  ┌─TypeScript─┐                  │          │             │ ││
│  │  └─────┬──────┘                  └──────────┘             │ ││
│  │        └─Testing─┐                                        │ ││
│  │                 └────────────────────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────│
│ 🎯 Recent Achievements:                                          │
│ • 🏆 Mastered async-await-pattern (15+ uses)                    │
│ • 🌟 Expert Level Reached (50+ sessions)                        │
│ • 🔥 5-day learning streak                                       │
└─────────────────────────────────────────────────────────────────┘
```

#### Why GUI Dashboard?
- **Visual Learning**: Charts and graphs make progress tangible and motivating
- **Pattern Recognition**: See connections between topics you never noticed
- **Goal Setting**: Track progress toward specific learning objectives  
- **Sharing**: Show off your learning achievements and growth
- **Insights**: Discover optimal learning times, most effective patterns
- **Gamification**: Achievement system makes learning addictive!

#### Development Timeline:
- **Phase 1**: Basic dashboard with progress metrics (2-3 weeks)
- **Phase 2**: Interactive charts and topic networks (3-4 weeks) 
- **Phase 3**: Advanced features like goal tracking, sharing (2-3 weeks)
- **Phase 4**: Mobile app companion (4-6 weeks)

### 2. Planning Command with Task Breakdown 🗺️
```bash
claude-prompter plan -t "Complex feature implementation" --tasks 3 --complexity complex
```
- Auto-generate structured task breakdowns
- Create implementation checklists  
- Estimate complexity and dependencies
- Export to markdown/todo formats
- Track completion status
- **GUI Integration**: Visual project timeline and dependency graphs

### 3. Context Persistence & Session Management 📚
```bash
claude-prompter session start --project "my-project"
claude-prompter session add-context "Working on multiple features..."
claude-prompter prompt -m "What's next?" --use-session
```
- Store conversation context locally
- Auto-include relevant context in prompts
- Support multiple named sessions
- Track file paths, decisions, and progress
- Clean up old sessions automatically
- **GUI Integration**: Session timeline view, context visualization

### 4. Multi-Issue Tracking & Progress Visualization 📊
```bash
claude-prompter track --add "Feature A" --status "in-progress"
claude-prompter track --add "Bug Fix B" --status "planning"
claude-prompter track --list  # Shows all tracked issues with progress
```
- Track multiple parallel features/issues
- Visualize dependencies between features
- Generate progress reports
- Link issues to sessions and plans
- Export status summaries
- **GUI Integration**: Kanban board, progress charts, dependency visualization

### 5. Code Analysis & Implementation Suggestions 🔍
```bash
claude-prompter analyze --file "Component.tsx" --suggest-next
claude-prompter analyze --pattern "Feature X" --find-integration-points
```
- Parse code files and extract structure
- Suggest integration points for new features
- Find similar implementations in codebase
- Generate implementation scaffolding
- Identify potential conflicts
- **GUI Integration**: Code structure visualization, integration point mapping

### 6. Decision Log & Rationale Tracking 📝
```bash
claude-prompter decision add "Use Service pattern" --rationale "Maintains consistency"
claude-prompter decision list --project "my-project"
claude-prompter decision export --format markdown
```
- Track architectural decisions with rationales
- Maintain consistency across features
- Search previous decisions
- Export as documentation
- Link decisions to code files
- **GUI Integration**: Decision timeline, rationale network graph, impact visualization

### Why These Features?
These enhancements address common challenges in complex development:
- **Multiple parallel features**: Often working on 3-5 features simultaneously
- **Context switching**: Losing track of decisions and progress
- **Task organization**: Breaking down complex features into implementable steps
- **Architectural consistency**: Remembering why certain patterns were chosen
- **Integration planning**: Finding the right places to add new features
- **Visual Learning**: CLI metrics are great, but GUI makes learning **addictive**!

### Implementation Priority
1. **🖥️ GUI Dashboard** (HIGHEST PRIORITY - Makes learning visible and engaging!)
2. **Planning Command** (Structures complex features effectively)
3. **Context Persistence** (Immediate value - prevents repeated explanations)
4. **Multi-Issue Tracking** (Visual progress for parallel work)
5. **Decision Log** (Maintains architectural consistency)
6. **Code Analysis** (Advanced integration assistance)

### 🌟 The GUI Revolution
Once the dashboard launches, claude-prompter becomes:
- **Motivating**: See your learning progress in beautiful charts
- **Social**: Share your learning achievements and milestones
- **Gamified**: Achievement system makes learning addictive
- **Insightful**: Discover patterns in your learning you never noticed
- **Goal-Oriented**: Set targets and track progress toward them
- **Interactive**: Click, explore, and dive deep into your data

The CLI creates the data, the GUI makes it **irresistible**! 🚀