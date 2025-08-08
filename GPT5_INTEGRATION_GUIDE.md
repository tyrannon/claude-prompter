# GPT-5 Integration Guide 🚀

## 🌟 Overview

Claude-prompter now supports the full GPT-5 model family with advanced A/B testing capabilities! This integration provides intelligent model selection, cost optimization, and comprehensive performance analytics.

## 🎯 Available GPT-5 Models

### 🏆 GPT-5 Flagship
- **Model ID**: `gpt-5`
- **Context**: 256K tokens
- **Max Output**: 8,192 tokens
- **Reasoning**: Superhuman level
- **Best For**: Complex reasoning, research, long-context tasks
- **Cost**: $0.008/1K input, $0.024/1K output

### ⚡ GPT-5 Mini
- **Model ID**: `gpt-5-mini`
- **Context**: 128K tokens
- **Max Output**: 4,096 tokens
- **Reasoning**: Advanced level
- **Best For**: General tasks, cost-effective development
- **Cost**: $0.002/1K input, $0.006/1K output

### 🔥 GPT-5 Nano
- **Model ID**: `gpt-5-nano`
- **Context**: 32K tokens
- **Max Output**: 2,048 tokens
- **Reasoning**: Basic level
- **Best For**: Simple tasks, high-volume processing
- **Cost**: $0.0005/1K input, $0.0015/1K output

## 🚀 Usage Examples

### Basic GPT-5 Usage

```bash
# Use GPT-5 Mini (recommended default)
claude-prompter multishot -m "Explain async/await in JavaScript" --models gpt-5-mini

# Use GPT-5 Flagship for complex reasoning
claude-prompter multishot -m "Design a distributed system architecture" --models gpt-5

# Quick comparison between GPT-5 variants
claude-prompter multishot -m "Write a sorting algorithm" --gpt5-variants
```

### A/B Testing

```bash
# Compare GPT-5 Mini vs GPT-4o
claude-prompter multishot -m "Your prompt here" --ab-test --models "gpt-5-mini,gpt-4o"

# Enable A/B test metrics
claude-prompter multishot -m "Your prompt here" --ab-test --ab-test-metrics

# Test all GPT-5 variants with metrics
claude-prompter multishot -m "Complex reasoning task" --gpt5-variants --ab-test-metrics
```

### Advanced A/B Testing

```bash
# Create a dedicated A/B test
claude-prompter abtest --create

# Quick model comparison
claude-prompter abtest --compare "gpt-5,gpt-5-mini,gpt-4o"

# Analyze test results
claude-prompter abtest --analyze test_id_here

# List active tests
claude-prompter abtest --list
```

### Smart Model Selection

```bash
# Let the intelligent router choose the best models
claude-prompter multishot -m "Your prompt" --smart --max-models 3

# Optimize for cost
claude-prompter multishot -m "Your prompt" --smart --cost-sensitivity high

# Optimize for speed
claude-prompter multishot -m "Your prompt" --smart --speed-sensitivity high

# Optimize for quality
claude-prompter multishot -m "Your prompt" --smart --quality-sensitivity high
```

## 📊 Performance Comparison

| Model | Speed | Cost | Reasoning | Best Use Case |
|-------|-------|------|-----------|---------------|
| **GPT-5** | Medium | High | Superhuman | Complex research, architecture |
| **GPT-5 Mini** | Fast | Low | Advanced | General development, prototyping |
| **GPT-5 Nano** | Ultra Fast | Ultra Low | Basic | Simple tasks, high volume |
| **GPT-4o** | Medium | Medium | Expert | Balanced performance |

## 💡 Best Practices

### 🎯 Model Selection Guide

#### Use GPT-5 Flagship when:
- Complex multi-step reasoning required
- Working with large codebases (100K+ tokens)
- Research or analysis tasks
- Architecture design decisions

#### Use GPT-5 Mini when:
- General programming tasks
- Code reviews and explanations
- Cost-sensitive applications
- Most day-to-day development

#### Use GPT-5 Nano when:
- Simple code completions
- Quick questions
- High-volume batch processing
- Real-time applications

### 💰 Cost Optimization

```bash
# Start with Mini for development
claude-prompter multishot -m "Test prompt" --models gpt-5-mini

# A/B test to find optimal model for your use case
claude-prompter multishot -m "Typical prompt" --ab-test --models "gpt-5-mini,gpt-5" --runs 5

# Use smart routing for automatic optimization
claude-prompter multishot -m "Your prompt" --smart --cost-sensitivity high
```

### 📈 A/B Testing Strategy

1. **Establish Baseline**: Start with GPT-5 Mini
2. **Compare Variants**: Test Mini vs Flagship for your specific tasks
3. **Measure Metrics**: Track cost, speed, and quality
4. **Optimize**: Use findings to select the right model for each task type

## 🔧 Configuration Examples

### Environment Setup
```bash
# Required: OpenAI API key with GPT-5 access
export OPENAI_API_KEY="your-api-key-here"

# Optional: Enable debug logging
export CLAUDE_PROMPTER_DEBUG=true
```

