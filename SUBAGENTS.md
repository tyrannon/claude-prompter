# Claude Code Subagents for claude-prompter

This document provides comprehensive guidance on using Claude Code subagents with claude-prompter to create intelligent, specialized AI workflows that dramatically enhance development productivity.

## 🤖 Overview

Claude Code subagents are specialized AI assistants that operate in separate context windows with focused expertise and controlled tool access. When combined with claude-prompter's intelligent suggestion system, they create powerful workflow chains that can handle complex development tasks with unprecedented efficiency.

## 🏗️ Architecture & Design

### Subagent Structure
```
.claude/agents/
├── code-reviewer.md      # Code quality analysis and improvement suggestions
├── debugger.md          # Bug identification and systematic debugging
├── data-scientist.md    # Data analysis, ML, and statistical insights
├── test-generator.md    # Comprehensive test case generation
├── security-analyst.md  # Security vulnerability assessment
└── performance-optimizer.md # Performance bottleneck identification and optimization
```

### File Format
Each subagent is defined as a Markdown file with YAML frontmatter:

```markdown
---
name: subagent-name
description: Clear description of when and how to use this subagent
tools: Read, Grep, Glob, Bash  # Comma-separated list of allowed tools
---

# Detailed system prompt and instructions...
```

## 🎯 Core Subagents

### 1. Code Reviewer (`code-reviewer`)
**Purpose**: Expert code review specialist for quality analysis and improvements
**When to Use**: After significant code creation, before merging, for refactoring guidance
**Key Capabilities**:
- Code quality assessment (readability, maintainability, performance)
- Best practice enforcement for multiple languages/frameworks
- Security vulnerability identification
- Architecture and design pattern recommendations
- Technical debt identification

**Example Usage**:
```bash
# Automatic delegation
"Please review the authentication module I just created"

# Explicit invocation
"Use the code-reviewer to analyze the payment processing code"
```

### 2. Debugger (`debugger`)
**Purpose**: Master debugging specialist for systematic issue resolution
**When to Use**: Runtime errors, test failures, unexpected application behavior
**Key Capabilities**:
- Root cause analysis with systematic investigation
- Error pattern recognition and troubleshooting
- Performance issue identification
- Integration problem solving
- Production debugging strategies

**Example Usage**:
```bash
# Automatic delegation
"The user authentication is failing intermittently"

# Explicit invocation
"Use the debugger to investigate why the API calls are timing out"
```

### 3. Data Scientist (`data-scientist`)
**Purpose**: Expert data analysis, ML, and statistical insights
**When to Use**: Data exploration, pattern discovery, ML model development, analytics
**Key Capabilities**:
- Exploratory data analysis and statistical modeling
- Machine learning pipeline development
- Data visualization and insight generation
- Performance metrics analysis and interpretation
- A/B testing and experimental design

**Example Usage**:
```bash
# Automatic delegation
"Analyze the user engagement data to find patterns"

# Explicit invocation
"Use the data-scientist to build a predictive model for user churn"
```

### 4. Test Generator (`test-generator`)
**Purpose**: Comprehensive test case generation and quality assurance
**When to Use**: Creating test suites, improving test coverage, TDD workflows
**Key Capabilities**:
- Unit, integration, and end-to-end test generation
- Test strategy development and framework selection
- Edge case and boundary condition identification
- Test automation and CI/CD integration
- Performance and security test design

**Example Usage**:
```bash
# Automatic delegation
"Create comprehensive tests for the new payment API"

# Explicit invocation
"Use the test-generator to create unit tests for the user service"
```

### 5. Security Analyst (`security-analyst`)
**Purpose**: Security vulnerability assessment and defensive practices
**When to Use**: Security audits, threat analysis, compliance requirements
**Key Capabilities**:
- Vulnerability scanning and assessment
- Security code review and threat modeling
- Compliance checking (OWASP, GDPR, etc.)
- Penetration testing guidance
- Security architecture recommendations

**Example Usage**:
```bash
# Automatic delegation
"Audit the authentication system for security vulnerabilities"

# Explicit invocation
"Use the security-analyst to review our API for OWASP Top 10 issues"
```

### 6. Performance Optimizer (`performance-optimizer`)
**Purpose**: Performance bottleneck identification and system optimization
**When to Use**: Performance issues, scalability planning, optimization requirements
**Key Capabilities**:
- Performance profiling and bottleneck identification
- Database query optimization and caching strategies
- System architecture optimization
- Load testing and capacity planning
- Memory and CPU optimization techniques

