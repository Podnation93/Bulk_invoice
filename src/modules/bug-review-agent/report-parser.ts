import {
  BugReport,
  ExtractedBugFields,
  BugSummary,
  Evidence,
} from './types';

/**
 * Parses and normalizes bug reports from various sources
 */
export class BugReportParser {
  /**
   * Parse a raw bug report into structured fields
   */
  parseReport(report: BugReport): ExtractedBugFields {
    const text = `${report.title}\n${report.body}`;
    const attachmentText = this.extractTextFromAttachments(report.attachments);
    const fullText = `${text}\n${attachmentText}`;

    return {
      product: this.extractProduct(fullText, report.metadata),
      component: this.extractComponent(fullText, report.metadata),
      os: this.extractOS(fullText, report.metadata),
      browser: this.extractBrowser(fullText, report.metadata),
      device: this.extractDevice(fullText, report.metadata),
      version: this.extractVersion(fullText, report.metadata),
      environment: this.extractEnvironment(fullText, report.metadata),
      stepsToReproduce: this.extractStepsToReproduce(report.body),
      errorCodes: this.extractErrorCodes(fullText),
      timestamps: this.extractTimestamps(fullText),
      userActions: this.extractUserActions(fullText),
      configValues: this.extractConfigValues(fullText),
    };
  }

  /**
   * Generate a standardized summary from the report
   */
  generateSummary(report: BugReport, extractedFields: ExtractedBugFields): BugSummary {
    const title = this.generateConciseTitle(report);
    const description = this.generateDescription(report, extractedFields);
    const expectedBehavior = this.extractExpectedBehavior(report.body);
    const actualBehavior = this.extractActualBehavior(report.body);

    return {
      title,
      description,
      expectedBehavior,
      actualBehavior,
    };
  }

  /**
   * Extract text content from attachments
   */
  private extractTextFromAttachments(
    attachments: BugReport['attachments']
  ): string {
    const textContent: string[] = [];

    for (const attachment of attachments) {
      switch (attachment.type) {
        case 'log':
        case 'stack_trace':
          textContent.push(attachment.content);
          break;
        case 'config':
          textContent.push(`Config: ${attachment.content}`);
          break;
        // Screenshots and videos would need OCR processing
      }
    }

    return textContent.join('\n');
  }

