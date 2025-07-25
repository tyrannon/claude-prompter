import chalk from 'chalk';
import { PromptSuggestion } from './promptSuggestions';

/**
 * Represents a workflow chain of Claude Code subagents
 */
export interface SubagentWorkflow {
  id: string;
  name: string;
  description: string;
  subagents: string[];
  estimatedTime: string;
  complexity: 'simple' | 'moderate' | 'complex';
  benefits: string[];
  useCase: string;
  prompt: string;
}

/**
 * Available Claude Code subagents with their capabilities
 */
export const AVAILABLE_SUBAGENTS = {
  'code-reviewer': {
    name: 'Code Reviewer',
    description: 'Expert code review specialist for quality analysis and improvements',
    capabilities: ['code quality', 'best practices', 'security review', 'refactoring suggestions'],
    icon: '🔍'
  },
  'debugger': {
    name: 'Debugger',
    description: 'Master debugging specialist for systematic issue resolution',
    capabilities: ['bug identification', 'root cause analysis', 'troubleshooting', 'error patterns'],
    icon: '🐛'
  },
  'data-scientist': {
    name: 'Data Scientist',
    description: 'Expert data analysis, ML, and statistical insights',
    capabilities: ['data analysis', 'machine learning', 'statistical modeling', 'visualization'],
    icon: '📊'
  },
  'test-generator': {
    name: 'Test Generator',
    description: 'Comprehensive test case generation and quality assurance',
    capabilities: ['unit tests', 'integration tests', 'test strategy', 'coverage analysis'],
    icon: '🧪'
  },
  'security-analyst': {
    name: 'Security Analyst',
    description: 'Security vulnerability assessment and defensive practices',
    capabilities: ['vulnerability scanning', 'threat modeling', 'security review', 'compliance'],
    icon: '🔒'
  },
  'performance-optimizer': {
    name: 'Performance Optimizer',
    description: 'Performance bottleneck identification and system optimization',
    capabilities: ['performance analysis', 'optimization', 'scalability', 'monitoring'],
    icon: '⚡'
  }
} as const;

/**
 * Pre-defined workflow patterns for common development scenarios
 */
