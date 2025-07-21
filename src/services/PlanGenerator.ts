import { 
  ExecutionPlan, 
  Phase, 
  Step, 
  TaskAnalysis, 
  TimeEstimate
} from '../types/planning.types';
import { TaskAnalyzer } from './TaskAnalyzer';

export class PlanGenerator {
  private taskAnalyzer: TaskAnalyzer;

  constructor() {
    this.taskAnalyzer = new TaskAnalyzer();
  }

  async generatePlan(taskDescription: string, options?: {
    sessionId?: string;
    projectName?: string;
  }): Promise<ExecutionPlan> {
    // Analyze the task
    const analysis = await this.taskAnalyzer.analyzeTask(taskDescription);
    
    // Generate phases based on analysis
    const phases = this.generatePhases(taskDescription, analysis);
    
    // Calculate total estimate
    const totalEstimate = this.calculateTotalEstimate(phases);
    
    // Create the plan
    const plan: ExecutionPlan = {
      id: this.generatePlanId(),
      title: this.extractTitle(taskDescription),
      description: taskDescription,
      createdAt: new Date(),
      updatedAt: new Date(),
      status: 'draft',
      phases,
      totalEstimate,
      metadata: {
        sessionId: options?.sessionId,
        projectName: options?.projectName,
        tags: analysis.domain,
        aiModel: 'gpt-4o',
        version: 1
      }
    };

    return plan;
  }

  private generatePhases(description: string, analysis: TaskAnalysis): Phase[] {
    const phases: Phase[] = [];
    const lower = description.toLowerCase();

    // Always start with setup/planning phase for non-simple tasks
    if (analysis.complexity !== 'simple') {
      phases.push(this.createSetupPhase(description, analysis));
    }

    // Add domain-specific phases
    if (analysis.domain.includes('backend') || lower.includes('api')) {
      phases.push(this.createBackendPhase(description, analysis));
    }

    if (analysis.domain.includes('frontend') || lower.includes('ui') || lower.includes('react')) {
      phases.push(this.createFrontendPhase(description, analysis));
    }

    if (analysis.domain.includes('database') || lower.includes('database')) {
      phases.push(this.createDatabasePhase(description, analysis));
    }

    if (analysis.domain.includes('authentication') || lower.includes('auth')) {
      phases.push(this.createAuthPhase(description, analysis));
    }

    // Always add testing phase for non-simple tasks
    if (analysis.complexity !== 'simple') {
      phases.push(this.createTestingPhase(description, analysis));
    }

    // Add deployment phase for complex tasks
    if (analysis.complexity === 'complex' || analysis.complexity === 'very-complex') {
      phases.push(this.createDeploymentPhase(description, analysis));
    }

    // Order phases
    phases.forEach((phase, index) => {
      phase.order = index + 1;
    });

    return phases;
  }

  private createSetupPhase(description: string, analysis: TaskAnalysis): Phase {
    const steps: Step[] = [];
    
    steps.push({
      id: this.generateStepId(),
      title: 'Project initialization and setup',
      description: 'Set up the project structure and install dependencies',
      type: 'setup',
      status: 'pending',
      commands: this.getSetupCommands(description),
      dependsOn: [],
      order: 1,
      estimate: { minimum: 0.5, expected: 1, maximum: 2, confidence: 0.8 },
      complexity: 1,
      priority: 'critical',
      checkpoints: [
        {
          id: 'setup-1',
          description: 'Project directory created',
          completed: false
        },
        {
          id: 'setup-2',
          description: 'Dependencies installed',
          verificationCommand: 'npm list',
          completed: false
        }
      ]
    });

    steps.push({
      id: this.generateStepId(),
      title: 'Configure development environment',
      description: 'Set up linting, formatting, and development tools',
      type: 'setup',
      status: 'pending',
      dependsOn: [steps[0].id],
      order: 2,
      estimate: { minimum: 0.5, expected: 1, maximum: 1.5, confidence: 0.85 },
      complexity: 1,
      priority: 'high'
    });

    if (analysis.complexity === 'complex' || analysis.complexity === 'very-complex') {
      steps.push({
        id: this.generateStepId(),
        title: 'Design system architecture',
        description: 'Plan the overall architecture and component structure',
        type: 'design',
        status: 'pending',
        dependsOn: [],
        order: 3,
        estimate: { minimum: 1, expected: 2, maximum: 4, confidence: 0.6 },
        complexity: 3,
        priority: 'critical'
      });
    }

    return {
      id: this.generatePhaseId(),
      name: 'Project Setup & Architecture',
      description: 'Initialize project and plan architecture',
      steps,
      order: 1,
      canParallelize: false
    };
  }

