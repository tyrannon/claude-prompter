# 💬 Claude Prompter Chat Feature

## Overview

The chat feature provides an interactive conversational interface with GPT-4o, complete with streaming responses, session persistence, and a rich command system. This feature transforms claude-prompter from a simple prompt tool into a full-featured AI chat assistant.

## Features

### 🚀 Core Capabilities

- **Real-time Streaming**: Watch responses appear as they're generated
- **Session Management**: Save and resume conversations across sessions
- **Command System**: Built-in commands for enhanced functionality
- **Context Persistence**: Maintains conversation history
- **Template Integration**: Apply templates to your messages
- **Smart Suggestions**: Get contextual prompt suggestions

## Usage

### Starting a Chat

```bash
# Basic chat
node dist/cli.js chat

# With custom system prompt
node dist/cli.js chat -s "You are a coding expert"

# Resume from existing session
node dist/cli.js chat --session my-project-123

# Quick start via npm
npm run chat
```

### Command Options

| Option | Description | Default |
|--------|-------------|---------|
| `-s, --system <prompt>` | Set system prompt for the session | "You are Claude, a helpful AI assistant." |
| `--session <id>` | Load existing session for context | None |
| `--stream` | Enable streaming responses | `true` |
| `--no-stream` | Disable streaming responses | N/A |
| `--save-history` | Save conversation to session | `true` |
| `--temperature <temp>` | Response creativity (0-2) | `0.7` |
| `--max-tokens <tokens>` | Maximum response length | `2000` |

### Built-in Commands

During a chat session, you can use these special commands:

| Command | Description |
|---------|-------------|
| `/help` | Display available commands |
| `/clear` | Clear conversation history |
| `/save` | Save current conversation to session |
| `/history` | View full conversation history |
| `/suggest` | Generate contextual prompt suggestions |
| `/template [name]` | List or apply templates |
| `/exit` | Exit chat mode |

## Examples

### Basic Conversation

```bash
$ npm run chat

╭───────────── 💬 Interactive Chat ──────────────╮
│                                                │
│   🤖 Claude Prompter Chat                      │
│                                                │
│   Commands:                                    │
│     /help - Show available commands            │
│     /clear - Clear conversation history        │
│     /save - Save conversation to session       │
│     /history - Show conversation history       │
│     /exit - Exit chat mode                     │
│                                                │
│   Type your message and press Enter to send.   │
│                                                │
╰────────────────────────────────────────────────╯

You: How do I implement a binary search in Python?

Assistant: I'll help you implement a binary search in Python. Binary search is an 
efficient algorithm for finding a target value in a sorted array...

[Response continues with streaming...]
```

### Using Session Context

```bash
# Create a new session
$ node dist/cli.js session start --project "Python Tutorial"
Session created: session-abc123

# Start chat with session
$ node dist/cli.js chat --session session-abc123

# Your conversation is automatically saved!
```

### Using Commands

```bash
You: Can you help me debug this React component?

Assistant: Of course! I'd be happy to help debug your React component...

You: /suggest

╭──────── 💡 Suggested Prompts ────────╮
│                                      │
│ 🛠️ Implementation Help               │
│ • Add error boundaries              │
│ • Implement proper prop validation  │
│ • Add performance optimization      │
│                                      │
│ 🔍 Deep Dive                        │
│ • Explain React lifecycle methods   │
│ • Show state management patterns    │
│                                      │
╰──────────────────────────────────────╯

You: /history

╭────── 📜 Conversation History ──────╮
│                                     │
│ [10:32:15] You: Can you help me... │
│ [10:32:18] Assistant: Of course... │
│                                     │
╰─────────────────────────────────────╯
```

## Integration with Other Features

### Session Management

The chat feature seamlessly integrates with claude-prompter's session system:

- Conversations are automatically saved when using `--session`
- Resume previous conversations with full context
- Track decisions and progress across chat sessions

### Template System

Apply templates to enhance your prompts:

```bash
You: /template code-review
✓ Template "code-review" loaded. Your next message will use this template.

You: Please review this function
# The template automatically formats your message for optimal code review
```

### Prompt Suggestions

The `/suggest` command generates contextual suggestions based on:
- Current conversation topic
- Recent messages
- Detected programming languages or frameworks

## Technical Details

### Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   CLI Input │────▶│ Chat Manager │────▶│ OpenAI API  │
└─────────────┘     └──────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐      ┌─────────────┐
                    │   Session   │      │  Streaming  │
                    │   Manager   │      │  Response   │
                    └─────────────┘      └─────────────┘
```

### Key Components

1. **ChatManager**: Orchestrates the chat session
2. **Streaming Handler**: Manages real-time response streaming
3. **Command Parser**: Processes special commands
4. **Session Integration**: Handles conversation persistence

### Error Handling

- Graceful API failure recovery
- Network interruption handling
- Session corruption protection
- User-friendly error messages

## Best Practices

1. **Use Sessions**: Always use `--session` for important conversations
2. **Regular Saves**: Use `/save` command periodically
3. **Clear Context**: Use `/clear` when switching topics
4. **Temperature Control**: Adjust temperature for different use cases:
   - `0.3` for factual, consistent responses
   - `0.7` for balanced creativity (default)
   - `1.0+` for creative brainstorming

## Troubleshooting

### Common Issues

1. **"API Key not found"**
   - Ensure OPENAI_API_KEY is set in your .env file
   - Run `node dist/cli.js config` to check configuration

2. **Streaming not working**
   - Try `--no-stream` flag as a fallback
   - Check network connectivity

3. **Session not loading**
   - Verify session ID with `node dist/cli.js session list`
   - Check if session file exists in data directory

## Future Enhancements

- Multi-model support (Claude, GPT-4, etc.)
- Voice input/output integration
- Code execution within chat
- Collaborative chat sessions
- Export conversations to various formats