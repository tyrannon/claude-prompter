/**
 * Factory for creating and managing AI model engines
 */

import { BaseEngine, EngineConfig } from './BaseEngine';
import { GPTEngine } from './GPTEngine';
import { ClaudeEngine } from './ClaudeEngine';
import { LocalEngine, LocalEngineConfig } from './LocalEngine';

export type EngineType = 'gpt' | 'claude' | 'local' | 'custom';

export interface EngineDefinition {
  type: EngineType;
  name: string;
  config: EngineConfig | LocalEngineConfig;
}

export class EngineFactory {
  private static registry = new Map<string, BaseEngine>();

  /**
   * Create an engine instance
   */
  static createEngine(type: EngineType, config: Partial<EngineConfig | LocalEngineConfig>): BaseEngine {
    switch (type) {
      case 'gpt':
        return new GPTEngine(config);
      case 'claude':
        return new ClaudeEngine(config);
      case 'local':
        if (!('endpoint' in config) || !config.endpoint) {
          throw new Error('Local engine requires endpoint configuration');
        }
        return new LocalEngine(config as LocalEngineConfig);
      case 'custom':
        throw new Error('Custom engines not yet implemented');
      default:
        throw new Error(`Unknown engine type: ${type}`);
    }
  }

  /**
   * Register an engine for reuse
   */
  static registerEngine(name: string, engine: BaseEngine): void {
    this.registry.set(name, engine);
  }

  /**
   * Get a registered engine
   */
  static getEngine(name: string): BaseEngine | undefined {
    return this.registry.get(name);
  }

  /**
   * Create multiple engines from definitions
   */
  static createEngines(definitions: EngineDefinition[]): Map<string, BaseEngine> {
    const engines = new Map<string, BaseEngine>();

    for (const def of definitions) {
      try {
        const engine = this.createEngine(def.type, def.config);
        engines.set(def.name, engine);
        this.registerEngine(def.name, engine);
      } catch (error) {
        console.warn(`Failed to create engine ${def.name}:`, error);
      }
    }

    return engines;
  }

  /**
   * Get default engine configurations
   */
  static getDefaultConfigs(): EngineDefinition[] {
    return [
      {
        type: 'gpt',
        name: 'gpt-4o',
        config: {
          name: 'gpt-4o',
          model: 'gpt-4o',
          temperature: 0.7,
          maxTokens: 4000
        }
      },
      {
        type: 'gpt',
        name: 'gpt-4o-mini',
        config: {
          name: 'gpt-4o-mini', 
          model: 'gpt-4o-mini',
          temperature: 0.7,
          maxTokens: 4000
        }
      },
      {
        type: 'claude',
        name: 'claude-sonnet',
        config: {
          name: 'claude-sonnet',
          model: 'claude-3-sonnet-20240229',
          temperature: 0.7,
          maxTokens: 4096
        }
      },
      {
        type: 'claude',
        name: 'claude-haiku',
        config: {
          name: 'claude-haiku',
          model: 'claude-3-haiku-20240307',
          temperature: 0.7,
          maxTokens: 4096
        }
      }
    ];
  }

  /**
   * Test engine availability
   */
  static async testEngines(engines: Map<string, BaseEngine>): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const tests = Array.from(engines.entries()).map(async ([name, engine]) => {
      try {
        const isAvailable = await engine.isAvailable();
        results.set(name, isAvailable);
      } catch {
        results.set(name, false);
      }
    });

    await Promise.all(tests);
    return results;
  }

  /**
   * Clear engine registry
   */
  static clearRegistry(): void {
    this.registry.clear();
  }
}