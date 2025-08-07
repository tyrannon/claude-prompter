/**
 * Test the Intelligent Router functionality
 */

import { IntelligentRouter } from './routing/IntelligentRouter';
import { PerformanceTracker } from './metrics/PerformanceMetrics';

async function testRouter() {
  console.log('🧠 Testing SUPER Intelligent Router...\n');

  const performanceTracker = new PerformanceTracker();
  await performanceTracker.loadHistoricalMetrics();

  const router = new IntelligentRouter(performanceTracker);

  // Register available engines
  router.registerEngine('tinyllama', { 
    name: 'tinyllama', 
    model: 'tinyllama', 
    baseUrl: 'http://localhost:11434' 
  });
  
  router.registerEngine('gpt-4o-mini', { 
    name: 'gpt-4o-mini', 
    model: 'gpt-4o-mini' 
  });
  
  router.registerEngine('gpt-4o', { 
    name: 'gpt-4o', 
    model: 'gpt-4o' 
  });

  // Test prompts of different types
  const testPrompts = [
    {
      name: 'Simple Question',
      prompt: 'What is React?',
      expected: { complexity: 'low', taskType: 'question-answering' }
    },
    {
      name: 'Code Generation',
      prompt: 'Create a TypeScript function to calculate fibonacci numbers using memoization',
      expected: { complexity: 'medium', taskType: 'code-generation' }
    },
    {
      name: 'Complex Architecture',
      prompt: 'Design a scalable microservices architecture for a multi-tenant SaaS application with real-time features, considering security, performance, and deployment strategies',
      expected: { complexity: 'high', taskType: 'architecture-design' }
    },
    {
      name: 'Urgent Bug Fix',
      prompt: 'URGENT: My React app crashes with "Cannot read property of undefined" error when submitting forms. Need immediate fix!',
      expected: { complexity: 'medium', urgency: 'high', taskType: 'debugging' }
    }
  ];

  for (const test of testPrompts) {
    console.log(`\n🔍 Testing: ${test.name}`);
    console.log(`Prompt: "${test.prompt}"`);
    
    try {
      // Analyze the prompt
      const analysis = await router.analyzePrompt(test.prompt);
      console.log('\n📊 Analysis Results:');
      console.log(`  Topics: ${analysis.topics.join(', ')}`);
      console.log(`  Complexity: ${analysis.complexity}/10`);
      console.log(`  Task Type: ${analysis.taskType}`);
      console.log(`  Urgency: ${analysis.urgency}`);
      console.log(`  Technical Depth: ${analysis.technicalDepth}/10`);
      console.log(`  Estimated Tokens: ${analysis.estimatedTokens}`);

      // Get routing decision with different preference profiles
      const preferences = [
        { 
          name: 'Cost-Conscious', 
          prefs: { 
            costSensitivity: 'high' as const, 
            speedSensitivity: 'medium' as const, 
            qualitySensitivity: 'medium' as const 
          } 
        },
        { 
          name: 'Speed-First', 
          prefs: { 
            costSensitivity: 'low' as const, 
            speedSensitivity: 'high' as const, 
            qualitySensitivity: 'high' as const 
          } 
        },
        { 
          name: 'Quality-Focused', 
          prefs: { 
            costSensitivity: 'low' as const, 
            speedSensitivity: 'low' as const, 
            qualitySensitivity: 'high' as const 
          } 
        }
      ];

      for (const { name, prefs } of preferences) {
        console.log(`\n🎯 Routing Decision (${name}):`);
        const decision = await router.selectOptimalModels(analysis, prefs, 2);
        
        console.log(`  Primary: ${decision.primaryModel.model} (confidence: ${(decision.primaryModel.confidence * 100).toFixed(1)}%)`);
        console.log(`  Estimated Cost: $${decision.totalEstimatedCost.toFixed(4)}`);
        console.log(`  Estimated Time: ${(decision.totalEstimatedTime / 1000).toFixed(1)}s`);
        
        if (decision.hybridStrategy) {
          console.log(`  Hybrid Strategy:`);
          console.log(`    - Try Local First: ${decision.hybridStrategy.tryLocalFirst}`);
          console.log(`    - Fallback to Cloud: ${decision.hybridStrategy.fallbackToCloud}`);
          console.log(`    - Parallel Execution: ${decision.hybridStrategy.parallelExecution}`);
        }
        
        console.log(`  Reasoning: ${decision.primaryModel.reasoning.join(', ')}`);
        
        if (decision.backupModels.length > 0) {
          console.log(`  Backup: ${decision.backupModels[0].model} (confidence: ${(decision.backupModels[0].confidence * 100).toFixed(1)}%)`);
        }
      }

    } catch (error) {
      console.error(`❌ Error testing ${test.name}:`, error);
    }

    console.log('\n' + '─'.repeat(80));
  }

  console.log('\n✅ Router testing complete!');
}

// Run the test
testRouter().catch(console.error);