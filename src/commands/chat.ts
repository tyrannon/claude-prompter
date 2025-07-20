import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import boxen from 'boxen';
import { SessionManager } from '../data/SessionManager';
import { TemplateManager } from '../data/TemplateManager';
import { CommunicationBridge } from '../data/CommunicationBridge';
import { callOpenAI, streamOpenAI, OpenAIError } from '../utils/openaiClient';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

class ChatManager {
  private messages: ChatMessage[] = [];
  private systemPrompt: string;
  private sessionManager: SessionManager;
  public templateManager: TemplateManager;
  private bridge: CommunicationBridge;
  private currentSessionId?: string;
  private currentSession?: any;
  public pendingTemplate?: any;

  constructor(
    sessionManager: SessionManager,
    templateManager: TemplateManager,
    bridge: CommunicationBridge,
    systemPrompt: string = 'You are Claude, a helpful AI assistant.'
  ) {
    this.sessionManager = sessionManager;
    this.templateManager = templateManager;
    this.bridge = bridge;
    this.systemPrompt = systemPrompt;
  }

  async initializeFromSession(sessionId: string): Promise<void> {
    const session = await this.sessionManager.loadSession(sessionId);
    if (session) {
      this.currentSessionId = sessionId;
      this.currentSession = session;
      await this.bridge.initializeSession(sessionId);
      
      // Convert ConversationEntry history to ChatMessage format
      if (session.history && session.history.length > 0) {
        session.history.forEach(entry => {
          // Add user message
          this.messages.push({
            role: 'user',
            content: entry.prompt,
            timestamp: new Date(entry.timestamp)
          });
          // Add assistant response
          this.messages.push({
            role: 'assistant',
            content: entry.response,
            timestamp: new Date(entry.timestamp)
          });
        });
      }
    }
  }

  addMessage(role: 'user' | 'assistant', content: string): void {
    const message: ChatMessage = {
      role,
      content,
      timestamp: new Date()
    };
    this.messages.push(message);
  }

  getConversationContext(): Array<{role: string; content: string}> {
    const context = [
      { role: 'system', content: this.systemPrompt },
      ...this.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))
    ];
    return context;
  }

  async saveConversation(): Promise<void> {
    if (this.currentSessionId && this.currentSession) {
      // Convert chat messages to ConversationEntry format
      const newEntries: any[] = [];
      
      // Process messages in pairs (user + assistant)
      for (let i = 0; i < this.messages.length; i += 2) {
        const userMsg = this.messages[i];
        const assistantMsg = this.messages[i + 1];
        
        if (userMsg && assistantMsg && userMsg.role === 'user' && assistantMsg.role === 'assistant') {
          newEntries.push({
            prompt: userMsg.content,
            response: assistantMsg.content,
            timestamp: assistantMsg.timestamp,
            source: 'gpt-4o' as const
          });
        }
      }
      
      // Update session history
      this.currentSession.history = newEntries;
      await this.sessionManager.saveSession(this.currentSession);
    }
  }

  formatChatHistory(): string {
    if (this.messages.length === 0) {
      return chalk.gray('No messages yet. Start typing to begin the conversation.');
    }

    return this.messages.map(msg => {
      const timestamp = msg.timestamp.toLocaleTimeString();
      const role = msg.role === 'user' ? chalk.cyan('You') : chalk.green('Assistant');
      const content = msg.role === 'user' 
        ? chalk.white(msg.content)
        : chalk.gray(msg.content);
      
      return `${chalk.dim(`[${timestamp}]`)} ${role}: ${content}`;
    }).join('\n\n');
  }
}