### Multishot Configuration
```bash
# Comprehensive GPT-5 testing
claude-prompter multishot \
  -m "Your complex prompt here" \
  --models "gpt-5,gpt-5-mini,gpt-5-nano,gpt-4o" \
  --runs 3 \
  --ab-test-metrics \
  --compare \
  --auto-score
```

## 📊 Sample Output

```
🚀 ClaudePrompter Multi-Shot Orchestrator

Configuration:
  Strategy: Parallel
  Engines: gpt-5, gpt-5-mini, gpt-4o
  Runs: 1 per engine

🔍 Checking engine availability...
✓ 3 engines ready

📊 Multi-Shot Results Summary
──────────────────────────────
gpt-5: 1/1 success, avg 1847ms
gpt-5-mini: 1/1 success, avg 623ms
gpt-4o: 1/1 success, avg 1205ms

📊 A/B Test Metrics
──────────────────────────────

💰 Cost Analysis:
  gpt-5: $0.0156
  gpt-5-mini: $0.0042
  gpt-4o: $0.0089
  Total: $0.0287

⚡ Performance Comparison:
🥇 gpt-5-mini: avg 623ms (580-665ms)
🥈 gpt-4o: avg 1205ms (1180-1230ms)  
🥉 gpt-5: avg 1847ms (1820-1875ms)
```

## 🎛️ Advanced Features

### Custom Engine Configuration

```typescript
// Programmatic usage
import { GPT5Engine } from 'claude-prompter';

// Create specific GPT-5 variants
const flagship = GPT5Engine.flagship();
const mini = GPT5Engine.mini();
const nano = GPT5Engine.nano();

// Enable A/B testing
const abTesting = GPT5Engine.withABTesting({
  preferredModel: 'gpt-5-mini'
});
```

### Integration with Existing Workflows

```bash
# Add GPT-5 to existing multishot workflows
claude-prompter multishot \
  -m "$(cat my-complex-prompt.txt)" \
  --models "gpt-5-mini,gpt-4o,claude-sonnet" \
  --output folders \
  --cleanup-old

# Use with batch processing
claude-prompter batch \
  --file prompts.txt \
  --model gpt-5-mini \
  --concurrent 5
```

## 🔍 Troubleshooting

### Common Issues

#### Model Not Available
```bash
# Check API key has GPT-5 access
claude-prompter config

# List available models
claude-prompter multishot --list-models
```

#### High Costs
```bash
# Use cost-optimized models
claude-prompter multishot -m "prompt" --models gpt-5-nano

# Enable cost tracking
claude-prompter multishot -m "prompt" --ab-test-metrics
```

#### Slow Performance
```bash
# Use faster models
claude-prompter multishot -m "prompt" --models gpt-5-mini,gpt-5-nano

# Optimize concurrency
claude-prompter multishot -m "prompt" --max-concurrency 10
```

## 🚀 Migration from GPT-4

### Simple Migration
```bash
# Old: GPT-4o
claude-prompter multishot -m "prompt" --models gpt-4o

# New: GPT-5 Mini (similar performance, lower cost)
claude-prompter multishot -m "prompt" --models gpt-5-mini
```

### A/B Test Migration
```bash
# Compare your current setup with GPT-5
claude-prompter multishot \
  -m "Your typical prompt" \
  --models "gpt-4o,gpt-5-mini" \
  --ab-test \
  --runs 10 \
  --ab-test-metrics
```

### Batch Migration
```bash
# Test a batch of your existing prompts
claude-prompter batch \
  --file your-prompts.txt \
  --model gpt-5-mini \
  --compare-with gpt-4o
```

## 📈 Performance Optimization

### Intelligent Routing
- **Smart Flag**: Automatically selects optimal models based on prompt analysis
- **Cost Sensitivity**: Prioritizes cost-effective models
- **Speed Sensitivity**: Optimizes for response time
- **Quality Sensitivity**: Ensures high-quality outputs

### Caching and Batching
- **Batch API**: Use GPT-5's 50% batch discount for non-real-time tasks
- **Result Caching**: Avoid duplicate API calls
- **Smart Retries**: Automatic fallback to alternative models

### Monitoring and Analytics
- **Real-time Metrics**: Track performance, cost, and quality
- **A/B Test Analytics**: Statistical analysis of model performance
- **Usage Tracking**: Monitor API consumption and costs

## 🎯 Future Roadmap

- **GPT-5 Turbo**: When available, will be added automatically
- **Fine-tuning Support**: Custom GPT-5 models integration
- **Advanced Analytics**: ML-powered model recommendation
- **Cost Prediction**: Forecast costs based on usage patterns

## 📞 Support

For questions or issues with GPT-5 integration:
- Check the [troubleshooting section](#troubleshooting)
- Review your OpenAI API key permissions
- Ensure you have GPT-5 access enabled
- Use `claude-prompter config` to verify setup

---

**Happy coding with GPT-5! 🚀**