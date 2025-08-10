/**
 * Topic Extraction Utility for Human-Readable Folder Names
 * Extracts 1-3 keywords from prompts to create meaningful folder names
 */

export interface TopicExtractionResult {
  topics: string[];
  confidence: number;
  fallback: string;
}

export class TopicExtractor {
  private static commonWords = new Set([
    'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'he', 
    'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the', 'to', 'was', 'will', 
    'with', 'you', 'your', 'i', 'me', 'my', 'we', 'us', 'our', 'they', 'them',
    'this', 'these', 'those', 'can', 'could', 'should', 'would', 'do', 'does',
    'did', 'have', 'had', 'what', 'when', 'where', 'who', 'why', 'how', 'help'
  ]);

  private static technicalKeywords = new Map([
    // Programming languages
    ['javascript', 'js'], ['typescript', 'ts'], ['python', 'py'], ['react', 'react'],
    ['nodejs', 'node'], ['vue', 'vue'], ['angular', 'angular'], ['java', 'java'],
    ['csharp', 'cs'], ['go', 'go'], ['rust', 'rust'], ['php', 'php'],
    
    // Technologies
    ['database', 'db'], ['api', 'api'], ['graphql', 'gql'], ['rest', 'rest'],
    ['docker', 'docker'], ['kubernetes', 'k8s'], ['aws', 'aws'], ['azure', 'azure'],
    ['mongodb', 'mongo'], ['mysql', 'mysql'], ['postgresql', 'postgres'],
    ['redis', 'redis'], ['elasticsearch', 'elastic'],
    
    // Concepts
    ['authentication', 'auth'], ['authorization', 'authz'], ['security', 'security'],
    ['performance', 'perf'], ['optimization', 'optimize'], ['testing', 'test'],
    ['debugging', 'debug'], ['deployment', 'deploy'], ['monitoring', 'monitor'],
    ['architecture', 'arch'], ['design', 'design'], ['patterns', 'patterns'],
    ['algorithm', 'algo'], ['datastructure', 'data-structure']
  ]);

  /**
   * Extract meaningful topics from a prompt
   */
  static extractTopics(prompt: string): TopicExtractionResult {
    if (!prompt || prompt.trim().length === 0) {
      return {
        topics: [],
        confidence: 0,
        fallback: 'unknown-topic'
      };
    }

    const cleanPrompt = prompt.toLowerCase().trim();
    const words = cleanPrompt
      .replace(/[^\w\s-]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.commonWords.has(word));

    const scores = new Map<string, number>();

    // Score technical keywords higher
    for (const word of words) {
      let score = 1;
      let finalWord = word;

      // Check for technical keywords
      for (const [full, short] of this.technicalKeywords.entries()) {
        if (word.includes(full) || full.includes(word)) {
          score += 3;
          finalWord = short;
          break;
        }
      }

      // Score by word characteristics
      if (word.length >= 6) score += 1;
      if (/^[a-z]+$/.test(word)) score += 1; // prefer single words
      if (word.includes('-') || word.includes('_')) score += 1; // compound words

      const existing = scores.get(finalWord) || 0;
      scores.set(finalWord, existing + score);
    }

    // Get top 3 topics
    const sortedTopics = Array.from(scores.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    const extractedTopics = sortedTopics.map(([word]) => this.sanitizeForFilename(word));
    const confidence = sortedTopics.length > 0 ? Math.min(sortedTopics[0][1] / 5, 1) : 0;

    // Fallback generation
    let fallback = 'general-query';
    if (cleanPrompt.includes('help')) fallback = 'help-request';
    if (cleanPrompt.includes('how')) fallback = 'how-to';
    if (cleanPrompt.includes('what')) fallback = 'explanation';
    if (cleanPrompt.includes('debug') || cleanPrompt.includes('error')) fallback = 'debugging';
    if (cleanPrompt.includes('implement') || cleanPrompt.includes('create')) fallback = 'implementation';
    if (cleanPrompt.includes('optimize') || cleanPrompt.includes('improve')) fallback = 'optimization';

    return {
      topics: extractedTopics,
      confidence,
      fallback: this.sanitizeForFilename(fallback)
    };
  }

  /**
   * Generate a human-readable folder name
   */
  static generateFolderName(prompt: string, timestamp?: Date): string {
    const date = timestamp || new Date();
    const dateStr = date.toISOString().split('T')[0]; // 2025-08-10
    const timeStr = date.toTimeString().slice(0, 5).replace(':', '-'); // 00-07

    const extraction = this.extractTopics(prompt);
    let topicPart = '';

    if (extraction.topics.length > 0 && extraction.confidence > 0.3) {
      topicPart = extraction.topics.join('-');
    } else {
      topicPart = extraction.fallback;
    }

    // Ensure the topic part isn't too long
    if (topicPart.length > 40) {
      topicPart = topicPart.substring(0, 40).replace(/-[^-]*$/, ''); // Cut at word boundary
    }

    return `${dateStr}_${timeStr}_${topicPart}`;
  }

  /**
   * Sanitize text for use in filenames
   */
  private static sanitizeForFilename(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-')     // Replace spaces with hyphens
      .replace(/-+/g, '-')      // Collapse multiple hyphens
      .replace(/^-|-$/g, '');   // Remove leading/trailing hyphens
  }

  /**
   * Legacy folder name compatibility check
   */
  static isLegacyName(folderName: string): boolean {
    return /^run-[a-z0-9]+-[a-z0-9]+-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z$/.test(folderName);
  }

  /**
   * Parse timestamp from folder name (works for both formats)
   */
  static parseTimestamp(folderName: string): Date | null {
    // New format: 2025-08-10_00-07_topic
    const newFormatMatch = folderName.match(/^(\d{4}-\d{2}-\d{2})_(\d{2})-(\d{2})/);
    if (newFormatMatch) {
      const [, date, hour, minute] = newFormatMatch;
      return new Date(`${date}T${hour}:${minute}:00.000Z`);
    }

    // Legacy format: run-id-2025-08-10T00-07-19-936Z
    const legacyMatch = folderName.match(/(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)/);
    if (legacyMatch) {
      const timestampStr = legacyMatch[1];
      // Convert 2025-08-10T00-07-19-936Z to proper ISO format
      const properIso = timestampStr
        .replace(/T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z$/, 'T$1:$2:$3.$4Z');
      return new Date(properIso);
    }

    return null;
  }
}