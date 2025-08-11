import { SafetyWrapper } from '../SafetyWrapper';

describe('SafetyWrapper', () => {
  let wrapper: SafetyWrapper;
  
  beforeEach(() => {
    wrapper = new SafetyWrapper();
  });
  
  describe('wrapSuggestion', () => {
    it('should wrap suggestions with risk assessment', () => {
      const result = wrapper.wrapSuggestion('modify component file');
      
      expect(result.original).toBe('modify component file');
      expect(result.riskAssessment).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.warnings).toBeDefined();
    });
    
    it('should block critical operations in safe mode', () => {
      wrapper.setSafeMode(true);
      
      const result = wrapper.wrapSuggestion('modify babel.config.js', {
        safeMode: true
      });
      
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toContain('BLOCKED');
    });
    
    it('should allow high-risk operations when explicitly allowed', () => {
      const result = wrapper.wrapSuggestion('modify babel.config.js', {
        safeMode: true,
        allowHighRisk: true
      });
      
      expect(result.blocked).toBeFalsy();
    });
    
    it('should detect incremental mode requirements', () => {
      const result = wrapper.wrapSuggestion('add authentication system with JWT, refresh tokens, and role-based access');
      
      expect(result.incrementalPlan).toBeDefined();
      expect(result.incrementalPlan?.requiresIncrementalMode).toBe(true);
    });
    
    it('should add platform-specific warnings', () => {
      const result = wrapper.wrapSuggestion('modify babel.config.js', {
        platform: 'expo'
      });
      
      expect(result.warnings.some(w => w.includes('EXPO'))).toBe(true);
    });
    
    it('should reduce confidence for high-risk operations', () => {
      const lowRiskResult = wrapper.wrapSuggestion('add new component');
      const highRiskResult = wrapper.wrapSuggestion('modify babel.config.js');
      
      expect(highRiskResult.confidence).toBeLessThan(lowRiskResult.confidence);
    });
  });
  
  describe('error tracking', () => {
    it('should track and suggest rollback after errors', () => {
      wrapper.incrementErrorCount();
      wrapper.incrementErrorCount();
      wrapper.incrementErrorCount();
      
      const result = wrapper.wrapSuggestion('any operation');
      
      expect(result.warnings.some(w => w.includes('ROLLBACK'))).toBe(true);
    });
    
    it('should block high-risk operations after too many errors', () => {
      for (let i = 0; i < 5; i++) {
        wrapper.incrementErrorCount();
      }
      
      const result = wrapper.wrapSuggestion('modify babel.config.js');
      
      expect(result.blocked).toBe(true);
      expect(result.blockReason).toContain('Too many recent errors');
    });
    
    it('should reset error count', () => {
      wrapper.incrementErrorCount();
      wrapper.incrementErrorCount();
      wrapper.resetErrorCount();
      
      const status = wrapper.getSessionStatus();
      expect(status).toContain('Error Count: 0');
    });
  });
  
  describe('safe mode', () => {
    it('should modify suggestions in safe mode', () => {
      wrapper.setSafeMode(true);
      
      const result = wrapper.wrapSuggestion('update package.json', {
        safeMode: true,
        allowHighRisk: true
      });
      
      expect(result.modified).toBeDefined();
      expect(result.modified).toContain('[HIGH RISK - TEST CAREFULLY]');
      expect(result.modified).toContain('Create checkpoint');
    });
    
    it('should add conservative warnings in safe mode', () => {
      const result = wrapper.wrapSuggestion('any operation', {
        safeMode: true
      });
      
      expect(result.warnings.some(w => w.includes('SAFE MODE'))).toBe(true);
    });
  });
  
  describe('formatSafetySuggestion', () => {
    it('should format blocked suggestions', () => {
      wrapper.setSafeMode(true);
      const result = wrapper.wrapSuggestion('modify babel.config.js', {
        safeMode: true
      });
      
      const formatted = wrapper.formatSafetySuggestion(result);
      
      expect(formatted).toContain('SUGGESTION BLOCKED');
      expect(formatted).toContain('Safety Protection');
    });
    
    it('should show confidence indicators', () => {
      const result = wrapper.wrapSuggestion('add component');
      const formatted = wrapper.formatSafetySuggestion(result);
      
      expect(formatted).toMatch(/Confidence:.*\d+%/);
    });
    
    it('should show risk indicators', () => {
      const result = wrapper.wrapSuggestion('modify babel.config.js');
      const formatted = wrapper.formatSafetySuggestion(result);
      
      expect(formatted).toContain('Risk Level:');
      expect(formatted).toMatch(/CRITICAL|HIGH|MEDIUM|LOW/);
    });
  });
  
  describe('getSessionStatus', () => {
    it('should display session safety status', () => {
      wrapper.incrementErrorCount();
      wrapper.setSafeMode(true);
      
      const status = wrapper.getSessionStatus();
      
      expect(status).toContain('Session Safety Status');
      expect(status).toContain('Error Count: 1');
      expect(status).toContain('Safe Mode: ON');
    });
    
    it('should show risk distribution of recent suggestions', () => {
      wrapper.wrapSuggestion('add component');
      wrapper.wrapSuggestion('modify babel.config.js');
      wrapper.wrapSuggestion('update styles');
      
      const status = wrapper.getSessionStatus();
      
      expect(status).toContain('Recent Risk Distribution');
      expect(status).toContain('Low:');
      expect(status).toContain('Critical:');
    });
  });
});