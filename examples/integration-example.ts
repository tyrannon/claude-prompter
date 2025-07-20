// Example: How permitagent or stylemuse would use claude-prompter's new features

import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Example 1: Using claude-prompter CLI directly
async function useClaudePrompterCLI() {
  // Start a chat session
  const { stdout } = await execAsync('npx @kaiyakramer/claude-prompter chat --help');
  console.log('Chat features available:', stdout);
  
  // Generate suggestions
  const suggestions = await execAsync(
    'npx @kaiyakramer/claude-prompter suggest -t "permit management system" --code'
  );
  console.log('Suggestions:', suggestions.stdout);
}

// Example 2: Programmatic usage (if claude-prompter exports APIs)
import { 
  generatePromptSuggestions, 
  createChatSession,
  streamOpenAI 
} from '@kaiyakramer/claude-prompter';

async function useClaudePrompterAPI() {
  // Use suggestion generator
  const suggestions = generatePromptSuggestions({
    topic: 'permit workflow automation',
    techStack: ['typescript', 'react'],
    currentTask: 'building permit dashboard'
  });
  
  // Create a chat session
  const chat = await createChatSession({
    systemPrompt: 'You are a permit management assistant',
    sessionId: 'permit-session-123'
  });
  
  // Stream responses
  await streamOpenAI(
    [
      { role: 'system', content: 'You are a permit expert' },
      { role: 'user', content: 'How do I process a building permit?' }
    ],
    (chunk) => process.stdout.write(chunk),
    { temperature: 0.7 }
  );
}

// Example 3: Extending claude-prompter in your app
class PermitAgentCLI extends Command {
  constructor() {
    super();
    
    this.name('permit-agent')
      .description('Permit management with AI assistance')
      .version('1.0.0');
    
    // Add claude-prompter powered chat
    this.command('ai-chat')
      .description('Chat with permit AI assistant')
      .action(async () => {
        // Delegate to claude-prompter
        await execAsync('npx @kaiyakramer/claude-prompter chat --system "You are a permit expert"');
      });
    
    // Add permit-specific suggestions
    this.command('suggest-permit')
      .description('Get AI suggestions for permit workflows')
      .option('-t, --type <type>', 'Permit type (building, electrical, etc.)')
      .action(async (options) => {
        const { stdout } = await execAsync(
          `npx @kaiyakramer/claude-prompter suggest -t "${options.type} permit workflow" --task-type api-integration`
        );
        console.log(stdout);
      });
  }
}

// Example 4: Package.json integration
const packageJsonExample = {
  "name": "permitagent",
  "version": "2.0.0",
  "dependencies": {
    "@kaiyakramer/claude-prompter": "^1.1.0", // Will get updates automatically
    "commander": "^11.0.0"
  },
  "scripts": {
    // Expose claude-prompter features through npm scripts
    "ai:chat": "claude-prompter chat",
    "ai:suggest": "claude-prompter suggest",
    "ai:session": "claude-prompter session"
  }
};

export { PermitAgentCLI, useClaudePrompterCLI, useClaudePrompterAPI };