export const WORKFLOW_PATTERNS: SubagentWorkflow[] = [
  {
    id: 'full-quality-pipeline',
    name: 'Complete Quality Assurance Pipeline',
    description: 'Comprehensive code quality workflow from review to testing',
    subagents: ['code-reviewer', 'security-analyst', 'test-generator'],
    estimatedTime: '45-60 minutes',
    complexity: 'moderate',
    benefits: ['Code quality assurance', 'Security validation', 'Comprehensive testing', 'Production readiness'],
    useCase: 'New feature development or major code changes',
    prompt: 'First use the code-reviewer to analyze code quality and best practices, then use the security-analyst to identify potential vulnerabilities, and finally use the test-generator to create comprehensive test coverage'
  },
  {
    id: 'performance-investigation',
    name: 'Performance Issue Resolution',
    description: 'Systematic approach to identifying and resolving performance problems',
    subagents: ['debugger', 'performance-optimizer'],
    estimatedTime: '60-90 minutes',
    complexity: 'complex',
    benefits: ['Root cause identification', 'Performance optimization', 'System understanding', 'Scalability improvements'],
    useCase: 'Performance bottlenecks, slow response times, or scalability issues',
    prompt: 'First use the debugger to investigate the performance issue and identify root causes, then use the performance-optimizer to implement optimizations and improvements'
  },
  {
    id: 'security-first-development',
    name: 'Security-First Development Workflow',
    description: 'Security-focused development process with quality assurance',
    subagents: ['security-analyst', 'code-reviewer', 'test-generator'],
    estimatedTime: '50-70 minutes',
    complexity: 'moderate',
    benefits: ['Security validation', 'Threat mitigation', 'Secure coding practices', 'Compliance assurance'],
    useCase: 'Authentication systems, payment processing, or sensitive data handling',
    prompt: 'First use the security-analyst to audit for vulnerabilities and security best practices, then use the code-reviewer to ensure secure coding standards, and finally use the test-generator to create security-focused tests'
  },
  {
    id: 'data-driven-development',
    name: 'Data-Driven Feature Development',
    description: 'Analytics-focused development with performance and security considerations',
    subagents: ['data-scientist', 'performance-optimizer', 'security-analyst'],
    estimatedTime: '75-100 minutes',
    complexity: 'complex',
    benefits: ['Data insights', 'Performance optimization', 'Secure data handling', 'Analytics implementation'],
    useCase: 'Dashboard development, analytics features, or data processing systems',
    prompt: 'First use the data-scientist to analyze data patterns and requirements, then use the performance-optimizer to ensure efficient data processing, and finally use the security-analyst to secure data access and handling'
  },
  {
    id: 'bug-resolution-workflow',
    name: 'Systematic Bug Resolution',
    description: 'Complete bug investigation and prevention workflow',
    subagents: ['debugger', 'test-generator', 'code-reviewer'],
    estimatedTime: '40-60 minutes',
    complexity: 'moderate',
    benefits: ['Bug resolution', 'Root cause analysis', 'Regression prevention', 'Code quality improvement'],
    useCase: 'Production bugs, test failures, or unexpected application behavior',
    prompt: 'First use the debugger to identify and resolve the bug, then use the test-generator to create regression tests, and finally use the code-reviewer to prevent similar issues'
  },
  {
    id: 'optimization-and-scaling',
    name: 'Performance Optimization & Scaling',
    description: 'Comprehensive performance improvement workflow',
    subagents: ['performance-optimizer', 'code-reviewer', 'data-scientist'],
    estimatedTime: '80-120 minutes',
    complexity: 'complex',
    benefits: ['Performance improvements', 'Code optimization', 'Data-driven decisions', 'Scalability planning'],
    useCase: 'Application slowdowns, scaling preparations, or optimization requirements',
    prompt: 'First use the performance-optimizer to identify bottlenecks and optimization opportunities, then use the code-reviewer to improve code efficiency, and finally use the data-scientist to analyze performance metrics and trends'
  },
  {
    id: 'api-development-workflow',
    name: 'Complete API Development',
    description: 'End-to-end API development with security and testing',
    subagents: ['code-reviewer', 'security-analyst', 'test-generator', 'performance-optimizer'],
    estimatedTime: '90-120 minutes',
    complexity: 'complex',
    benefits: ['API quality', 'Security compliance', 'Comprehensive testing', 'Performance optimization'],
    useCase: 'New API development, API refactoring, or API security hardening',
    prompt: 'First use the code-reviewer to ensure API design best practices, then use the security-analyst to implement security measures, use the test-generator to create comprehensive API tests, and finally use the performance-optimizer to ensure optimal API performance'
  },
  {
    id: 'legacy-code-modernization',
    name: 'Legacy Code Modernization',
    description: 'Systematic approach to upgrading and improving legacy systems',
    subagents: ['code-reviewer', 'security-analyst', 'performance-optimizer', 'test-generator'],
    estimatedTime: '100-150 minutes',
    complexity: 'complex',
    benefits: ['Code modernization', 'Security improvements', 'Performance gains', 'Test coverage'],
    useCase: 'Legacy system upgrades, technical debt reduction, or code refactoring',
    prompt: 'First use the code-reviewer to assess code quality and modernization needs, then use the security-analyst to identify security improvements, use the performance-optimizer to enhance system performance, and finally use the test-generator to add comprehensive test coverage'
  }
];

/**
 * Generate subagent workflow suggestions based on context
 */