**Example Usage**:
```bash
# Automatic delegation
"The dashboard is loading slowly, help optimize it"

# Explicit invocation
"Use the performance-optimizer to analyze the database queries"
```

## 🔗 Workflow Chaining with claude-prompter

### The Power of Intelligent Chaining
claude-prompter can suggest complex multi-step workflows that chain subagents together for comprehensive solutions:

```bash
# Example chain suggestion from claude-prompter:
"First use the code-reviewer to analyze code quality, then use the security-analyst to check for vulnerabilities, and finally use the test-generator to create comprehensive tests"
```

### Common Workflow Patterns

#### 1. Code Development Workflow
```
code-reviewer → security-analyst → test-generator → performance-optimizer
```
**Use Case**: Complete code quality pipeline for new features
**Example**: "Review new authentication code, check security, generate tests, optimize performance"

#### 2. Bug Investigation Workflow
```
debugger → performance-optimizer → test-generator
```
**Use Case**: Systematic bug resolution with prevention measures
**Example**: "Debug the timeout issue, optimize performance, create regression tests"

#### 3. Data-Driven Development Workflow
```
data-scientist → performance-optimizer → security-analyst
```
**Use Case**: Analytics feature development with optimization and security
**Example**: "Analyze user behavior data, optimize queries, secure data access"

#### 4. Security-First Development Workflow
```
security-analyst → code-reviewer → test-generator
```
**Use Case**: Security-critical feature development
**Example**: "Audit payment processing, review code quality, generate security tests"

## 🚀 Enhanced claude-prompter Integration

### Workflow Chain Suggestions Feature

claude-prompter can now suggest intelligent subagent workflows based on context:

```typescript
interface SubagentChainSuggestion {
  workflow: string[];
  description: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedTime: string;
  benefits: string[];
}

// Example suggestions generated by claude-prompter:
const suggestions = [
  {
    workflow: ['code-reviewer', 'security-analyst', 'test-generator'],
    description: 'Comprehensive quality assurance pipeline',
    complexity: 'moderate',
    estimatedTime: '45-60 minutes',
    benefits: ['Code quality', 'Security validation', 'Test coverage']
  },
  {
    workflow: ['debugger', 'performance-optimizer'],
    description: 'Performance issue investigation and resolution',
    complexity: 'complex',
    estimatedTime: '60-90 minutes',
    benefits: ['Bug resolution', 'Performance optimization', 'System understanding']
  }
];
```

### Implementation in claude-prompter

The enhanced suggestion system analyzes:
1. **Current Task Context**: Type of work being performed
2. **Code Complexity**: Assessment of the complexity level
3. **Project History**: Previous successful workflow patterns
4. **Learning Patterns**: User's skill development progression

## 🛠️ Implementation Guide

### Setting Up Subagents

1. **Install the Subagents**:
   ```bash
   # Subagents are already created in .claude/agents/
   ls .claude/agents/
   ```

2. **Verify Claude Code Recognizes Them**:
   ```bash
   # Test subagent invocation
   echo "Use the code-reviewer to analyze this function" | claude-code
   ```

3. **Enable Workflow Chain Suggestions in claude-prompter**:
   ```bash
   # Add subagent chain generation to claude-prompter
   node dist/cli.js suggest -t "your topic" --subagent-chains --claude-analysis
   ```

### Creating Custom Subagents

1. **Create a new subagent file**:
   ```bash
   touch .claude/agents/my-custom-agent.md
   ```

2. **Follow the standard format**:
   ```markdown
   ---
   name: my-custom-agent
   description: Specialized agent for specific domain expertise
   tools: Read, Grep, Glob  # Limit tools based on needs
   ---
   
   # Detailed system prompt
   You are an expert in [domain]...
   ```

3. **Test the subagent**:
   ```bash
   echo "Use the my-custom-agent to [task]" | claude-code
   ```

## 📈 Advanced Workflow Patterns

### Parallel Processing
Some workflows can run subagents in parallel for efficiency:

```bash
# Parallel analysis
"Use the code-reviewer and security-analyst simultaneously to analyze the codebase"
```

### Conditional Branching
Workflows can branch based on results:

```bash
# Conditional workflow
"Use the debugger to investigate. If it's a performance issue, use the performance-optimizer. If it's a logic error, use the test-generator to create regression tests"
```

