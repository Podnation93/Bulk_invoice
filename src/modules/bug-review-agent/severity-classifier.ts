import {
  BugReport,
  ExtractedBugFields,
  SeveritySuggestion,
  SeverityLevel,
  ReproducibilityEstimate,
  PrioritySuggestion,
  ClarifyingQuestion,
} from './types';

/**
 * Classifies bug severity and priority based on various signals
 */
export class SeverityClassifier {
  private componentWeights: Record<string, number> = {
    'PDF Processor': 0.9,
    'OCR Engine': 0.85,
    'Validation Layer': 0.8,
    'Export Module': 0.95,
    'User Interface': 0.7,
    'AI Assistant': 0.6,
  };

  /**
   * Classify bug severity
   */
  classifySeverity(
    report: BugReport,
    fields: ExtractedBugFields
  ): SeveritySuggestion {
    let score = 0;
    const reasons: string[] = [];

    // Check for crash/data loss indicators
    if (this.indicatesCrash(report.body)) {
      score += 40;
      reasons.push('Application crash detected');
    }

    if (this.indicatesDataLoss(report.body)) {
      score += 35;
      reasons.push('Potential data loss or corruption');
    }

    // Check for security issues
    if (this.indicatesSecurityIssue(report.body)) {
      score += 45;
      reasons.push('Security vulnerability indicated');
    }

    // Check for blocking issues
    if (this.isBlockingIssue(report.body)) {
      score += 30;
      reasons.push('Blocks core functionality');
    }

    // Component importance
    if (fields.component && this.componentWeights[fields.component]) {
      const componentScore = this.componentWeights[fields.component] * 20;
      score += componentScore;
      reasons.push(`Critical component: ${fields.component}`);
    }

    // Error frequency indicators
    if (this.indicatesFrequentOccurrence(report.body)) {
      score += 15;
      reasons.push('Issue occurs frequently');
    }

    // User impact indicators
    const userImpactScore = this.assessUserImpact(report.body);
    score += userImpactScore;
    if (userImpactScore > 10) {
      reasons.push('Significant user impact');
    }

    // Determine severity level
    const severity = this.scoreToSeverity(score);
    const confidence = this.calculateConfidence(score, reasons.length);

    return {
      level: severity,
      confidence,
      reasoning: reasons.join('; '),
    };
  }

  /**
   * Estimate reproducibility
   */
  estimateReproducibility(
    report: BugReport,
    fields: ExtractedBugFields
  ): ReproducibilityEstimate {
    let reproducibilityScore = 0;
    const checklist: string[] = [];
    const missingInfo: string[] = [];

    // Check for steps to reproduce
    if (fields.stepsToReproduce.length > 0) {
      reproducibilityScore += 30;
      checklist.push('Steps to reproduce provided');
    } else {
      missingInfo.push('Clear steps to reproduce');
    }

    // Check for environment info
    if (fields.os) {
      reproducibilityScore += 10;
      checklist.push('Operating system specified');
    } else {
      missingInfo.push('Operating system information');
    }

    if (fields.version) {
      reproducibilityScore += 15;
      checklist.push('Application version specified');
    } else {
      missingInfo.push('Application version');
    }

    // Check for error codes
    if (fields.errorCodes.length > 0) {
      reproducibilityScore += 15;
      checklist.push('Error codes captured');
    }

    // Check for attachments
    const hasLogs = report.attachments.some((a) => a.type === 'log');
    const hasScreenshots = report.attachments.some((a) => a.type === 'screenshot');
    const hasStackTrace = report.attachments.some((a) => a.type === 'stack_trace');

    if (hasStackTrace) {
      reproducibilityScore += 20;
      checklist.push('Stack trace included');
    }

    if (hasLogs) {
      reproducibilityScore += 10;
      checklist.push('Log files attached');
    }

    if (hasScreenshots) {
      reproducibilityScore += 5;
      checklist.push('Screenshots provided');
    }

    // Check for sample data
    if (this.mentionsSampleData(report.body)) {
      reproducibilityScore += 15;
      checklist.push('Sample data mentioned');
    } else {
      missingInfo.push('Sample PDF files to reproduce');
    }

    // Determine level
    let level: 'likely' | 'possible' | 'not_reproducible';
    if (reproducibilityScore >= 70) {
      level = 'likely';
    } else if (reproducibilityScore >= 40) {
      level = 'possible';
    } else {
      level = 'not_reproducible';
    }

    const confidence = Math.min(95, reproducibilityScore);

    return {
      level,
      confidence,
      checklist,
      missingInfo,
    };
  }

  /**
   * Suggest priority and effort
   */
  suggestPriority(
    severitySuggestion: SeveritySuggestion,
    reproducibility: ReproducibilityEstimate,
    fields: ExtractedBugFields
  ): PrioritySuggestion {
    // Determine backlog bucket
    let bucket: string;
    switch (severitySuggestion.level) {
      case 'P0':
        bucket = 'Critical - Fix Immediately';
        break;
      case 'P1':
        bucket = 'High Priority - Current Sprint';
        break;
      case 'P2':
        bucket = 'Medium Priority - Next Sprint';
        break;
      case 'P3':
        bucket = 'Low Priority - Backlog';
        break;
      case 'P4':
        bucket = 'Nice to Have - Future Consideration';
        break;
    }

    // Estimate effort
    let effort: 'S' | 'M' | 'L' | 'XL' = 'M';
    const complexity = this.estimateComplexity(fields);

    if (complexity < 30) effort = 'S';
    else if (complexity < 60) effort = 'M';
    else if (complexity < 80) effort = 'L';
    else effort = 'XL';

    const confidence =
      (severitySuggestion.confidence + reproducibility.confidence) / 2;

    return {
      backlogBucket: bucket,
      estimatedEffort: effort,
      confidence,
    };
  }

