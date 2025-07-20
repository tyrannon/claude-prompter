# Changelog

All notable changes to claude-prompter will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2025-07-20

### Added
- 🎉 Interactive chat mode with real-time streaming responses
- 💬 Full conversation management with session persistence
- 🔧 Rich command system within chat:
  - `/help` - Display available commands
  - `/clear` - Clear conversation history
  - `/save` - Save conversation to session
  - `/history` - View conversation history
  - `/suggest` - Generate contextual suggestions
  - `/template` - List and apply templates
  - `/exit` - Exit chat mode
- 🚀 Streaming API support for better user experience
- 📝 Comprehensive test suite for chat functionality
- 📚 Detailed documentation for chat feature
- 🔄 Integration with existing session and template systems

### Improved
- Enhanced error handling for API failures
- Better token counting accuracy for streamed responses
- Improved CLI user experience with colored output
- More robust session management

### Developer Experience
- New `npm run chat` script for quick access
- Exported streaming utilities for programmatic use
- TypeScript types for chat sessions
- Jest test configuration with coverage reports

## [1.0.0] - 2025-07-18

### Initial Release
- 🤖 Core prompt generation and sending to GPT-4o
- 💡 Intelligent prompt suggestions based on context
- 📊 Session management for conversation persistence
- 📋 Template system for reusable prompts
- 📈 Usage tracking and analytics
- 🔄 Batch processing capabilities
- 📜 Command history tracking
- 🎨 Beautiful CLI interface with boxed outputs
- 🔧 Comprehensive configuration options

### Features
- Generate contextual prompts for Claude
- Send prompts directly to GPT-4o
- Track token usage and costs
- Manage multiple sessions and projects
- Create and use prompt templates
- Batch process multiple prompts
- Search through conversation history
- SQLite database for data persistence

### Commands
- `prompt` - Generate or send prompts
- `suggest` - Get AI-powered suggestions
- `session` - Manage conversation sessions
- `template` - Create and use templates
- `history` - View command history
- `batch` - Process multiple prompts
- `usage` - View usage statistics
- `config` - Check configuration