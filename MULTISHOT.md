# 🚀 ClaudePrompter Multi-Shot Orchestrator

A revolutionary expansion of ClaudePrompter that transforms it into a modular, multi-shot AI prompting and comparison tool. Run the same prompt across multiple AI models, compare results intelligently, and iteratively improve your prompts.

## 🎯 Core Features

### Multi-Model Execution
- **Parallel & Sequential Execution**: Run prompts across multiple models simultaneously or sequentially
- **Engine Abstraction**: Unified interface supporting GPT, Claude, local models (Ollama), and custom endpoints
- **Resource Management**: Semaphore-controlled concurrency with configurable limits
- **Fault Tolerance**: Continue execution even if some engines fail, with retry logic

### Intelligent Output Management
- **Git Branch Integration**: Save results to separate Git branches for version control
- **Timestamped Folders**: Organize results in timestamped directories
- **Hybrid Strategy**: Combine Git and folder approaches for maximum flexibility
- **Automatic Cleanup**: Configurable cleanup of old results

### Advanced Comparison & Analysis
- **Side-by-Side Comparison**: Visual diff analysis between model outputs
- **Quality Scoring**: Automated scoring using Claude for objective evaluation  
- **Semantic Analysis**: Detect differences in content, style, accuracy, and completeness
- **Performance Metrics**: Execution time, token usage, and efficiency comparisons

### Recursive Self-Improvement
- **Self-Evaluation**: Use ClaudePrompter itself to evaluate multi-shot results
- **Iterative Refinement**: Automatically improve prompts based on evaluation feedback
- **Quality Thresholds**: Stop iteration when quality targets are met
- **Improvement Tracking**: Maintain history of prompt improvements

## 🏗️ Architecture Overview

```
ClaudePrompter Multi-Shot System
├── 🔧 Engine Layer (Pluggable AI Models)
│   ├── GPTEngine (OpenAI GPT-4o, GPT-4o-mini)
│   ├── ClaudeEngine (Anthropic Claude Sonnet, Haiku)
│   ├── LocalEngine (Ollama, llama.cpp, custom)
│   └── EngineFactory (Creation & Management)
│
├── 🎼 Orchestration Layer (Multi-Shot Execution)
│   ├── PromptRunner (Parallel/Sequential execution)
│   ├── OutputManager (Git branches + folders)
│   ├── ComparisonEngine (Diff & analysis)
│   └── ResultCollector (Aggregation & selection)
│
├── 🧠 Intelligence Layer (Analysis & Improvement)
│   ├── SelfEvaluator (Recursive evaluation)
│   ├── QualityMetrics (Scoring algorithms)
│   ├── IterativeRefiner (Prompt improvement)
│   └── DifferenceAnalyzer (Semantic diff)
│
└── 💻 Interface Layer (CLI & User Interaction)
    ├── MultiShotCommand (CLI interface)
    ├── InteractiveComparison (Winner selection)
    ├── ConfigurationManager (Engine setup)
    └── ProgressReporting (Real-time updates)
```

## 🚦 Quick Start

### 1. Installation & Setup

Ensure you have the necessary API keys configured:
```bash
# OpenAI API Key (for GPT models)
export OPENAI_API_KEY="your-openai-key"

# Anthropic API Key (for Claude models)  
export ANTHROPIC_API_KEY="your-anthropic-key"

# For local models, ensure Ollama is running
ollama serve
ollama pull qwen3:8b
ollama pull tinyllama
```

### 2. Basic Multi-Shot Execution

Run a simple multi-shot comparison:
```bash
# Basic multi-shot with default models
claude-prompter multishot -m "Explain quantum computing in simple terms"

# Specify custom models
claude-prompter multishot -m "Write a Python function to sort a list" \
  --models "gpt-4o,claude-sonnet,qwen3-8b"

# Sequential execution with custom settings
claude-prompter multishot -m "Design a REST API for a todo app" \
  --models "gpt-4o,claude-sonnet" \
  --sequential \
  --timeout 120000 \
  --retries 3
```

### 3. Advanced Features

```bash
# Multiple runs with comparison and auto-scoring
claude-prompter multishot -m "Optimize this SQL query: SELECT * FROM users" \
  --models "gpt-4o,claude-sonnet,claude-haiku" \
  --runs 3 \
  --compare \
  --auto-score \
  --select-winner

# Git branch output strategy
claude-prompter multishot -m "Review this TypeScript code for security issues" \
  --models "gpt-4o,claude-sonnet" \
  --output git \
  --branch-prefix "security-review"

# Dry run to test configuration
claude-prompter multishot --dry-run \
  --models "gpt-4o,claude-sonnet,qwen3-8b" \
  --concurrent \
  --max-concurrency 3
```

### 4. List Available Models

```bash
# See all configured models and their availability
claude-prompter multishot --list-models
```

## 📊 Output Examples

