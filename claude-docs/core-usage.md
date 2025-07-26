# Claude Integration Guide - Core Usage

This document provides core instructions for Claude (Anthropic's AI assistant) on how to use the claude-prompter tool.

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

## 📚 Cross-References

- **Detailed Examples**: See [examples.md](examples.md) for comprehensive usage examples
- **Performance Tips**: See [performance.md](performance.md) for optimization strategies
- **Integration Guides**: See [integrations.md](integrations.md) for external tool integration
- **Future Features**: See [roadmap.md](roadmap.md) for upcoming enhancements

## 📝 Remember

This tool is designed to:
- Enhance your ability to guide users
- Provide structured follow-up options
- Bridge between different AI assistants
- Create a more interactive development experience

Use it whenever you feel the user would benefit from seeing their options laid out clearly!