  private createBackendPhase(description: string, _analysis: TaskAnalysis): Phase {
    const steps: Step[] = [];
    const lower = description.toLowerCase();

    steps.push({
      id: this.generateStepId(),
      title: 'Set up server framework',
      description: 'Initialize Express/Fastify/etc server with basic middleware',
      type: 'code',
      status: 'pending',
      dependsOn: [],
      order: 1,
      estimate: { minimum: 1, expected: 2, maximum: 3, confidence: 0.75 },
      complexity: 2,
      priority: 'critical',
      codeSnippets: [
        {
          language: 'typescript',
          code: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());`,
          description: 'Basic Express server setup'
        }
      ]
    });

    if (lower.includes('api') || lower.includes('rest')) {
      steps.push({
        id: this.generateStepId(),
        title: 'Implement API routes',
        description: 'Create RESTful API endpoints',
        type: 'code',
        status: 'pending',
        dependsOn: [steps[0].id],
        order: 2,
        estimate: { minimum: 2, expected: 4, maximum: 6, confidence: 0.7 },
        complexity: 3,
        priority: 'high'
      });
    }

    if (lower.includes('websocket') || lower.includes('real-time')) {
      steps.push({
        id: this.generateStepId(),
        title: 'Implement WebSocket connections',
        description: 'Set up Socket.io or WebSocket server',
        type: 'code',
        status: 'pending',
        dependsOn: [steps[0].id],
        order: 3,
        estimate: { minimum: 2, expected: 3, maximum: 5, confidence: 0.65 },
        complexity: 3,
        priority: 'high'
      });
    }

    return {
      id: this.generatePhaseId(),
      name: 'Backend Implementation',
      description: 'Build server-side functionality',
      steps,
      order: 2,
      canParallelize: false
    };
  }

  private createFrontendPhase(description: string, _analysis: TaskAnalysis): Phase {
    const steps: Step[] = [];
    const lower = description.toLowerCase();

    steps.push({
      id: this.generateStepId(),
      title: 'Create component structure',
      description: 'Build React/Vue/Angular components',
      type: 'code',
      status: 'pending',
      dependsOn: [],
      order: 1,
      estimate: { minimum: 2, expected: 4, maximum: 6, confidence: 0.7 },
      complexity: 2,
      priority: 'high'
    });

    steps.push({
      id: this.generateStepId(),
      title: 'Implement state management',
      description: 'Set up Redux/Context/Vuex for state management',
      type: 'code',
      status: 'pending',
      dependsOn: [steps[0].id],
      order: 2,
      estimate: { minimum: 1, expected: 2, maximum: 3, confidence: 0.75 },
      complexity: 2,
      priority: 'high'
    });

    if (lower.includes('ui') || lower.includes('design')) {
      steps.push({
        id: this.generateStepId(),
        title: 'Style components',
        description: 'Add CSS/styled-components/Tailwind styling',
        type: 'design',
        status: 'pending',
        dependsOn: [steps[0].id],
        order: 3,
        estimate: { minimum: 2, expected: 3, maximum: 5, confidence: 0.65 },
        complexity: 2,
        priority: 'medium'
      });
    }

    return {
      id: this.generatePhaseId(),
      name: 'Frontend Development',
      description: 'Build user interface components',
      steps,
      order: 3,
      canParallelize: true
    };
  }

  private createDatabasePhase(_description: string, _analysis: TaskAnalysis): Phase {
    const steps: Step[] = [];

    steps.push({
      id: this.generateStepId(),
      title: 'Design database schema',
      description: 'Create database tables and relationships',
      type: 'design',
      status: 'pending',
      dependsOn: [],
      order: 1,
      estimate: { minimum: 1, expected: 2, maximum: 3, confidence: 0.7 },
      complexity: 3,
      priority: 'critical'
    });

    steps.push({
      id: this.generateStepId(),
      title: 'Implement database models',
      description: 'Create ORM models and migrations',
      type: 'code',
      status: 'pending',
      dependsOn: [steps[0].id],
      order: 2,
      estimate: { minimum: 1, expected: 2, maximum: 3, confidence: 0.75 },
      complexity: 2,
      priority: 'high'
    });

    return {
      id: this.generatePhaseId(),
      name: 'Database Setup',
      description: 'Design and implement database layer',
      steps,
      order: 2,
      canParallelize: false
    };
  }

  private createAuthPhase(description: string, _analysis: TaskAnalysis): Phase {
    const steps: Step[] = [];
    const lower = description.toLowerCase();

    steps.push({
      id: this.generateStepId(),
      title: 'Implement authentication flow',
      description: 'Create login/signup functionality',
      type: 'code',
      status: 'pending',
      dependsOn: [],
      order: 1,
      estimate: { minimum: 2, expected: 4, maximum: 6, confidence: 0.65 },
      complexity: 3,
      priority: 'critical'
    });

    if (lower.includes('jwt') || lower.includes('token')) {
      steps.push({
        id: this.generateStepId(),
        title: 'Implement JWT token management',
        description: 'Create token generation and validation',
        type: 'code',
        status: 'pending',
        dependsOn: [steps[0].id],
        order: 2,
        estimate: { minimum: 1, expected: 2, maximum: 3, confidence: 0.7 },
        complexity: 3,
        priority: 'critical'
      });
    }

    return {
      id: this.generatePhaseId(),
      name: 'Authentication System',
      description: 'Implement user authentication',
      steps,
      order: 4,
      canParallelize: false
    };
  }

  private createTestingPhase(_description: string, analysis: TaskAnalysis): Phase {
    const steps: Step[] = [];

    steps.push({
      id: this.generateStepId(),
      title: 'Write unit tests',
      description: 'Create unit tests for core functionality',
      type: 'test',
      status: 'pending',
      dependsOn: [],
      order: 1,
      estimate: { minimum: 2, expected: 4, maximum: 6, confidence: 0.6 },
      complexity: 2,
      priority: 'high'
    });

    if (analysis.complexity !== 'simple') {
      steps.push({
        id: this.generateStepId(),
        title: 'Integration testing',
        description: 'Test component interactions and API endpoints',
        type: 'test',
        status: 'pending',
        dependsOn: [steps[0].id],
        order: 2,
        estimate: { minimum: 2, expected: 3, maximum: 5, confidence: 0.65 },
        complexity: 3,
        priority: 'high'
      });
    }

    return {
      id: this.generatePhaseId(),
      name: 'Testing & Quality Assurance',
      description: 'Ensure code quality and functionality',
      steps,
      order: 5,
      canParallelize: true
    };
  }

  private createDeploymentPhase(_description: string, _analysis: TaskAnalysis): Phase {
    const steps: Step[] = [];

    steps.push({
      id: this.generateStepId(),
      title: 'Prepare for deployment',
      description: 'Build production assets and configure environment',
      type: 'deploy',
      status: 'pending',
      dependsOn: [],
      order: 1,
      estimate: { minimum: 1, expected: 2, maximum: 3, confidence: 0.7 },
      complexity: 2,
      priority: 'high'
    });

    steps.push({
      id: this.generateStepId(),
      title: 'Deploy to production',
      description: 'Deploy application to hosting platform',
      type: 'deploy',
      status: 'pending',
      dependsOn: [steps[0].id],
      order: 2,
      estimate: { minimum: 1, expected: 2, maximum: 4, confidence: 0.65 },
      complexity: 3,
      priority: 'critical'
    });

    return {
      id: this.generatePhaseId(),
      name: 'Deployment',
      description: 'Deploy to production environment',
      steps,
      order: 6,
      canParallelize: false
    };
  }

  private getSetupCommands(description: string): string[] {
    const commands: string[] = [];
    const lower = description.toLowerCase();

    if (lower.includes('react')) {
      commands.push('npx create-react-app my-app --template typescript');
      commands.push('cd my-app');
      commands.push('npm install axios react-router-dom');
    } else if (lower.includes('node') || lower.includes('express')) {
      commands.push('mkdir my-project && cd my-project');
      commands.push('npm init -y');
      commands.push('npm install express cors helmet dotenv');
      commands.push('npm install -D typescript @types/node @types/express nodemon');
    } else if (lower.includes('next')) {
      commands.push('npx create-next-app@latest my-app --typescript');
      commands.push('cd my-app');
    }

    return commands;
  }

  private calculateTotalEstimate(phases: Phase[]): TimeEstimate {
    let minTotal = 0;
    let expectedTotal = 0;
    let maxTotal = 0;
    let stepCount = 0;

    phases.forEach(phase => {
      phase.steps.forEach(step => {
        minTotal += step.estimate.minimum;
        expectedTotal += step.estimate.expected;
        maxTotal += step.estimate.maximum;
        stepCount++;
      });
    });

    // Average confidence across all steps
    const avgConfidence = phases.reduce((sum, phase) => 
      sum + phase.steps.reduce((stepSum, step) => 
        stepSum + step.estimate.confidence, 0
      ), 0
    ) / stepCount;

    return {
      minimum: minTotal,
      expected: expectedTotal,
      maximum: maxTotal,
      confidence: avgConfidence
    };
  }

  private extractTitle(description: string): string {
    // Try to extract a concise title from the description
    const firstSentence = description.split(/[.!?]/)[0];
    const words = firstSentence.split(' ');
    
    if (words.length <= 8) {
      return firstSentence;
    }
    
    // Look for key action words
    const actionWords = ['build', 'create', 'implement', 'develop', 'design', 'add', 'integrate'];
    const actionIndex = words.findIndex(word => 
      actionWords.includes(word.toLowerCase())
    );
    
    if (actionIndex !== -1 && actionIndex < 5) {
      return words.slice(actionIndex, Math.min(actionIndex + 6, words.length)).join(' ');
    }
    
    return words.slice(0, 6).join(' ') + '...';
  }

  private generatePlanId(): string {
    return `plan-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
  }

  private generatePhaseId(): string {
    return `phase-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateStepId(): string {
    return `step-${Math.random().toString(36).substr(2, 9)}`;
  }
}