### Iterative Refinement
Workflows can loop for continuous improvement:

```bash
# Iterative optimization
"Use the performance-optimizer to identify bottlenecks, then the code-reviewer to suggest improvements, repeat until targets are met"
```

## 🎯 Best Practices

### Subagent Design Principles

1. **Single Responsibility**: Each subagent should have one clear, focused purpose
2. **Tool Limitation**: Only grant necessary tools to each subagent
3. **Clear Context**: Provide detailed context about when to use each subagent
4. **Consistent Output**: Use standardized output formats for easy chaining
5. **Error Handling**: Include robust error handling and fallback strategies

### Workflow Design Guidelines

1. **Logical Progression**: Ensure each step builds naturally on the previous one
2. **Context Preservation**: Maintain context between subagent invocations
3. **Validation Points**: Include checkpoints to validate progress
4. **Escape Hatches**: Provide ways to exit or modify workflows mid-stream
5. **Documentation**: Document complex workflows for repeatability

### Performance Considerations

1. **Context Switching**: Minimize unnecessary context switches between subagents
2. **Tool Access**: Limit tool access to what each subagent actually needs
3. **Parallel Execution**: Use parallel processing where possible
4. **Caching**: Cache results that might be reused across subagents
5. **Resource Management**: Monitor resource usage during complex workflows

## 🔮 Future Enhancements

### Planned Features

1. **Visual Workflow Builder**: GUI for creating complex subagent workflows
2. **Workflow Templates**: Pre-built workflow templates for common scenarios
3. **Dynamic Routing**: AI-powered routing based on real-time analysis
4. **Workflow Analytics**: Performance metrics and optimization suggestions
5. **Team Collaboration**: Shared workflows and team-specific subagents

### Integration Opportunities

1. **IDE Integration**: Direct subagent invocation from development environments
2. **CI/CD Integration**: Automated subagent workflows in build pipelines
3. **Project Management**: Integration with task tracking and project management tools
4. **Documentation Generation**: Automated documentation from subagent outputs
5. **Learning Analytics**: Track and analyze subagent usage patterns

## 🚀 Getting Started

### Quick Start Workflow

1. **Test Basic Subagents**:
   ```bash
   echo "Use the code-reviewer to analyze the main.ts file" | claude-code
   ```

2. **Try a Simple Chain**:
   ```bash
   echo "Use the code-reviewer to analyze the code, then use the test-generator to create tests" | claude-code
   ```

3. **Generate Workflow Suggestions**:
   ```bash
   node dist/cli.js suggest -t "new user authentication system" --subagent-chains
   ```

4. **Implement a Complete Workflow**:
   ```bash
   # Use claude-prompter to get a complete workflow suggestion
   node dist/cli.js prompt -m "Suggest a complete workflow for implementing a secure payment system using subagents" --send
   ```

### Example: Complete Development Workflow

```bash
# 1. Generate intelligent workflow suggestion
node dist/cli.js suggest -t "secure payment processing feature" --complexity complex --subagent-chains

# 2. Follow the suggested workflow (example):
# - Use security-analyst to define security requirements
# - Use code-reviewer to establish coding standards  
# - Use test-generator to create TDD test cases
# - Use debugger to resolve any integration issues
# - Use performance-optimizer to ensure scalability
# - Use security-analyst again for final security audit

# 3. Track progress and iterate
node dist/cli.js history show --project payment-system
```

## 📚 Resources

### Documentation Links
- [Claude Code Subagents Official Documentation](https://docs.anthropic.com/en/docs/claude-code/sub-agents)
- [claude-prompter Integration Guide](./CLAUDE.md)
- [Workflow Pattern Examples](./examples/)

### Community Resources
- [Subagent Template Repository](https://github.com/anthropics/claude-code-subagents)
- [Community Workflow Patterns](https://github.com/anthropics/claude-workflows)
- [Best Practices Wiki](https://wiki.claude-code.dev/subagents)

---

**Remember**: Subagents are most powerful when combined with claude-prompter's intelligent suggestion system. This creates a symbiotic relationship where claude-prompter provides the strategic intelligence about what workflows to use, and the subagents provide specialized expertise to execute those workflows efficiently.

The result is a development environment that not only helps you write better code, but actively guides you through the entire development lifecycle with expert-level assistance at every step! 🚀