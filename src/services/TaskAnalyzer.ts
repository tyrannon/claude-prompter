import { TaskAnalysis, TimeEstimate, Dependency, Risk } from '../types/planning.types';

export class TaskAnalyzer {
  
  async analyzeTask(taskDescription: string): Promise<TaskAnalysis> {
    const complexity = this.assessComplexity(taskDescription);
    const domain = this.identifyDomains(taskDescription);
    const estimatedTime = this.estimateTime(taskDescription, complexity);
    const requiredSkills = this.identifyRequiredSkills(taskDescription, domain);
    const dependencies = this.identifyDependencies(taskDescription);
    const risks = this.assessRisks(taskDescription, complexity);

    return {
      complexity,
      domain,
      estimatedTime,
      requiredSkills,
      dependencies,
      risks
    };
  }

  private assessComplexity(description: string): TaskAnalysis['complexity'] {
    const complexityKeywords = {
      simple: ['basic', 'simple', 'quick', 'minor', 'small', 'trivial'],
      moderate: ['standard', 'typical', 'medium', 'intermediate'],
      complex: ['complex', 'advanced', 'comprehensive', 'full', 'complete'],
      veryComplex: ['enterprise', 'large-scale', 'distributed', 'microservices', 'architecture']
    };

    const lower = description.toLowerCase();
    
    // Check for very complex indicators
    if (complexityKeywords.veryComplex.some(keyword => lower.includes(keyword))) {
      return 'very-complex';
    }
    
    // Check for authentication, real-time, or multiple integrations
    const complexFeatures = ['authentication', 'real-time', 'websocket', 'oauth', 'payment', 'api integration'];
    const complexCount = complexFeatures.filter(feature => lower.includes(feature)).length;
    
    if (complexCount >= 3) return 'very-complex';
    if (complexCount >= 2) return 'complex';
    
    // Check other complexity keywords
    if (complexityKeywords.complex.some(keyword => lower.includes(keyword))) {
      return 'complex';
    }
    if (complexityKeywords.simple.some(keyword => lower.includes(keyword))) {
      return 'simple';
    }
    
    return 'moderate';
  }

  private identifyDomains(description: string): string[] {
    const domains: string[] = [];
    const lower = description.toLowerCase();
    
    const domainPatterns = [
      { pattern: /react|vue|angular|frontend|ui|component/, domain: 'frontend' },
      { pattern: /node|express|server|api|backend|rest/, domain: 'backend' },
      { pattern: /database|mongo|postgres|sql|redis/, domain: 'database' },
      { pattern: /auth|login|jwt|oauth|security/, domain: 'authentication' },
      { pattern: /test|jest|cypress|testing/, domain: 'testing' },
      { pattern: /docker|kubernetes|deploy|ci\/cd/, domain: 'devops' },
      { pattern: /websocket|real-time|socket\.io|streaming/, domain: 'real-time' },
      { pattern: /payment|stripe|billing|subscription/, domain: 'payments' },
      { pattern: /mobile|react native|flutter/, domain: 'mobile' },
      { pattern: /machine learning|ml|ai|tensorflow/, domain: 'ml/ai' }
    ];
    
    domainPatterns.forEach(({ pattern, domain }) => {
      if (pattern.test(lower)) {
        domains.push(domain);
      }
    });
    
    return domains.length > 0 ? domains : ['general'];
  }

  private estimateTime(description: string, complexity: TaskAnalysis['complexity']): TimeEstimate {
    const baseEstimates = {
      simple: { min: 1, expected: 2, max: 4 },
      moderate: { min: 4, expected: 8, max: 16 },
      complex: { min: 16, expected: 32, max: 64 },
      'very-complex': { min: 40, expected: 80, max: 160 }
    };
    
    const base = baseEstimates[complexity];
    const words = description.split(' ').length;
    
    // Adjust based on description length (more detailed = potentially more work)
    const detailMultiplier = 1 + (Math.min(words, 100) / 200);
    
    // Check for specific time-consuming keywords
    const timeConsumingKeywords = ['integration', 'migration', 'refactor', 'optimization', 'scalable'];
    const hasTimeConsumingWork = timeConsumingKeywords.some(keyword => 
      description.toLowerCase().includes(keyword)
    );
    
    const timeMultiplier = hasTimeConsumingWork ? 1.5 : 1;
    
    return {
      minimum: Math.round(base.min * detailMultiplier * timeMultiplier),
      expected: Math.round(base.expected * detailMultiplier * timeMultiplier),
      maximum: Math.round(base.max * detailMultiplier * timeMultiplier),
      confidence: complexity === 'simple' ? 0.8 : complexity === 'very-complex' ? 0.5 : 0.65
    };
  }