export function generateSubagentWorkflowSuggestions(
  topic: string,
  analysis: {
    codeGenerated?: boolean;
    language?: string;
    complexity?: 'simple' | 'moderate' | 'complex';
    taskType?: string;
  }
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  
  // Filter workflows based on context
  const relevantWorkflows = WORKFLOW_PATTERNS.filter(workflow => {
    // Match complexity if specified
    if (analysis.complexity && workflow.complexity !== analysis.complexity) {
      // Allow one level of complexity difference
      const complexityLevels = { simple: 0, moderate: 1, complex: 2 };
      const requestedLevel = complexityLevels[analysis.complexity];
      const workflowLevel = complexityLevels[workflow.complexity];
      if (Math.abs(requestedLevel - workflowLevel) > 1) {
        return false;
      }
    }
    
    // Match task type
    if (analysis.taskType) {
      const taskTypeMatching = {
        'api-integration': ['api-development-workflow', 'security-first-development', 'performance-investigation'],
        'ui-component': ['full-quality-pipeline', 'performance-optimization', 'bug-resolution-workflow'],
        'cli-tool': ['full-quality-pipeline', 'performance-optimization', 'security-first-development'],
        'backend-service': ['api-development-workflow', 'performance-investigation', 'security-first-development'],
        'data-processing': ['data-driven-development', 'performance-optimization', 'security-first-development'],
        'authentication': ['security-first-development', 'api-development-workflow', 'full-quality-pipeline'],
        'database': ['data-driven-development', 'performance-investigation', 'security-first-development']
      };
      
      const matchingWorkflows = taskTypeMatching[analysis.taskType as keyof typeof taskTypeMatching] || [];
      if (matchingWorkflows.length > 0 && !matchingWorkflows.includes(workflow.id)) {
        return false;
      }
    }
    
    return true;
  });
  
  // Convert workflows to prompt suggestions
  relevantWorkflows.slice(0, 4).forEach((workflow) => {
    const subagentIcons = workflow.subagents.map(id => AVAILABLE_SUBAGENTS[id as keyof typeof AVAILABLE_SUBAGENTS]?.icon || '🤖').join(' → ');
    
    suggestions.push({
      id: `workflow-${workflow.id}`,
      title: `${workflow.name} ${subagentIcons}`,
      prompt: workflow.prompt,
      category: 'implementation',
      rationale: `${workflow.benefits.join(', ')} (${workflow.estimatedTime})`
    });
  });
  
  // Add some quick single-subagent workflows
  if (analysis.codeGenerated) {
    suggestions.push({
      id: 'single-review',
      title: 'Quick Code Review 🔍',
      prompt: 'Use the code-reviewer to analyze this code for quality, best practices, and potential improvements',
      category: 'follow-up',
      rationale: 'Fast quality check for new code (15-20 minutes)'
    });
  }
  
  if (topic.toLowerCase().includes('bug') || topic.toLowerCase().includes('error') || topic.toLowerCase().includes('issue')) {
    suggestions.push({
      id: 'single-debug',
      title: 'Debug Investigation 🐛',
      prompt: 'Use the debugger to systematically investigate this issue and identify the root cause',
      category: 'follow-up',
      rationale: 'Focused debugging approach (20-30 minutes)'
    });
  }
  
  if (topic.toLowerCase().includes('performance') || topic.toLowerCase().includes('slow') || topic.toLowerCase().includes('optimization')) {
    suggestions.push({
      id: 'single-optimize',
      title: 'Performance Analysis ⚡',
      prompt: 'Use the performance-optimizer to identify bottlenecks and optimization opportunities',
      category: 'deep-dive',
      rationale: 'Performance-focused analysis (25-35 minutes)'
    });
  }
  
  return suggestions;
}

/**
 * Generate contextual subagent workflow suggestions based on recent session patterns
 */
export function generateContextualWorkflowSuggestions(
  topic: string,
  sessionHistory?: Array<{ content: string; timestamp: Date }>,
  userPatterns?: Array<{ pattern: string; frequency: number }>
): PromptSuggestion[] {
  const suggestions: PromptSuggestion[] = [];
  
  // Analyze session history for patterns
  if (sessionHistory && sessionHistory.length > 0) {
    const recentContent = sessionHistory.slice(0, 5).map(s => s.content.toLowerCase()).join(' ');
    
    // Pattern matching for workflow recommendations
    if (recentContent.includes('security') || recentContent.includes('auth') || recentContent.includes('vulnerable')) {
      suggestions.push({
        id: 'security-focused',
        title: 'Security-Focused Workflow 🔒 → 🔍 → 🧪',
        prompt: `Based on your recent security discussions, use the security-analyst to audit ${topic} for vulnerabilities, then the code-reviewer to ensure secure coding practices, and finally the test-generator to create security tests`,
        category: 'follow-up',
        rationale: 'Builds on your recent security work (50-70 minutes)'
      });
    }
    
    if (recentContent.includes('performance') || recentContent.includes('slow') || recentContent.includes('optimize')) {
      suggestions.push({
        id: 'performance-focused',
        title: 'Performance Optimization Chain ⚡ → 🔍 → 📊',
        prompt: `Following up on your performance concerns, use the performance-optimizer to identify bottlenecks in ${topic}, then the code-reviewer to suggest code improvements, and the data-scientist to analyze performance metrics`,
        category: 'follow-up',
        rationale: 'Extends your performance optimization work (80-100 minutes)'
      });
    }
    
    if (recentContent.includes('test') || recentContent.includes('bug') || recentContent.includes('fail')) {
      suggestions.push({
        id: 'quality-focused',
        title: 'Quality Assurance Workflow 🐛 → 🧪 → 🔍',
        prompt: `Building on your testing and debugging work, use the debugger to resolve any issues in ${topic}, then the test-generator to create comprehensive tests, and the code-reviewer to ensure overall quality`,
        category: 'follow-up',
        rationale: 'Comprehensive quality improvement (40-60 minutes)'
      });
    }
  }
  
  // Pattern-based suggestions
  if (userPatterns && userPatterns.length > 0) {
    const topPatterns = userPatterns.sort((a, b) => b.frequency - a.frequency).slice(0, 3);
    
    topPatterns.forEach(pattern => {
      if (pattern.pattern.includes('error-handling')) {
        suggestions.push({
          id: 'error-handling-chain',
          title: 'Error Handling Mastery 🔍 → 🧪 → 🐛',
          prompt: `Since you've mastered error-handling patterns (used ${pattern.frequency}x), use the code-reviewer to enhance error handling, the test-generator to create error scenario tests, and the debugger to validate error recovery`,
          category: 'alternative',
          rationale: `Leverages your error-handling expertise (${pattern.frequency} uses)`
        });
      }
    });
  }
  
  return suggestions;
}

