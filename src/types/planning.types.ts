export interface TaskAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  domain: string[];
  estimatedTime: TimeEstimate;
  requiredSkills: string[];
  dependencies: Dependency[];
  risks: Risk[];
}

export interface TimeEstimate {
  minimum: number; // hours
  expected: number;
  maximum: number;
  confidence: number; // 0-1
}

export interface Dependency {
  type: 'technical' | 'knowledge' | 'resource' | 'external';
  description: string;
  criticality: 'blocking' | 'important' | 'nice-to-have';
}

export interface Risk {
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface ExecutionPlan {
  id: string;
  title: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  status: 'draft' | 'active' | 'completed' | 'archived';
  phases: Phase[];
  totalEstimate: TimeEstimate;
  metadata: PlanMetadata;
}

export interface PlanMetadata {
  sessionId?: string;
  projectName?: string;
  tags: string[];
  aiModel: string;
  version: number;
}

export interface Phase {
  id: string;
  name: string;
  description: string;
  steps: Step[];
  order: number;
  canParallelize: boolean;
  status?: 'pending' | 'in-progress' | 'completed';
}

export interface Step {
  id: string;
  title: string;
  description: string;
  type: 'code' | 'research' | 'design' | 'test' | 'deploy' | 'document' | 'setup';
  status: 'pending' | 'in-progress' | 'completed' | 'blocked' | 'skipped';
  
  // Execution details
  commands?: string[];
  codeSnippets?: CodeSnippet[];
  checkpoints?: Checkpoint[];
  
  // Dependencies and ordering
  dependsOn: string[]; // Step IDs
  blockedBy?: string;
  order: number;
  
  // Estimates
  estimate: TimeEstimate;
  complexity: number; // 1-5
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // Progress tracking
  startedAt?: Date;
  completedAt?: Date;
  completionNotes?: string;
  issues?: Issue[];
}

export interface CodeSnippet {
  language: string;
  code: string;
  filename?: string;
  description?: string;
}

export interface Checkpoint {
  id: string;
  description: string;
  verificationCommand?: string;
  expectedResult?: string;
  completed: boolean;
  completedAt?: Date;
}

export interface Issue {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  resolved: boolean;
  resolution?: string;
}

export interface PlanProgress {
  planId: string;
  overallProgress: number; // 0-100
  phasesCompleted: number;
  stepsCompleted: number;
  totalSteps: number;
  timeSpent: number; // hours
  estimatedRemaining: number; // hours
  isOnTrack: boolean;
  currentFocus?: string;
  blockers: string[];
}