export function createChatCommand(): Command {
  const command = new Command('chat')
    .description('Start an interactive chat session with GPT-4o')
    .option('-s, --system <system>', 'System prompt for the chat session')
    .option('--session <id>', 'Use an existing session for context')
    .option('--stream', 'Enable streaming responses (default: true)', true)
    .option('--no-stream', 'Disable streaming responses')
    .option('--save-history', 'Save conversation history to session', true)
    .option('--temperature <temp>', 'Temperature for responses (0-2)', '0.7')
    .option('--max-tokens <tokens>', 'Max tokens per response', '2000')
    .action(async (options) => {
      const sessionManager = new SessionManager();
      const templateManager = new TemplateManager();
      const bridge = new CommunicationBridge(sessionManager, templateManager);
      
      const chatManager = new ChatManager(
        sessionManager,
        templateManager,
        bridge,
        options.system
      );

      if (options.session) {
        await chatManager.initializeFromSession(options.session);
      }

      console.clear();
      console.log(boxen(
        chalk.bold('🤖 Claude Prompter Chat\n\n') +
        chalk.gray('Commands:\n') +
        chalk.cyan('  /help') + ' - Show available commands\n' +
        chalk.cyan('  /clear') + ' - Clear conversation history\n' +
        chalk.cyan('  /save') + ' - Save conversation to session\n' +
        chalk.cyan('  /history') + ' - Show conversation history\n' +
        chalk.cyan('  /exit') + ' - Exit chat mode\n\n' +
        chalk.yellow('Type your message and press Enter to send.'),
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
          title: '💬 Interactive Chat',
          titleAlignment: 'center'
        }
      ));

      let continueChat = true;

      while (continueChat) {
        const { message } = await inquirer.prompt([
          {
            type: 'input',
            name: 'message',
            message: chalk.cyan('You:'),
            prefix: ''
          }
        ]);

        if (message.startsWith('/')) {
          const command = message.toLowerCase().trim();
          
          switch (command) {
            case '/help':
              console.log(boxen(
                chalk.bold('Available Commands:\n\n') +
                chalk.cyan('/help') + ' - Show this help message\n' +
                chalk.cyan('/clear') + ' - Clear conversation history\n' +
                chalk.cyan('/save') + ' - Save conversation to session\n' +
                chalk.cyan('/history') + ' - Show full conversation history\n' +
                chalk.cyan('/suggest') + ' - Generate prompt suggestions\n' +
                chalk.cyan('/template <name>') + ' - Apply a template\n' +
                chalk.cyan('/exit') + ' - Exit chat mode',
                {
                  padding: 1,
                  borderStyle: 'single',
                  borderColor: 'yellow'
                }
              ));
              break;

            case '/clear':
              chatManager['messages'] = [];
              console.clear();
              console.log(chalk.green('✓ Conversation cleared'));
              break;

            case '/save':
              if (options.session) {
                await chatManager.saveConversation();
                console.log(chalk.green('✓ Conversation saved to session'));
              } else {
                console.log(chalk.yellow('No session specified. Use --session flag to enable saving.'));
              }
              break;

            case '/history':
              console.log(boxen(
                chatManager.formatChatHistory(),
                {
                  title: '📜 Conversation History',
                  padding: 1,
                  borderStyle: 'single',
                  borderColor: 'blue'
                }
              ));
              break;

            case '/exit':
              continueChat = false;
              if (options.saveHistory && options.session) {
                await chatManager.saveConversation();
              }
              console.log(chalk.cyan('\n👋 Thanks for chatting! Goodbye!'));
              break;

            case '/suggest':
              // Generate suggestions based on conversation context
              const topic = chatManager['messages'].length > 0 
                ? chatManager['messages'][chatManager['messages'].length - 1].content 
                : 'general conversation';
              
              console.log(chalk.cyan('\n🔄 Generating suggestions based on conversation...\n'));
              
              // Import the suggestion utilities
              const { generatePromptSuggestions, formatSuggestionsForCLI } = await import('../utils/promptSuggestions');
              
              const suggestions = generatePromptSuggestions({
                topic: topic,
                currentTask: 'chat conversation'
              });
              
              console.log(boxen(
                formatSuggestionsForCLI(suggestions),
                {
                  title: '💡 Suggested Prompts',
                  padding: 1,
                  borderStyle: 'single',
                  borderColor: 'yellow'
                }
              ));
              break;

            default:
              if (command.startsWith('/template')) {
                const templateName = command.split(' ')[1];
                if (templateName) {
                  // For now, just show template functionality is planned
                  console.log(chalk.yellow(`Template feature planned: ${templateName}`));
                  /*const template = await templateManager.getTemplate(templateName);
                  if (template) {
                    // Apply template to next message
                    console.log(chalk.green(`✓ Template "${templateName}" loaded. Your next message will use this template.`));
                    // Store template for next message
                    chatManager.pendingTemplate = template;
                  } else {
                    console.log(chalk.red(`Template "${templateName}" not found`));
                  }*/
                } else {
                  const templates = await chatManager.templateManager.listTemplates();
                  if (templates.length > 0) {
                    console.log(chalk.cyan('Available templates:'));
                    templates.forEach(t => {
                      console.log(`  - ${chalk.yellow(t.name)}: ${chalk.gray(t.description || 'No description')}`);
                    });
                  } else {
                    console.log(chalk.yellow('No templates available'));
                  }
                }
              } else {
                console.log(chalk.red(`Unknown command: ${command}`));
              }
          }
          continue;
        }

        // Apply template if pending
        let processedMessage = message;
        if ((chatManager as any).pendingTemplate) {
          const template = (chatManager as any).pendingTemplate;
          processedMessage = template.content.replace(/\{\{message\}\}/g, message);
          (chatManager as any).pendingTemplate = undefined;
          console.log(chalk.dim('(Template applied)\n'));
        }
        
        chatManager.addMessage('user', processedMessage);

        try {
          if (options.stream) {
            const spinner = ora({
              text: 'Assistant is thinking...',
              color: 'cyan',
              spinner: 'dots'
            }).start();

            let fullResponse = '';
            let firstChunk = true;

            await streamOpenAI(
              chatManager.getConversationContext(),
              (chunk) => {
                if (firstChunk) {
                  spinner.stop();
                  process.stdout.write(chalk.green('Assistant: '));
                  firstChunk = false;
                }
                process.stdout.write(chalk.gray(chunk));
                fullResponse += chunk;
              },
              {
                temperature: parseFloat(options.temperature),
                max_tokens: parseInt(options.maxTokens),
                command: 'chat'
              }
            );

            console.log('\n');
            chatManager.addMessage('assistant', fullResponse);
          } else {
            const spinner = ora({
              text: 'Assistant is thinking...',
              color: 'cyan',
              spinner: 'dots'
            }).start();

            const context = chatManager.getConversationContext();
            const lastMessage = context[context.length - 1].content;
            const systemPrompt = context[0].content;
            
            const response = await callOpenAI(
              lastMessage,
              systemPrompt,
              {
                command: 'chat'
              }
            );

            spinner.stop();
            console.log(chalk.green('Assistant: ') + chalk.gray(response));
            console.log();
            
            chatManager.addMessage('assistant', response);
          }

          if (options.saveHistory && options.session) {
            await chatManager.saveConversation();
          }
        } catch (error) {
          if (error instanceof OpenAIError) {
            console.error(chalk.red(`\n❌ Error: ${error.message}`));
            if (error.details) {
              console.error(chalk.gray(`Details: ${JSON.stringify(error.details, null, 2)}`));
            }
          } else {
            console.error(chalk.red(`\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`));
          }
        }
      }
    });

  return command;
}