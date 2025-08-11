import { RiskAssessmentEngine, RiskLevel } from '../RiskAssessmentEngine';

describe('RiskAssessmentEngine', () => {
  let engine: RiskAssessmentEngine;
  
  beforeEach(() => {
    engine = new RiskAssessmentEngine();
  });
  
  describe('assessRisk', () => {
    it('should identify CRITICAL risk for babel.config changes', () => {
      const assessment = engine.assessRisk('modify babel.config.js');
      expect(assessment.level).toBe(RiskLevel.CRITICAL);
      expect(assessment.requiresCheckpoint).toBe(true);
      expect(assessment.patterns.length).toBeGreaterThan(0);
    });
    
    it('should identify HIGH risk for package.json changes', () => {
      const assessment = engine.assessRisk('update package.json');
      expect(assessment.level).toBe(RiskLevel.HIGH);
      expect(assessment.requiresCheckpoint).toBe(true);
    });
    
    it('should identify LOW risk for component changes', () => {
      const assessment = engine.assessRisk('add new component');
      expect(assessment.level).toBe(RiskLevel.LOW);
      expect(assessment.requiresCheckpoint).toBe(false);
    });
    
    it('should block babel changes in Expo platform', () => {
      const assessment = engine.assessRisk('modify babel.config.js', {
        platform: 'expo'
      });
      expect(assessment.level).toBe(RiskLevel.CRITICAL);
      expect(assessment.warnings.some(w => w.includes('BLOCKED'))).toBe(true);
    });
    
    it('should suggest rollback after multiple errors', () => {
      const assessment = engine.assessRisk('any operation', {
        previousErrors: 3
      });
      expect(assessment.warnings.some(w => w.includes('rollback'))).toBe(true);
    });
  });
  
  describe('detectPlatform', () => {
    it('should return undefined when no platform detected', () => {
      const platform = engine.detectPlatform('/non-existent-path');
      expect(platform).toBeUndefined();
    });
  });
  
  describe('error tracking', () => {
    it('should track error count', () => {
      expect(engine.shouldSuggestRollback()).toBe(false);
      
      engine.incrementErrorCount();
      engine.incrementErrorCount();
      engine.incrementErrorCount();
      
      expect(engine.shouldSuggestRollback()).toBe(true);
    });
    
    it('should reset error count', () => {
      engine.incrementErrorCount();
      engine.incrementErrorCount();
      engine.incrementErrorCount();
      
      engine.resetErrorCount();
      expect(engine.shouldSuggestRollback()).toBe(false);
    });
  });
  
  describe('checkpoint creation', () => {
    it('should create unique checkpoint names', async () => {
      const checkpoint1 = engine.createCheckpoint();
      // Add small delay to ensure different timestamp
      await new Promise(resolve => setTimeout(resolve, 10));
      const checkpoint2 = engine.createCheckpoint();
      
      expect(checkpoint1).toMatch(/^SAFE-\d+$/);
      expect(checkpoint2).toMatch(/^SAFE-\d+$/);
      expect(checkpoint1).not.toBe(checkpoint2);
    });
  });
  
  describe('formatRiskAssessment', () => {
    it('should format risk assessment output', () => {
      const assessment = engine.assessRisk('modify babel.config.js');
      const formatted = engine.formatRiskAssessment(assessment, 'test operation');
      
      expect(formatted).toContain('Risk Assessment');
      expect(formatted).toContain('test operation');
      expect(formatted).toContain('CRITICAL');
    });
  });
});