### Console Output
```
🚀 Starting multi-shot run with 3 engines...
Strategy: Parallel
Max Concurrency: 5

🔍 Checking engine availability...
✓ 3 engines ready

✓ gpt-4o completed (2847ms)
✓ claude-sonnet completed (3124ms) 
✓ qwen3-8b completed (5891ms)

✅ Multi-shot run completed in 6124ms
✓ 3/3 engines succeeded

📊 Multi-Shot Results Summary
──────────────────────────────────────────────────
gpt-4o: 1/1 success, avg 2847ms
claude-sonnet: 1/1 success, avg 3124ms
qwen3-8b: 1/1 success, avg 5891ms
```

### Git Branch Structure
```
main
├── multishot-abc123-gpt-4o
├── multishot-abc123-claude-sonnet
└── multishot-abc123-qwen3-8b
```

### Folder Structure
```
multi-shot-results/
└── run-abc123-2024-08-07T10-30-45-000Z/
    ├── gpt-4o-result.md
    ├── claude-sonnet-result.md
    ├── qwen3-8b-result.md
    ├── comparison.md
    └── metadata.json
```

## 🎮 Interactive Comparison

When using `--compare` or `--select-winner`, you'll get interactive comparison:

```
🔍 Interactive Comparison
──────────────────────────────────────────────────

════════════════════════════════════════════════════════════════════════════════

GPT-4O:
────────────────────────────────────────
Quantum computing is a revolutionary approach to computation that harnesses the 
principles of quantum mechanics to process information in fundamentally different 
ways than classical computers...

Time: 2847ms | Model: gpt-4o

════════════════════════════════════════════════════════════════════════════════

CLAUDE-SONNET:
────────────────────────────────────────
Think of quantum computing like having a magical coin that can be both heads and 
tails at the same time, until you look at it. Classical computers work with bits 
that are definitely 0 or 1...

Time: 3124ms | Model: claude-3-sonnet-20240229

🏆 Winner selected: claude-sonnet
✓ Winner result saved to main workspace
```

## 🤖 Auto-Scoring with Claude

The `--auto-score` flag uses Claude to provide objective evaluation:

```
🤖 Auto-Scoring with Claude
──────────────────────────────────────────────────

┌─ 🤖 Claude's Scoring Analysis ─┐
│                                │
│ GPT-4O: Accuracy=9, Clarity=8, Completeness=9, Overall=8.7
│ Technical accuracy and comprehensive coverage, though slightly dense.
│ 
│ CLAUDE-SONNET: Accuracy=8, Clarity=10, Completeness=8, Overall=8.7  
│ Excellent use of analogies making complex concepts accessible.
│
│ QWEN3-8B: Accuracy=7, Clarity=7, Completeness=6, Overall=6.7
│ Good basic explanation but lacks depth and some technical precision.
│
│ **RANKING**: Claude-Sonnet (best accessibility) > GPT-4o (best technical detail) > Qwen3-8B
│                                │
└────────────────────────────────┘
```

## 🔄 Recursive Self-Improvement

Use ClaudePrompter to improve its own prompts iteratively:

```bash
# Enable iterative refinement
claude-prompter multishot -m "Create a marketing strategy for a SaaS product" \
  --models "gpt-4o,claude-sonnet" \
  --auto-score \
  --recursive \
  --max-iterations 3 \
  --quality-threshold 8.5
```

This will:
1. Run the initial prompt across models
2. Evaluate results using Claude
3. If quality threshold not met, refine the prompt
4. Repeat until threshold met or max iterations reached

## ⚙️ Configuration

### Engine Configuration File

Create `multishot-config.json` to define your engine setup:

```json
{
  "engines": [
    {
      "type": "gpt",
      "name": "gpt-4o",
      "config": {
        "name": "gpt-4o",
        "model": "gpt-4o",
        "temperature": 0.7,
        "maxTokens": 4000
      }
    },
    {
      "type": "local",
      "name": "qwen3-8b", 
      "config": {
        "name": "qwen3-8b",
        "model": "qwen3:8b",
        "endpoint": "http://localhost:11434",
        "format": "ollama"
      }
    }
  ],
  "executionConfig": {
    "concurrent": true,
    "maxConcurrency": 5,
    "timeout": 60000
  }
}
```

### Load Configuration

```bash
claude-prompter multishot -m "Your prompt" --config-file multishot-config.json
```

## 🎯 Use Cases

### 1. **Code Generation & Review**
Compare how different models approach coding problems:
```bash
claude-prompter multishot -m "Write a React component for user authentication" \
  --models "gpt-4o,claude-sonnet" --compare --auto-score
```

### 2. **Content Creation**
Get diverse perspectives on content:
```bash
claude-prompter multishot -m "Write a blog post about AI ethics" \
  --models "gpt-4o,claude-sonnet,claude-haiku" --select-winner
```

### 3. **Technical Documentation**
Compare documentation styles:
```bash
claude-prompter multishot -m "Document this API endpoint with examples" \
  --models "gpt-4o,claude-sonnet" --output git --branch-prefix "docs"
```

### 4. **Problem Solving**
Explore different solution approaches:
```bash
claude-prompter multishot -m "Design a scalable architecture for 1M users" \
  --models "gpt-4o,claude-sonnet" --runs 2 --compare
```

### 5. **Quality Assurance**
Validate AI-generated content:
```bash
claude-prompter multishot -m "Fact-check this article about climate change" \
  --models "gpt-4o,claude-sonnet" --auto-score
```

