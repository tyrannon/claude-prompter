import { IncrementalModeEnforcer } from '../IncrementalModeEnforcer';

describe('IncrementalModeEnforcer', () => {
  let enforcer: IncrementalModeEnforcer;
  
  beforeEach(() => {
    enforcer = new IncrementalModeEnforcer();
  });
  
  describe('analyzeTask', () => {
    it('should enforce incremental mode for complex tasks', () => {
      const plan = enforcer.analyzeTask('add authentication with JWT and refresh tokens');
      
      expect(plan.mode).toBe('incremental');
      expect(plan.requiresIncrementalMode).toBe(true);
      expect(plan.steps.length).toBeGreaterThan(3);
      expect(plan.reason).toBeDefined();
    });
    
    it('should not enforce incremental for simple tasks', () => {
      const plan = enforcer.analyzeTask('add new button component');
      
      expect(plan.mode).toBe('standard');
      expect(plan.requiresIncrementalMode).toBe(false);
    });
    
    it('should force incremental when option is set', () => {
      const plan = enforcer.analyzeTask('simple task', {
        forceIncremental: true
      });
      
      expect(plan.mode).toBe('incremental');
      expect(plan.requiresIncrementalMode).toBe(true);
    });
    
    it('should add platform-specific steps for Expo', () => {
      const plan = enforcer.analyzeTask('add native feature', {
        platform: 'expo'
      });
      
      const expoStep = plan.steps.find(s => 
        s.description.includes('Expo SDK compatibility')
      );
      expect(expoStep).toBeDefined();
    });
    
    it('should identify TypeScript migration steps', () => {
      const plan = enforcer.analyzeTask('migrate to typescript');
      
      expect(plan.steps.some(s => s.description.includes('Install TypeScript'))).toBe(true);
      expect(plan.steps.some(s => s.description.includes('tsconfig.json'))).toBe(true);
      expect(plan.steps.some(s => s.description.includes('Rename'))).toBe(true);
    });
  });
  
  describe('step management', () => {
    it('should track completed steps', () => {
      enforcer.analyzeTask('complex task');
      
      enforcer.markStepComplete(1);
      enforcer.markStepComplete(2);
      
      const currentStep = enforcer.getCurrentStep();
      expect(currentStep?.number).toBe(3);
    });
    
    it('should track failed steps', () => {
      enforcer.analyzeTask('complex task');
      
      enforcer.markStepFailed(1, 'Test error');
      enforcer.markStepFailed(2, 'Another error');
      
      expect(enforcer.shouldSuggestRollback()).toBe(true);
    });
  });
  
  describe('rollback suggestions', () => {
    it('should suggest rollback after multiple failures', () => {
      enforcer.analyzeTask('complex task');
      
      enforcer.markStepComplete(1);
      enforcer.markStepFailed(2, 'Error 1');
      enforcer.markStepFailed(3, 'Error 2');
      
      expect(enforcer.shouldSuggestRollback()).toBe(true);
      
      const rollbackSuggestion = enforcer.getRollbackSuggestion();
      expect(rollbackSuggestion).toContain('ROLLBACK RECOMMENDED');
      expect(rollbackSuggestion).toContain('git reset --hard HEAD');
    });
    
    it('should not suggest rollback with low failure rate', () => {
      enforcer.analyzeTask('complex task');
      
      enforcer.markStepComplete(1);
      enforcer.markStepComplete(2);
      enforcer.markStepComplete(3);
      enforcer.markStepFailed(4, 'Single error');
      
      expect(enforcer.shouldSuggestRollback()).toBe(false);
    });
  });
  
  describe('formatIncrementalPlan', () => {
    it('should format incremental plan with step indicators', () => {
      const plan = enforcer.analyzeTask('add authentication');
      const formatted = enforcer.formatIncrementalPlan(plan);
      
      expect(formatted).toContain('INCREMENTAL MODE ACTIVATED');
      expect(formatted).toContain('Total Steps:');
      expect(formatted).toContain('Step 1:');
    });
    
    it('should show completed and failed step indicators', () => {
      const plan = enforcer.analyzeTask('complex task');
      
      enforcer.markStepComplete(1);
      enforcer.markStepFailed(2, 'Test error');
      
      const formatted = enforcer.formatIncrementalPlan(plan);
      
      expect(formatted).toContain('✅'); // Completed indicator
      expect(formatted).toContain('❌'); // Failed indicator
      expect(formatted).toContain('Test error');
    });
  });
});