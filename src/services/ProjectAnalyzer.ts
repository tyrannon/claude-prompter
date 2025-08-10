import { promises as fs } from 'fs';
import path from 'path';
import { execSync } from 'child_process';

export interface ProjectContext {
  type: 'react-native' | 'web-react' | 'nodejs' | 'python' | 'go' | 'rust' | 'unknown';
  domain: 'ecommerce' | 'fashion' | 'fintech' | 'gaming' | 'healthcare' | 'education' | 'general';
  frameworks: string[];
  languages: string[];
  patterns: string[];
  buildTools: string[];
  testFrameworks: string[];
  styling: string[];
  stateManagement: string[];
  confidence: number;
  workingDirectory: string;
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'pip' | 'cargo' | 'go mod' | 'unknown';
  hasGit: boolean;
  gitStatus?: {
    branch: string;
    hasUncommittedChanges: boolean;
    recentFiles: string[];
  };
}

export interface FileAnalysis {
  filePath: string;
  type: 'source' | 'config' | 'test' | 'docs' | 'asset';
  language: string;
  framework?: string;
  patterns: string[];
  complexity: 'simple' | 'moderate' | 'complex';
  lastModified: Date;
  size: number;
}

/**
 * ProjectAnalyzer - Intelligent project detection and analysis
 * Provides context-aware suggestions based on project structure and patterns
 */
export class ProjectAnalyzer {
  private cwd: string;
  private cache: Map<string, ProjectContext> = new Map();
  
  constructor(workingDirectory: string = process.cwd()) {
    this.cwd = workingDirectory;
  }

  /**
   * Analyze the current project and return comprehensive context
   */
  async analyzeProject(): Promise<ProjectContext> {
    // Check cache first
    const cacheKey = this.cwd;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const context: ProjectContext = {
      type: 'unknown',
      domain: 'general',
      frameworks: [],
      languages: [],
      patterns: [],
      buildTools: [],
      testFrameworks: [],
      styling: [],
      stateManagement: [],
      confidence: 0,
      workingDirectory: this.cwd,
      packageManager: 'unknown',
      hasGit: false,
    };

    try {
      // Analyze package.json for Node.js projects
      await this.analyzePackageJson(context);
      
      // Analyze Python projects
      await this.analyzePythonProject(context);
      
      // Analyze Go projects
      await this.analyzeGoProject(context);
      
      // Analyze Rust projects
      await this.analyzeRustProject(context);
      
      // Analyze file structure
      await this.analyzeFileStructure(context);
      
      // Analyze Git status
      await this.analyzeGitStatus(context);
      
      // Detect domain/industry patterns
      await this.detectDomainPatterns(context);
      
      // Calculate confidence score
      this.calculateConfidence(context);
      
      // Cache result
      this.cache.set(cacheKey, context);
      
      return context;
    } catch (error) {
      console.warn(`Project analysis failed: ${error}`);
      return context;
    }
  }

  /**
   * Analyze specific files for context
   */
  async analyzeFiles(filePaths: string[]): Promise<FileAnalysis[]> {
    const analyses: FileAnalysis[] = [];
    
    for (const filePath of filePaths) {
      try {
        const absolutePath = path.resolve(this.cwd, filePath);
        const stats = await fs.stat(absolutePath);
        const content = await fs.readFile(absolutePath, 'utf-8');
        const extension = path.extname(filePath).toLowerCase();
        
        const analysis: FileAnalysis = {
          filePath,
          type: this.classifyFileType(filePath, content),
          language: this.detectLanguage(extension, content),
          framework: this.detectFramework(content),
          patterns: this.detectPatterns(content),
          complexity: this.assessComplexity(content),
          lastModified: stats.mtime,
          size: stats.size
        };
        
        analyses.push(analysis);
      } catch (error) {
        console.warn(`Failed to analyze file ${filePath}: ${error}`);
      }
    }
    
    return analyses;
  }

  /**
   * Get recent changed files from git
   */
  async getRecentChangedFiles(limit: number = 10): Promise<string[]> {
    try {
      if (!this.hasGitRepo()) return [];
      
      const output = execSync('git diff --name-only HEAD~5..HEAD', {
        cwd: this.cwd,
        encoding: 'utf-8'
      });
      
      return output.trim().split('\n').filter(Boolean).slice(0, limit);
    } catch {
      return [];
    }
  }

