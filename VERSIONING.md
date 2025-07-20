# Versioning Strategy for claude-prompter

## Semantic Versioning (SemVer)

We follow semantic versioning: `MAJOR.MINOR.PATCH`

- **MAJOR** (1.x.x): Breaking changes that require code updates
- **MINOR** (x.1.x): New features that are backward compatible
- **PATCH** (x.x.1): Bug fixes and minor improvements

## Current Version: 1.0.0

### Upcoming 1.1.0 Release
- ✅ Interactive chat mode with streaming
- ✅ Session persistence improvements
- ✅ Command system (/suggest, /help, etc.)
- ✅ Template integration foundation

## For Dependent Applications

### Package.json Dependencies

```json
// Permitagent, Stylemuse, etc. can use:
{
  "dependencies": {
    // Exact version (manual updates required)
    "@kaiyakramer/claude-prompter": "1.0.0"
    
    // Auto-update patch versions (bug fixes)
    "@kaiyakramer/claude-prompter": "~1.0.0"
    
    // Auto-update minor versions (new features)
    "@kaiyakramer/claude-prompter": "^1.0.0"
  }
}
```

### Update Instructions

1. **Check current version**:
   ```bash
   npm list @kaiyakramer/claude-prompter
   ```

2. **Update to latest**:
   ```bash
   npm update @kaiyakramer/claude-prompter
   ```

3. **View available versions**:
   ```bash
   npm view @kaiyakramer/claude-prompter versions
   ```

## Publishing Workflow

1. **Test thoroughly**:
   ```bash
   npm test
   npm run build
   ```

2. **Update version**:
   ```bash
   # For new features (1.0.0 → 1.1.0)
   npm version minor -m "feat: Add interactive chat mode"
   
   # For bug fixes (1.1.0 → 1.1.1)
   npm version patch -m "fix: Resolve streaming issue"
   
   # For breaking changes (1.1.0 → 2.0.0)
   npm version major -m "BREAKING: Changed API structure"
   ```

3. **Publish to npm**:
   ```bash
   npm publish
   ```

4. **Create GitHub release**:
   ```bash
   git push --tags
   # Then create release on GitHub with changelog
   ```

## Changelog Format

### Version 1.1.0 (Upcoming)
**Features:**
- Interactive chat mode with GPT-4o
- Streaming response support
- Session-based conversation history
- Contextual prompt suggestions in chat
- Template system integration

**Improvements:**
- Better error handling for API failures
- Enhanced token counting accuracy
- Improved CLI user experience

**Developer Experience:**
- New `createChatCommand` export for integration
- Streaming API utilities exported
- TypeScript types for chat sessions