  /**
   * Generate clarifying questions for missing information
   */
  generateClarifyingQuestions(
    fields: ExtractedBugFields,
    reproducibility: ReproducibilityEstimate
  ): ClarifyingQuestion[] {
    const questions: ClarifyingQuestion[] = [];

    for (const missing of reproducibility.missingInfo) {
      switch (missing) {
        case 'Clear steps to reproduce':
          questions.push({
            question:
              'Can you provide step-by-step instructions to reproduce this issue?',
            field: 'stepsToReproduce',
            priority: 'high',
          });
          break;

        case 'Operating system information':
          questions.push({
            question:
              'What operating system are you using (e.g., Windows 10, macOS 14)?',
            field: 'os',
            priority: 'medium',
          });
          break;

        case 'Application version':
          questions.push({
            question: 'Which version of Bulk Invoice Extractor are you running?',
            field: 'version',
            priority: 'high',
          });
          break;

        case 'Sample PDF files to reproduce':
          questions.push({
            question:
              'Can you share a sample PDF (with sensitive data redacted) that triggers this issue?',
            field: 'attachments',
            priority: 'high',
          });
          break;
      }
    }

    if (fields.stepsToReproduce.length > 0 && fields.stepsToReproduce.length < 3) {
      questions.push({
        question: 'Are there any additional steps between the ones you provided?',
        field: 'stepsToReproduce',
        priority: 'medium',
      });
    }

    if (!fields.browser) {
      questions.push({
        question: 'If this is a UI issue, which browser/Electron version are you using?',
        field: 'browser',
        priority: 'low',
      });
    }

    return questions.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  /**
   * Check if report indicates a crash
   */
  private indicatesCrash(text: string): boolean {
    const crashPatterns = [
      /crash/i,
      /unresponsive/i,
      /not responding/i,
      /frozen/i,
      /hang/i,
      /force quit/i,
      /fatal error/i,
      /uncaught exception/i,
    ];

    return crashPatterns.some((p) => p.test(text));
  }

  /**
   * Check if report indicates data loss
   */
  private indicatesDataLoss(text: string): boolean {
    const dataLossPatterns = [
      /data\s*loss/i,
      /lost\s*data/i,
      /corrupt/i,
      /missing\s*data/i,
      /data\s*not\s*saved/i,
      /file\s*not\s*found/i,
      /csv\s*empty/i,
      /no\s*output/i,
    ];

    return dataLossPatterns.some((p) => p.test(text));
  }

  /**
   * Check if report indicates security issue
   */
  private indicatesSecurityIssue(text: string): boolean {
    const securityPatterns = [
      /security/i,
      /vulnerability/i,
      /injection/i,
      /unauthorized/i,
      /leak/i,
      /exposure/i,
      /sensitive\s*data/i,
    ];

    return securityPatterns.some((p) => p.test(text));
  }

  /**
   * Check if issue blocks core functionality
   */
  private isBlockingIssue(text: string): boolean {
    const blockingPatterns = [
      /cannot\s+(?:process|upload|export|open)/i,
      /unable\s+to/i,
      /completely\s+broken/i,
      /doesn't\s+work/i,
      /fails\s+(?:every|all)/i,
      /blocking/i,
    ];

    return blockingPatterns.some((p) => p.test(text));
  }

  /**
   * Check if issue occurs frequently
   */
  private indicatesFrequentOccurrence(text: string): boolean {
    const frequencyPatterns = [
      /always/i,
      /every\s+time/i,
      /consistently/i,
      /repeatedly/i,
      /100%\s+of\s+the\s+time/i,
      /all\s+(?:pdfs?|files?)/i,
    ];

    return frequencyPatterns.some((p) => p.test(text));
  }

  /**
   * Assess user impact from text
   */
  private assessUserImpact(text: string): number {
    let score = 0;

    if (/all\s+users/i.test(text)) score += 20;
    if (/production/i.test(text)) score += 15;
    if (/urgent/i.test(text)) score += 10;
    if (/deadline/i.test(text)) score += 10;
    if (/multiple\s+(?:users|clients)/i.test(text)) score += 15;

    return score;
  }

  /**
   * Check if sample data is mentioned
   */
  private mentionsSampleData(text: string): boolean {
    const samplePatterns = [/sample/i, /example/i, /attached.*pdf/i, /test\s+file/i];

    return samplePatterns.some((p) => p.test(text));
  }

  /**
   * Convert score to severity level
   */
  private scoreToSeverity(score: number): SeverityLevel {
    if (score >= 90) return 'P0';
    if (score >= 70) return 'P1';
    if (score >= 50) return 'P2';
    if (score >= 30) return 'P3';
    return 'P4';
  }

  /**
   * Calculate confidence based on evidence
   */
  private calculateConfidence(score: number, reasonCount: number): number {
    // Base confidence from number of reasons
    let confidence = 50 + reasonCount * 10;

    // Adjust based on score clarity
    if (score > 80 || score < 20) {
      confidence += 15; // High or low scores are more certain
    }

    return Math.min(95, confidence);
  }

  /**
   * Estimate complexity of fix
   */
  private estimateComplexity(fields: ExtractedBugFields): number {
    let complexity = 50; // Base complexity

    // Multiple components increase complexity
    if (fields.errorCodes.length > 3) complexity += 20;

    // Core components are more complex
    if (
      fields.component === 'OCR Engine' ||
      fields.component === 'PDF Processor'
    ) {
      complexity += 15;
    }

    // Multiple user actions suggest complex flow
    if (fields.userActions.length > 5) complexity += 10;

    return complexity;
  }
}

export default SeverityClassifier;