  /**
   * Get current working files (staged, modified, etc.)
   */
  async getCurrentWorkingFiles(): Promise<{
    staged: string[];
    modified: string[];
    untracked: string[];
  }> {
    try {
      if (!this.hasGitRepo()) return { staged: [], modified: [], untracked: [] };
      
      const output = execSync('git status --porcelain', {
        cwd: this.cwd,
        encoding: 'utf-8'
      });
      
      const staged: string[] = [];
      const modified: string[] = [];
      const untracked: string[] = [];
      
      output.trim().split('\n').forEach(line => {
        if (!line) return;
        
        const status = line.substring(0, 2);
        const filePath = line.substring(3);
        
        if (status[0] === 'A' || status[0] === 'M' || status[0] === 'D') {
          staged.push(filePath);
        } else if (status[1] === 'M') {
          modified.push(filePath);
        } else if (status === '??') {
          untracked.push(filePath);
        }
      });
      
      return { staged, modified, untracked };
    } catch {
      return { staged: [], modified: [], untracked: [] };
    }
  }

  private async analyzePackageJson(context: ProjectContext): Promise<void> {
    try {
      const packagePath = path.join(this.cwd, 'package.json');
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      
      context.packageManager = await this.detectPackageManager();
      
      // Detect React Native
      if (packageJson.dependencies?.['react-native'] || packageJson.devDependencies?.['@react-native-community/cli']) {
        context.type = 'react-native';
        context.frameworks.push('react-native');
        context.languages.push('javascript', 'typescript');
      }
      // Detect Web React
      else if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
        context.type = 'web-react';
        context.frameworks.push('react');
        context.languages.push('javascript', 'typescript');
      }
      // Detect Node.js backend
      else if (packageJson.dependencies?.express || packageJson.dependencies?.fastify || packageJson.dependencies?.koa) {
        context.type = 'nodejs';
        context.frameworks.push('nodejs');
        context.languages.push('javascript', 'typescript');
      }
      
      // Detect frameworks and tools
      this.detectFrameworksFromPackageJson(packageJson, context);
      this.detectBuildToolsFromPackageJson(packageJson, context);
      this.detectTestingFromPackageJson(packageJson, context);
      this.detectStylingFromPackageJson(packageJson, context);
      this.detectStateManagementFromPackageJson(packageJson, context);
      
    } catch (error) {
      // No package.json found or invalid
    }
  }

  private async analyzePythonProject(context: ProjectContext): Promise<void> {
    try {
      // Check for Python files
      const pythonFiles = ['requirements.txt', 'setup.py', 'pyproject.toml', 'Pipfile'];
      const hasPythonConfig = await Promise.all(
        pythonFiles.map(file => 
          fs.access(path.join(this.cwd, file)).then(() => true).catch(() => false)
        )
      );
      
      if (hasPythonConfig.some(exists => exists)) {
        context.type = 'python';
        context.languages.push('python');
        context.packageManager = 'pip';
        
        // Detect common Python frameworks
        const requirementsPath = path.join(this.cwd, 'requirements.txt');
        try {
          const requirements = await fs.readFile(requirementsPath, 'utf-8');
          if (requirements.includes('django')) context.frameworks.push('django');
          if (requirements.includes('flask')) context.frameworks.push('flask');
          if (requirements.includes('fastapi')) context.frameworks.push('fastapi');
          if (requirements.includes('streamlit')) context.frameworks.push('streamlit');
        } catch {}
      }
    } catch (error) {
      // Python analysis failed
    }
  }

  private async analyzeGoProject(context: ProjectContext): Promise<void> {
    try {
      const goModPath = path.join(this.cwd, 'go.mod');
      await fs.access(goModPath);
      
      context.type = 'go';
      context.languages.push('go');
      context.packageManager = 'go mod';
      
      // Detect Go frameworks
      const goMod = await fs.readFile(goModPath, 'utf-8');
      if (goMod.includes('gin-gonic/gin')) context.frameworks.push('gin');
      if (goMod.includes('gorilla/mux')) context.frameworks.push('gorilla');
      if (goMod.includes('fiber')) context.frameworks.push('fiber');
    } catch {
      // No Go project
    }
  }

  private async analyzeRustProject(context: ProjectContext): Promise<void> {
    try {
      const cargoPath = path.join(this.cwd, 'Cargo.toml');
      await fs.access(cargoPath);
      
      context.type = 'rust';
      context.languages.push('rust');
      context.packageManager = 'cargo';
      
      // Detect Rust frameworks
      const cargoToml = await fs.readFile(cargoPath, 'utf-8');
      if (cargoToml.includes('actix-web')) context.frameworks.push('actix-web');
      if (cargoToml.includes('warp')) context.frameworks.push('warp');
      if (cargoToml.includes('rocket')) context.frameworks.push('rocket');
    } catch {
      // No Rust project
    }
  }

  private async analyzeFileStructure(context: ProjectContext): Promise<void> {
    try {
      const files = await fs.readdir(this.cwd);
      
      // Look for common patterns
      if (files.includes('src') && files.includes('public') && files.includes('package.json')) {
        if (!context.frameworks.includes('react') && !context.frameworks.includes('react-native')) {
          context.patterns.push('standard-web-structure');
        }
      }
      
      if (files.includes('components') || files.includes('screens') || files.includes('pages')) {
        context.patterns.push('component-based-architecture');
      }
      
      if (files.includes('api') || files.includes('routes') || files.includes('controllers')) {
        context.patterns.push('mvc-pattern');
      }
      
      if (files.includes('services') || files.includes('utils') || files.includes('hooks')) {
        context.patterns.push('service-layer-pattern');
      }
      
      if (files.includes('__tests__') || files.includes('test') || files.includes('spec')) {
        context.patterns.push('test-driven-development');
      }
      
    } catch (error) {
      // File structure analysis failed
    }
  }

  private async analyzeGitStatus(context: ProjectContext): Promise<void> {
    try {
      if (!this.hasGitRepo()) return;
      
      context.hasGit = true;
      
      // Get current branch
      const branch = execSync('git branch --show-current', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
      
      // Check for uncommitted changes
      const status = execSync('git status --porcelain', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim();
      
      // Get recent files
      const recentFiles = execSync('git diff --name-only HEAD~3..HEAD', {
        cwd: this.cwd,
        encoding: 'utf-8'
      }).trim().split('\n').filter(Boolean).slice(0, 5);
      
      context.gitStatus = {
        branch,
        hasUncommittedChanges: status.length > 0,
        recentFiles
      };
      
    } catch (error) {
      // Git analysis failed
    }
  }

  private async detectDomainPatterns(context: ProjectContext): Promise<void> {
    try {
      // Read package.json or project files to detect domain
      const packagePath = path.join(this.cwd, 'package.json');
      let projectText = '';
      
      try {
        const packageContent = await fs.readFile(packagePath, 'utf-8');
        const packageJson = JSON.parse(packageContent);
        projectText += (packageJson.name || '') + ' ' + (packageJson.description || '');
      } catch {}
      
      // Add common file names to context
      const files = await fs.readdir(this.cwd).catch(() => []);
      projectText += ' ' + files.join(' ');
      
      const text = projectText.toLowerCase();
      
      // Domain detection patterns
      if (text.match(/fashion|clothing|style|outfit|wardrobe|apparel|designer/)) {
        context.domain = 'fashion';
      } else if (text.match(/shop|store|cart|checkout|payment|ecommerce|commerce/)) {
        context.domain = 'ecommerce';
      } else if (text.match(/finance|fintech|bank|payment|trading|investment/)) {
        context.domain = 'fintech';
      } else if (text.match(/game|gaming|player|score|level/)) {
        context.domain = 'gaming';
      } else if (text.match(/health|medical|patient|hospital|clinic/)) {
        context.domain = 'healthcare';
      } else if (text.match(/education|learning|course|student|teacher/)) {
        context.domain = 'education';
      }
      
    } catch (error) {
      // Domain detection failed
    }
  }

  private detectFrameworksFromPackageJson(packageJson: any, context: ProjectContext): void {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    // Frontend frameworks
    if (deps.next) context.frameworks.push('next.js');
    if (deps.gatsby) context.frameworks.push('gatsby');
    if (deps.vue) context.frameworks.push('vue');
    if (deps.angular) context.frameworks.push('angular');
    if (deps.svelte) context.frameworks.push('svelte');
    
    // Backend frameworks
    if (deps.express) context.frameworks.push('express');
    if (deps.fastify) context.frameworks.push('fastify');
    if (deps.koa) context.frameworks.push('koa');
    if (deps.nest) context.frameworks.push('nestjs');
    
    // Mobile
    if (deps.expo) context.frameworks.push('expo');
  }

  private detectBuildToolsFromPackageJson(packageJson: any, context: ProjectContext): void {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const scripts = packageJson.scripts || {};
    
    if (deps.webpack || scripts.build?.includes('webpack')) context.buildTools.push('webpack');
    if (deps.vite || scripts.build?.includes('vite')) context.buildTools.push('vite');
    if (deps.parcel) context.buildTools.push('parcel');
    if (deps.rollup) context.buildTools.push('rollup');
    if (deps.esbuild) context.buildTools.push('esbuild');
    if (deps.typescript || deps['@types/node']) context.buildTools.push('typescript');
  }

  private detectTestingFromPackageJson(packageJson: any, context: ProjectContext): void {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.jest) context.testFrameworks.push('jest');
    if (deps.vitest) context.testFrameworks.push('vitest');
    if (deps.mocha) context.testFrameworks.push('mocha');
    if (deps.cypress) context.testFrameworks.push('cypress');
    if (deps['@testing-library/react']) context.testFrameworks.push('react-testing-library');
    if (deps.playwright) context.testFrameworks.push('playwright');
  }

  private detectStylingFromPackageJson(packageJson: any, context: ProjectContext): void {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps['styled-components']) context.styling.push('styled-components');
    if (deps.emotion) context.styling.push('emotion');
    if (deps.tailwindcss) context.styling.push('tailwindcss');
    if (deps.sass || deps.scss) context.styling.push('sass');
    if (deps.less) context.styling.push('less');
  }

  private detectStateManagementFromPackageJson(packageJson: any, context: ProjectContext): void {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    if (deps.redux) context.stateManagement.push('redux');
    if (deps.zustand) context.stateManagement.push('zustand');
    if (deps.recoil) context.stateManagement.push('recoil');
    if (deps.mobx) context.stateManagement.push('mobx');
    if (deps['@tanstack/react-query']) context.stateManagement.push('react-query');
  }

  private async detectPackageManager(): Promise<ProjectContext['packageManager']> {
    try {
      const files = await fs.readdir(this.cwd);
      
      if (files.includes('yarn.lock')) return 'yarn';
      if (files.includes('pnpm-lock.yaml')) return 'pnpm';
      if (files.includes('package-lock.json')) return 'npm';
      
      return 'npm'; // Default
    } catch {
      return 'unknown';
    }
  }

  private classifyFileType(filePath: string, _content: string): FileAnalysis['type'] {
    const filename = path.basename(filePath).toLowerCase();
    
    if (filename.includes('test') || filename.includes('spec')) return 'test';
    if (filename.includes('readme') || filename.endsWith('.md')) return 'docs';
    if (filename.includes('config') || filename.startsWith('.')) return 'config';
    if (filePath.includes('assets') || filePath.includes('images')) return 'asset';
    
    return 'source';
  }

  private detectLanguage(extension: string, _content: string): string {
    const langMap: Record<string, string> = {
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.py': 'python',
      '.go': 'go',
      '.rs': 'rust',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.rb': 'ruby',
      '.php': 'php',
      '.swift': 'swift',
      '.kt': 'kotlin'
    };
    
    return langMap[extension] || 'unknown';
  }

  private detectFramework(content: string): string | undefined {
    if (content.includes('import React') || content.includes('from "react"')) return 'react';
    if (content.includes('import { Component }') && content.includes('react-native')) return 'react-native';
    if (content.includes('import express') || content.includes('from "express"')) return 'express';
    if (content.includes('import FastAPI') || content.includes('from fastapi')) return 'fastapi';
    if (content.includes('package main') && content.includes('func main')) return 'go';
    
    return undefined;
  }

  private detectPatterns(content: string): string[] {
    const patterns: string[] = [];
    
    if (content.includes('useState') || content.includes('useEffect')) patterns.push('react-hooks');
    if (content.includes('async') && content.includes('await')) patterns.push('async-await');
    if (content.includes('try') && content.includes('catch')) patterns.push('error-handling');
    if (content.includes('interface') || content.includes('type ')) patterns.push('typescript-types');
    if (content.includes('export default') || content.includes('module.exports')) patterns.push('module-exports');
    
    return patterns;
  }

  private assessComplexity(content: string): 'simple' | 'moderate' | 'complex' {
    const lines = content.split('\n').length;
    const functions = (content.match(/function |const .* = |=> |def /g) || []).length;
    const conditions = (content.match(/if |switch |for |while |\.map\(|\.filter\(/g) || []).length;
    
    const complexityScore = (lines / 10) + (functions * 2) + (conditions * 1.5);
    
    if (complexityScore > 50) return 'complex';
    if (complexityScore > 20) return 'moderate';
    return 'simple';
  }

  private calculateConfidence(context: ProjectContext): void {
    let score = 0;
    
    // Base score for detected type
    if (context.type !== 'unknown') score += 30;
    
    // Bonus for frameworks
    score += Math.min(context.frameworks.length * 10, 30);
    
    // Bonus for languages
    score += Math.min(context.languages.length * 5, 20);
    
    // Bonus for build tools and patterns
    score += Math.min((context.buildTools.length + context.patterns.length) * 2, 20);
    
    context.confidence = Math.min(score, 100);
  }

  private hasGitRepo(): boolean {
    try {
      execSync('git rev-parse --git-dir', { cwd: this.cwd, stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Clear cache for fresh analysis
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Set working directory
   */
  setWorkingDirectory(directory: string): void {
    this.cwd = directory;
    this.clearCache();
  }
}