## 🚀 Advanced Workflows

### Multi-Stage Prompt Chains
Combine multiple multi-shot runs:

```bash
# Stage 1: Generate initial ideas
claude-prompter multishot -m "Brainstorm features for a task management app" \
  --models "gpt-4o,claude-sonnet" --output folders

# Stage 2: Develop selected ideas  
claude-prompter multishot -m "Develop the top 3 features from the previous brainstorm" \
  --models "gpt-4o,claude-sonnet" --compare --select-winner

# Stage 3: Implementation planning
claude-prompter multishot -m "Create implementation plan for the winning features" \
  --models "gpt-4o,claude-sonnet" --auto-score
```

### Integration with Existing ClaudePrompter Features

```bash
# Use with session management
claude-prompter session start --project "multishot-experiment"
claude-prompter multishot -m "Design a microservices architecture" \
  --models "gpt-4o,claude-sonnet" --use-session current

# Combine with learning analytics
claude-prompter multishot -m "Explain machine learning concepts" \
  --models "gpt-4o,claude-sonnet" --compare
claude-prompter stats --detailed
```

## 📈 Performance & Scalability

### Benchmarks
- **Parallel execution**: 3-5x faster than sequential for multiple models
- **Memory usage**: ~100MB for typical 3-model runs
- **Concurrent limits**: Configurable (default: 5 simultaneous requests)
- **Timeout handling**: Per-engine timeouts with retry logic

### Resource Management
- Semaphore-controlled concurrency prevents API rate limiting
- Automatic cleanup of old results to manage disk space
- Efficient caching of engine instances
- Graceful degradation when engines are unavailable

## 🛠️ Development & Extension

### Adding New Engines

1. **Create Engine Class**:
```typescript
import { BaseEngine, EngineConfig, PromptRequest, EngineResponse } from '../engines/BaseEngine';

export class MyCustomEngine extends BaseEngine {
  async execute(request: PromptRequest): Promise<EngineResponse> {
    // Implementation
  }
  
  async isAvailable(): Promise<boolean> {
    // Availability check
  }
  
  getCapabilities() {
    // Return capabilities
  }
}
```

2. **Register in EngineFactory**:
```typescript
case 'mycustom':
  return new MyCustomEngine(config);
```

### Custom Comparison Algorithms

Extend the `ComparisonEngine` to add custom analysis:

```typescript
export class CustomComparisonEngine extends ComparisonEngine {
  customAnalysis(responses: Map<string, EngineResponse>): CustomAnalysisResult {
    // Your custom analysis logic
  }
}
```

## 🔮 Future Enhancements

### Roadmap Items
- **Visual Web Dashboard**: Browser-based comparison interface
- **API Integration**: REST API for programmatic access  
- **Plugin System**: Community-developed engine plugins
- **Advanced Metrics**: Semantic similarity scoring, readability analysis
- **Batch Processing**: Process multiple prompts in batch mode
- **Cost Optimization**: Smart routing based on cost/quality tradeoffs

### Community Contributions
We welcome contributions! Key areas for community development:
- New engine integrations (Gemini, PaLM, etc.)
- Custom comparison algorithms
- Visualization improvements
- Performance optimizations

## 📚 API Reference

### CLI Commands

| Command | Description | Example |
|---------|-------------|---------|
| `multishot -m <prompt>` | Run basic multi-shot | `multishot -m "Explain AI"` |
| `--models <list>` | Specify models | `--models "gpt-4o,claude-sonnet"` |
| `--runs <number>` | Multiple runs per model | `--runs 3` |
| `--concurrent` | Parallel execution | `--concurrent` |
| `--sequential` | Sequential execution | `--sequential` |
| `--compare` | Show comparison | `--compare` |
| `--auto-score` | Auto-score with Claude | `--auto-score` |
| `--select-winner` | Interactive selection | `--select-winner` |
| `--output <strategy>` | Output strategy | `--output git` |
| `--dry-run` | Test configuration | `--dry-run` |
| `--list-models` | List available models | `--list-models` |

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrent` | boolean | `true` | Enable parallel execution |
| `maxConcurrency` | number | `5` | Max parallel requests |
| `timeout` | number | `60000` | Request timeout (ms) |
| `retries` | number | `1` | Retry failed requests |
| `outputStrategy` | string | `'both'` | `'git'`, `'folders'`, or `'both'` |
| `cleanupOld` | boolean | `false` | Auto-cleanup old results |
| `continueOnError` | boolean | `true` | Continue if engines fail |

## 🤝 Contributing

We welcome contributions to the multi-shot orchestrator! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup
```bash
git clone https://github.com/your-org/claude-prompter-standalone
cd claude-prompter-standalone
npm install
npm run build
npm test
```

### Running Tests
```bash
# Run all tests
npm test

# Run specific test suites
npm run test:engines
npm run test:orchestration
npm run test:comparison
```

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

**ClaudePrompter Multi-Shot Orchestrator** - Transforming AI prompt workflows through intelligent multi-model comparison and iterative improvement. 🚀