/**
 * Format subagent workflow suggestions for CLI display
 */
export function formatSubagentWorkflowsForCLI(workflows: SubagentWorkflow[]): string {
  let output = chalk.bold('\n🔗 Subagent Workflow Chains\n');
  output += chalk.gray('─'.repeat(50)) + '\n';
  
  workflows.forEach((workflow, index) => {
    const subagentChain = workflow.subagents
      .map(id => AVAILABLE_SUBAGENTS[id as keyof typeof AVAILABLE_SUBAGENTS]?.icon || '🤖')
      .join(' → ');
    
    const complexityColor = workflow.complexity === 'simple' ? 'green' : 
                           workflow.complexity === 'moderate' ? 'yellow' : 'red';
    
    output += `${index + 1}. ${chalk.bold(workflow.name)} ${subagentChain}\n`;
    output += `   ${chalk.gray(workflow.description)}\n`;
    output += `   ${chalk.blue('Complexity:')} ${chalk[complexityColor](workflow.complexity)} | `;
    output += `${chalk.blue('Time:')} ${workflow.estimatedTime}\n`;
    output += `   ${chalk.green('Benefits:')} ${workflow.benefits.slice(0, 2).join(', ')}\n`;
    output += `   ${chalk.cyan('Use case:')} ${workflow.useCase}\n`;
    output += `   ${chalk.magenta('Workflow:')} ${workflow.prompt}\n\n`;
  });
  
  return output;
}

/**
 * Get workflow by ID
 */
export function getWorkflowById(id: string): SubagentWorkflow | undefined {
  return WORKFLOW_PATTERNS.find(workflow => workflow.id === id);
}

/**
 * Generate workflow suggestions based on topic analysis
 */
export function analyzeTopicForWorkflows(topic: string): {
  suggestedWorkflows: string[];
  reasoning: string;
  confidence: number;
} {
  const topicLower = topic.toLowerCase();
  const keywords = topicLower.split(/\s+/);
  
  const workflowScores: Record<string, number> = {};
  let reasoning = '';
  
  // Score workflows based on topic keywords
  WORKFLOW_PATTERNS.forEach(workflow => {
    let score = 0;
    const workflowKeywords = [
      ...workflow.name.toLowerCase().split(/\s+/),
      ...workflow.description.toLowerCase().split(/\s+/),
      ...workflow.useCase.toLowerCase().split(/\s+/),
      ...workflow.benefits.join(' ').toLowerCase().split(/\s+/)
    ];
    
    keywords.forEach(keyword => {
      if (workflowKeywords.some(wk => wk.includes(keyword) || keyword.includes(wk))) {
        score += 1;
      }
    });
    
    // Bonus scoring for specific patterns
    if (topicLower.includes('api') && workflow.id.includes('api')) score += 3;
    if (topicLower.includes('security') && workflow.id.includes('security')) score += 3;
    if (topicLower.includes('performance') && workflow.id.includes('performance')) score += 3;
    if (topicLower.includes('bug') && workflow.id.includes('bug')) score += 3;
    if (topicLower.includes('data') && workflow.id.includes('data')) score += 3;
    
    if (score > 0) {
      workflowScores[workflow.id] = score;
    }
  });
  
  // Get top workflows
  const sortedWorkflows = Object.entries(workflowScores)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([id]) => id);
  
  // Calculate confidence based on scores
  const maxScore = Math.max(...Object.values(workflowScores));
  const confidence = Math.min(maxScore * 20, 100); // Scale to percentage
  
  // Generate reasoning
  if (sortedWorkflows.length > 0) {
    const topWorkflow = WORKFLOW_PATTERNS.find(w => w.id === sortedWorkflows[0]);
    reasoning = `Topic analysis suggests ${topWorkflow?.name} workflow based on keywords matching ${topWorkflow?.useCase}`;
  } else {
    reasoning = 'No specific workflow patterns detected, recommend general quality assurance pipeline';
    return {
      suggestedWorkflows: ['full-quality-pipeline'],
      reasoning,
      confidence: 30
    };
  }
  
  return {
    suggestedWorkflows: sortedWorkflows,
    reasoning,
    confidence
  };
}