  /**
   * Extract product name
   */
  private extractProduct(
    text: string,
    metadata: BugReport['metadata']
  ): string | undefined {
    if (metadata.repo) {
      const repoName = metadata.repo.split('/').pop();
      return repoName;
    }

    const productPatterns = [
      /product\s*[:\-]\s*([^\n]+)/i,
      /app\s*[:\-]\s*([^\n]+)/i,
      /service\s*[:\-]\s*([^\n]+)/i,
    ];

    for (const pattern of productPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return 'Bulk Invoice Extractor';
  }

  /**
   * Extract component
   */
  private extractComponent(
    text: string,
    metadata: BugReport['metadata']
  ): string | undefined {
    const componentPatterns = [
      /component\s*[:\-]\s*([^\n]+)/i,
      /module\s*[:\-]\s*([^\n]+)/i,
      /area\s*[:\-]\s*([^\n]+)/i,
    ];

    for (const pattern of componentPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    // Infer from keywords
    if (/ocr|text\s*extraction|tesseract/i.test(text)) return 'OCR Engine';
    if (/pdf|parsing|upload/i.test(text)) return 'PDF Processor';
    if (/validation|error|invalid/i.test(text)) return 'Validation Layer';
    if (/csv|export|xero/i.test(text)) return 'Export Module';
    if (/ui|interface|button|click/i.test(text)) return 'User Interface';
    if (/ai|gemini|chatbot/i.test(text)) return 'AI Assistant';

    return metadata.labels?.find((l) => l.includes('component:'))?.replace('component:', '');
  }

  /**
   * Extract OS information
   */
  private extractOS(
    text: string,
    metadata: BugReport['metadata']
  ): string | undefined {
    if (metadata.os) return metadata.os;

    const osPatterns = [
      /(windows\s*\d+)/i,
      /(macos\s*[\d.]+)/i,
      /(mac\s*os\s*[\d.]+)/i,
      /(ubuntu\s*[\d.]+)/i,
      /(linux)/i,
    ];

    for (const pattern of osPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return undefined;
  }

  /**
   * Extract browser information
   */
  private extractBrowser(
    text: string,
    metadata: BugReport['metadata']
  ): string | undefined {
    if (metadata.browser) return metadata.browser;

    const browserPatterns = [
      /(chrome\s*[\d.]+)/i,
      /(firefox\s*[\d.]+)/i,
      /(safari\s*[\d.]+)/i,
      /(edge\s*[\d.]+)/i,
      /(electron\s*[\d.]+)/i,
    ];

    for (const pattern of browserPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return undefined;
  }

  /**
   * Extract device information
   */
  private extractDevice(
    text: string,
    metadata: BugReport['metadata']
  ): string | undefined {
    if (metadata.device) return metadata.device;

    const devicePatterns = [/device\s*[:\-]\s*([^\n]+)/i, /model\s*[:\-]\s*([^\n]+)/i];

    for (const pattern of devicePatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return undefined;
  }

  /**
   * Extract version information
   */
  private extractVersion(
    text: string,
    metadata: BugReport['metadata']
  ): string | undefined {
    if (metadata.version) return metadata.version;

    const versionPatterns = [
      /version\s*[:\-]\s*([^\n]+)/i,
      /v([\d.]+)/i,
      /release\s*[:\-]\s*([^\n]+)/i,
    ];

    for (const pattern of versionPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return undefined;
  }

  /**
   * Extract environment
   */
  private extractEnvironment(
    text: string,
    metadata: BugReport['metadata']
  ): string | undefined {
    if (metadata.environment) return metadata.environment;

    const envPatterns = [
      /environment\s*[:\-]\s*([^\n]+)/i,
      /env\s*[:\-]\s*([^\n]+)/i,
      /(production|staging|development|dev|prod|test)/i,
    ];

    for (const pattern of envPatterns) {
      const match = text.match(pattern);
      if (match) return match[1].trim();
    }

    return undefined;
  }

  /**
   * Extract steps to reproduce
   */
  private extractStepsToReproduce(body: string): string[] {
    const steps: string[] = [];

    // Look for numbered steps
    const numberedPattern = /^\s*\d+[.)]\s*(.+)$/gm;
    let match;
    while ((match = numberedPattern.exec(body)) !== null) {
      steps.push(match[1].trim());
    }

    if (steps.length > 0) return steps;

    // Look for "Steps to reproduce" section
    const stepsSection = body.match(
      /steps?\s*(?:to\s*)?reproduce[:\-]?\s*([\s\S]*?)(?:expected|actual|$)/i
    );
    if (stepsSection) {
      const lines = stepsSection[1]
        .split('\n')
        .filter((l) => l.trim().length > 0);
      steps.push(...lines.map((l) => l.trim()));
    }

    // If still no steps, try to infer from bullet points
    if (steps.length === 0) {
      const bulletPattern = /^[\-\*]\s*(.+)$/gm;
      while ((match = bulletPattern.exec(body)) !== null) {
        steps.push(match[1].trim());
      }
    }

    return steps;
  }

  /**
   * Extract error codes
   */
  private extractErrorCodes(text: string): string[] {
    const codes: string[] = [];

    const patterns = [
      /error\s*(?:code)?\s*[:\-]?\s*([A-Z0-9_]+)/gi,
      /\[([A-Z_]+_ERROR)\]/g,
      /E\d{4}/g,
      /0x[0-9A-Fa-f]+/g,
    ];

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const code = match[1] || match[0];
        if (!codes.includes(code)) {
          codes.push(code);
        }
      }
    }

    return codes;
  }

  /**
   * Extract timestamps
   */
  private extractTimestamps(text: string): string[] {
    const timestamps: string[] = [];

    const patterns = [
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g,
      /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2}/g,
      /\d{2}:\d{2}:\d{2}\.\d{3}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.match(pattern) || [];
      timestamps.push(...matches);
    }

    return [...new Set(timestamps)].slice(0, 10);
  }

  /**
   * Extract user actions
   */
  private extractUserActions(text: string): string[] {
    const actions: string[] = [];

    const actionPatterns = [
      /(?:i|user)\s+(clicked|pressed|entered|typed|selected|uploaded|downloaded|opened|closed)/gi,
      /(click(?:ed)?|press(?:ed)?|enter(?:ed)?|select(?:ed)?|upload(?:ed)?)\s+(?:on\s+)?["']?([^"'\n]+)["']?/gi,
    ];

    for (const pattern of actionPatterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        actions.push(match[0].trim());
      }
    }

    return actions.slice(0, 20);
  }

  /**
   * Extract configuration values
   */
  private extractConfigValues(text: string): Record<string, string> {
    const configs: Record<string, string> = {};

    const configPattern = /([A-Z_]+)\s*[=:]\s*["']?([^"'\n]+)["']?/g;
    let match;

    while ((match = configPattern.exec(text)) !== null) {
      const key = match[1];
      const value = match[2].trim();
      if (key.length > 2 && key.length < 50) {
        configs[key] = value;
      }
    }

    return configs;
  }

  /**
   * Generate concise title
   */
  private generateConciseTitle(report: BugReport): string {
    // If title is already concise, use it
    if (report.title.length <= 80) {
      return report.title;
    }

    // Truncate and clean up
    let title = report.title.substring(0, 77) + '...';

    // Try to extract key information
    const errorMatch = report.title.match(/error[:\s]+(.+)/i);
    if (errorMatch) {
      title = `Error: ${errorMatch[1].substring(0, 70)}`;
    }

    return title;
  }

  /**
   * Generate description
   */
  private generateDescription(
    report: BugReport,
    fields: ExtractedBugFields
  ): string {
    let description = '';

    if (fields.component) {
      description += `Issue in ${fields.component}. `;
    }

    // Extract first meaningful sentence
    const firstSentence = report.body.match(/^[^.!?]+[.!?]/);
    if (firstSentence) {
      description += firstSentence[0].trim() + ' ';
    }

    if (fields.errorCodes.length > 0) {
      description += `Error codes: ${fields.errorCodes.slice(0, 3).join(', ')}. `;
    }

    if (fields.stepsToReproduce.length > 0) {
      description += `Reproducible in ${fields.stepsToReproduce.length} steps.`;
    }

    return description.trim() || report.body.substring(0, 200);
  }

  /**
   * Extract expected behavior
   */
  private extractExpectedBehavior(body: string): string {
    const patterns = [
      /expected\s*(?:behavior|result|outcome)?[:\-]?\s*([\s\S]*?)(?:actual|but|however|instead|$)/i,
      /should\s+([\s\S]*?)(?:\.|but|however)/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && match[1].trim().length > 0) {
        return match[1].trim().substring(0, 500);
      }
    }

    return 'Expected normal operation without errors';
  }

  /**
   * Extract actual behavior
   */
  private extractActualBehavior(body: string): string {
    const patterns = [
      /actual\s*(?:behavior|result|outcome)?[:\-]?\s*([\s\S]*?)(?:expected|$)/i,
      /(?:but|however|instead)[,\s]+([\s\S]*?)(?:\.|$)/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match && match[1].trim().length > 0) {
        return match[1].trim().substring(0, 500);
      }
    }

    return 'See description above';
  }

  /**
   * Extract stack trace frames as evidence
   */
  extractStackTraceEvidence(stackTrace: string): Evidence[] {
    const evidence: Evidence[] = [];
    const framePattern = /at\s+([^\s(]+)\s+\(([^:]+):(\d+)/g;

    let match;
    while ((match = framePattern.exec(stackTrace)) !== null) {
      evidence.push({
        type: 'stack_frame',
        description: `Function ${match[1]} at line ${match[3]}`,
        file: match[2],
        line: parseInt(match[3]),
        snippet: match[0],
      });
    }

    return evidence.slice(0, 10);
  }
}

export default BugReportParser;