  private identifyRequiredSkills(description: string, domains: string[]): string[] {
    const skills = new Set<string>();
    const lower = description.toLowerCase();
    
    // Base skills from domains
    const domainSkills: Record<string, string[]> = {
      frontend: ['JavaScript', 'CSS', 'HTML', 'React/Vue/Angular'],
      backend: ['Node.js', 'API Design', 'Server Architecture'],
      database: ['SQL', 'Database Design', 'Query Optimization'],
      authentication: ['Security Best Practices', 'JWT/OAuth', 'Session Management'],
      testing: ['Unit Testing', 'Integration Testing', 'Test Automation'],
      devops: ['Docker', 'CI/CD', 'Cloud Platforms'],
      'real-time': ['WebSockets', 'Event-Driven Architecture', 'Scaling'],
      payments: ['Payment APIs', 'PCI Compliance', 'Financial Security'],
      mobile: ['Mobile Development', 'React Native/Flutter', 'App Store Guidelines'],
      'ml/ai': ['Machine Learning', 'Data Science', 'Python/TensorFlow']
    };
    
    domains.forEach(domain => {
      const domainSpecificSkills = domainSkills[domain] || [];
      domainSpecificSkills.forEach(skill => skills.add(skill));
    });
    
    // Add specific technology skills mentioned
    const techPatterns = [
      { pattern: /typescript/, skill: 'TypeScript' },
      { pattern: /graphql/, skill: 'GraphQL' },
      { pattern: /redux|mobx|state management/, skill: 'State Management' },
      { pattern: /aws|azure|gcp/, skill: 'Cloud Services' },
      { pattern: /elasticsearch|elastic/, skill: 'Elasticsearch' },
      { pattern: /rabbitmq|kafka|message queue/, skill: 'Message Queues' }
    ];
    
    techPatterns.forEach(({ pattern, skill }) => {
      if (pattern.test(lower)) {
        skills.add(skill);
      }
    });
    
    return Array.from(skills);
  }

  private identifyDependencies(description: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lower = description.toLowerCase();
    
    // Technical dependencies
    if (lower.includes('api') || lower.includes('integration')) {
      dependencies.push({
        type: 'technical',
        description: 'External API availability and documentation',
        criticality: 'blocking'
      });
    }
    
    if (lower.includes('database') || lower.includes('migration')) {
      dependencies.push({
        type: 'technical',
        description: 'Database setup and access',
        criticality: 'blocking'
      });
    }
    
    // Knowledge dependencies
    if (lower.includes('existing') || lower.includes('current')) {
      dependencies.push({
        type: 'knowledge',
        description: 'Understanding of existing system architecture',
        criticality: 'important'
      });
    }
    
    // Resource dependencies
    if (lower.includes('team') || lower.includes('collaborate')) {
      dependencies.push({
        type: 'resource',
        description: 'Team member availability for collaboration',
        criticality: 'important'
      });
    }
    
    // External dependencies
    if (lower.includes('third-party') || lower.includes('external service')) {
      dependencies.push({
        type: 'external',
        description: 'Third-party service accounts and credentials',
        criticality: 'blocking'
      });
    }
    
    return dependencies;
  }

  private assessRisks(description: string, complexity: TaskAnalysis['complexity']): Risk[] {
    const risks: Risk[] = [];
    const lower = description.toLowerCase();
    
    // Common technical risks
    if (lower.includes('migration') || lower.includes('upgrade')) {
      risks.push({
        description: 'Data loss or corruption during migration',
        probability: 'medium',
        impact: 'high',
        mitigation: 'Comprehensive backup strategy and rollback plan'
      });
    }
    
    if (lower.includes('real-time') || lower.includes('websocket')) {
      risks.push({
        description: 'Scalability issues with concurrent connections',
        probability: 'medium',
        impact: 'medium',
        mitigation: 'Load testing and horizontal scaling strategy'
      });
    }
    
    if (lower.includes('security') || lower.includes('authentication')) {
      risks.push({
        description: 'Security vulnerabilities in authentication implementation',
        probability: 'medium',
        impact: 'high',
        mitigation: 'Security audit and penetration testing'
      });
    }
    
    // Complexity-based risks
    if (complexity === 'complex' || complexity === 'very-complex') {
      risks.push({
        description: 'Scope creep and timeline overrun',
        probability: 'high',
        impact: 'medium',
        mitigation: 'Clear requirements and regular progress reviews'
      });
    }
    
    // Integration risks
    if (lower.includes('integration') || lower.includes('third-party')) {
      risks.push({
        description: 'Third-party API changes or downtime',
        probability: 'low',
        impact: 'medium',
        mitigation: 'Implement fallback mechanisms and error handling'
      });
    }
    
    return risks;
  }
}