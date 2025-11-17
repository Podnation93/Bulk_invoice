import {
  BugReport,
  ExtractedBugFields,
  RootCauseHypothesis,
  Evidence,
  CodeLocation,
  OwnerSuggestion,
  TestSuggestion,
  PatchSuggestion,
  RecommendedAction,
} from './types';

/**
 * Analyzes bug reports to generate root cause hypotheses and suggestions
 */
export class RootCauseAnalyzer {
  private codeOwnership: Record<string, string> = {
    'pdf-processor': 'core-team',
    ocr: 'core-team',
    parser: 'core-team',
    validation: 'data-quality-team',
    formatter: 'data-quality-team',
    export: 'integration-team',
    'ai-assistant': 'ai-team',
    renderer: 'frontend-team',
    main: 'platform-team',
  };

  /**
   * Generate root cause hypotheses based on evidence
   */
  generateHypotheses(
    report: BugReport,
    fields: ExtractedBugFields
  ): RootCauseHypothesis[] {
    const hypotheses: RootCauseHypothesis[] = [];

    // Analyze error codes
    for (const errorCode of fields.errorCodes) {
      const hypothesis = this.hypothesizeFromErrorCode(errorCode, fields);
      if (hypothesis) {
        hypotheses.push(hypothesis);
      }
    }

    // Analyze stack traces
    const stackTraceAttachments = report.attachments.filter(
      (a) => a.type === 'stack_trace'
    );
    for (const attachment of stackTraceAttachments) {
      const stackHypotheses = this.hypothesizeFromStackTrace(attachment.content);
      hypotheses.push(...stackHypotheses);
    }

    // Analyze component-specific patterns
    if (fields.component) {
      const componentHypothesis = this.hypothesizeFromComponent(
        fields.component,
        report.body
      );
      if (componentHypothesis) {
        hypotheses.push(componentHypothesis);
      }
    }

    // Analyze text patterns
    const textHypotheses = this.hypothesizeFromTextPatterns(report.body);
    hypotheses.push(...textHypotheses);

    // Sort by confidence
    hypotheses.sort((a, b) => b.confidence - a.confidence);

    return hypotheses.slice(0, 5);
  }

  /**
   * Identify code locations related to the bug
   */
  identifyCodeLocations(
    fields: ExtractedBugFields,
    hypotheses: RootCauseHypothesis[]
  ): CodeLocation[] {
    const locations: CodeLocation[] = [];

    // Add locations from hypotheses
    for (const hypothesis of hypotheses) {
      for (const evidence of hypothesis.evidence) {
        if (evidence.file && evidence.line) {
          locations.push({
            file: evidence.file,
            function: evidence.snippet?.split('(')[0].replace('at ', ''),
            module: this.inferModule(evidence.file),
            confidence: hypothesis.confidence,
          });
        }
      }
    }

    // Add component-specific locations
    if (fields.component) {
      const componentLocations = this.getComponentLocations(fields.component);
      locations.push(...componentLocations);
    }

    // Remove duplicates
    const uniqueLocations = this.deduplicateLocations(locations);

    return uniqueLocations.slice(0, 10);
  }

  /**
   * Suggest code owner/team
   */
  suggestOwner(
    fields: ExtractedBugFields,
    codeLocations: CodeLocation[]
  ): OwnerSuggestion {
    const ownerCounts = new Map<string, number>();

    // Count ownership based on code locations
    for (const location of codeLocations) {
      const module = location.module.toLowerCase();
      for (const [pattern, owner] of Object.entries(this.codeOwnership)) {
        if (module.includes(pattern)) {
          ownerCounts.set(owner, (ownerCounts.get(owner) || 0) + 1);
        }
      }
    }

    // Component-based ownership
    if (fields.component) {
      const componentOwner = this.getComponentOwner(fields.component);
      if (componentOwner) {
        ownerCounts.set(componentOwner, (ownerCounts.get(componentOwner) || 0) + 3);
      }
    }

    // Find top owner
    const sortedOwners = Array.from(ownerCounts.entries()).sort(
      (a, b) => b[1] - a[1]
    );

    if (sortedOwners.length === 0) {
      return {
        team: 'core-team',
        confidence: 50,
        reasoning: 'Default assignment - no clear ownership signals',
        alternativeOwners: [],
      };
    }

    const topOwner = sortedOwners[0];
    const alternatives = sortedOwners.slice(1, 4).map(([team]) => team);
    const confidence = Math.min(95, 60 + topOwner[1] * 10);

    return {
      team: topOwner[0],
      confidence,
      reasoning: `Based on ${codeLocations.length} code locations and component ${fields.component}`,
      alternativeOwners: alternatives,
    };
  }

  /**
   * Suggest tests to add or run
   */
  suggestTests(
    fields: ExtractedBugFields,
    hypotheses: RootCauseHypothesis[]
  ): TestSuggestion[] {
    const suggestions: TestSuggestion[] = [];

    // Suggest unit tests based on component
    if (fields.component) {
      suggestions.push({
        type: 'unit',
        description: `Add unit test for ${fields.component} covering the error scenario`,
        targetModule: fields.component.toLowerCase().replace(/\s+/g, '-'),
      });
    }

    // Suggest integration tests for data flow
    if (
      fields.errorCodes.some((e) =>
        /(validation|format|parse|extract)/i.test(e)
      )
    ) {
      suggestions.push({
        type: 'integration',
        description: 'Add integration test for PDF to CSV conversion pipeline',
        targetModule: 'pipeline',
      });
    }

    // Suggest E2E tests for user-facing issues
    if (fields.userActions.length > 0) {
      suggestions.push({
        type: 'e2e',
        description: `Add E2E test covering user workflow: ${fields.userActions.slice(0, 3).join(' -> ')}`,
        targetModule: 'workflows',
      });
    }

    // Suggest tests based on hypotheses
    for (const hypothesis of hypotheses.slice(0, 2)) {
      suggestions.push({
        type: 'unit',
        description: `Test hypothesis: ${hypothesis.hypothesis}`,
        targetModule: hypothesis.evidence[0]?.file || 'core',
      });
    }

    return suggestions.slice(0, 5);
  }

  /**
   * Suggest patch for simple/obvious fixes
   */
  suggestPatch(
    fields: ExtractedBugFields,
    hypotheses: RootCauseHypothesis[]
  ): PatchSuggestion | undefined {
    // Only suggest patches for high-confidence, simple issues
    const topHypothesis = hypotheses[0];
    if (!topHypothesis || topHypothesis.confidence < 80) {
      return undefined;
    }

    // Check for common patterns
    if (/null|undefined|missing/i.test(topHypothesis.hypothesis)) {
      return {
        description: 'Add null/undefined check before accessing property',
        pseudoCode: `
if (!value || value === undefined) {
  // Handle missing value
  return defaultValue;
}
// Proceed with operation
        `.trim(),
        riskLevel: 'low',
        confidence: 75,
      };
    }

    if (/format|date|parse/i.test(topHypothesis.hypothesis)) {
      return {
        description: 'Add input validation and format normalization',
        pseudoCode: `
// Validate input format
if (!isValidFormat(input)) {
  input = normalizeFormat(input);
}
// Proceed with parsing
        `.trim(),
        riskLevel: 'medium',
        confidence: 70,
      };
    }

    if (/timeout|performance/i.test(topHypothesis.hypothesis)) {
      return {
        description: 'Add timeout handling and retry logic',
        pseudoCode: `
const result = await withTimeout(
  operation(),
  TIMEOUT_MS,
  'Operation timed out'
);
        `.trim(),
        riskLevel: 'medium',
        confidence: 65,
      };
    }

    return undefined;
  }

  /**
   * Recommend actions based on analysis
   */
  recommendActions(
    severityLevel: string,
    reproducibility: string,
    confidence: number,
    hasSecurityIndicators: boolean
  ): RecommendedAction[] {
    const actions: RecommendedAction[] = [];

    // Always assign high-severity issues
    if (severityLevel === 'P0' || severityLevel === 'P1') {
      actions.push('assign');
      actions.push('add_to_sprint');
    } else if (severityLevel === 'P2') {
      actions.push('assign');
    }

    // Request more info for low reproducibility
    if (reproducibility === 'not_reproducible' || confidence < 60) {
      actions.push('request_more_info');
    }

    // Security issues need escalation
    if (hasSecurityIndicators) {
      actions.push('escalate_to_security');
    }

    // Mark potential regressions
    if (severityLevel === 'P0' || severityLevel === 'P1') {
      actions.push('mark_regression');
    }

    return actions;
  }

  /**
   * Hypothesize from error code
   */
  private hypothesizeFromErrorCode(
    errorCode: string,
    fields: ExtractedBugFields
  ): RootCauseHypothesis | null {
    const upperCode = errorCode.toUpperCase();

    if (upperCode.includes('PDF_PROCESSING')) {
      return {
        hypothesis: 'PDF file is corrupted or in unsupported format',
        confidence: 75,
        evidence: [
          {
            type: 'error_code',
            description: `Error code ${errorCode} indicates PDF processing failure`,
          },
        ],
        testableChecks: [
          'Try opening PDF with standard PDF reader',
          'Check PDF version compatibility',
          'Verify file is not password protected',
        ],
      };
    }

    if (upperCode.includes('OCR') || upperCode.includes('TESSERACT')) {
      return {
        hypothesis: 'OCR engine failed to extract text from image',
        confidence: 80,
        evidence: [
          {
            type: 'error_code',
            description: `Error code ${errorCode} indicates OCR failure`,
          },
        ],
        testableChecks: [
          'Check if PDF is scanned vs digital',
          'Verify image resolution is sufficient',
          'Test with different OCR settings',
        ],
      };
    }

    if (upperCode.includes('VALIDATION')) {
      return {
        hypothesis: 'Extracted data does not meet Xero schema requirements',
        confidence: 85,
        evidence: [
          {
            type: 'error_code',
            description: `Validation error: ${errorCode}`,
          },
        ],
        testableChecks: [
          'Verify date format is DD/MM/YYYY',
          'Check required fields are present',
          'Ensure numeric values are valid',
        ],
      };
    }

    return null;
  }

  /**
   * Hypothesize from stack trace
   */
  private hypothesizeFromStackTrace(stackTrace: string): RootCauseHypothesis[] {
    const hypotheses: RootCauseHypothesis[] = [];

    // Extract top frames
    const framePattern = /at\s+([^\s(]+)\s+\(([^:]+):(\d+)/g;
    const frames: Evidence[] = [];
    let match;

    while ((match = framePattern.exec(stackTrace)) !== null) {
      frames.push({
        type: 'stack_frame',
        description: `${match[1]} at ${match[2]}:${match[3]}`,
        file: match[2],
        line: parseInt(match[3]),
        snippet: match[0],
      });
    }

    if (frames.length > 0) {
      const topFrame = frames[0];
      hypotheses.push({
        hypothesis: `Error originates from ${topFrame.file} at line ${topFrame.line}`,
        confidence: 85,
        evidence: frames.slice(0, 5),
        testableChecks: [
          `Review code at ${topFrame.file}:${topFrame.line}`,
          'Check input parameters at call site',
          'Verify error handling is in place',
        ],
      });
    }

    // Check for null pointer patterns
    if (/null|undefined/i.test(stackTrace)) {
      hypotheses.push({
        hypothesis: 'Null or undefined value accessed where object expected',
        confidence: 90,
        evidence: [
          {
            type: 'pattern_match',
            description: 'Stack trace indicates null/undefined access',
          },
        ],
        testableChecks: [
          'Add null checks before property access',
          'Verify data initialization',
          'Check for race conditions',
        ],
      });
    }

    return hypotheses;
  }

  /**
   * Hypothesize from component
   */
  private hypothesizeFromComponent(
    component: string,
    text: string
  ): RootCauseHypothesis | null {
    switch (component) {
      case 'PDF Processor':
        return {
          hypothesis: 'PDF file format or structure is incompatible',
          confidence: 70,
          evidence: [
            {
              type: 'pattern_match',
              description: 'Issue involves PDF processing module',
            },
          ],
          testableChecks: [
            'Test with different PDF versions',
            'Check for encrypted/protected PDFs',
            'Verify PDF is not corrupted',
          ],
        };

      case 'OCR Engine':
        return {
          hypothesis: 'Image quality or format affecting text recognition',
          confidence: 75,
          evidence: [
            {
              type: 'pattern_match',
              description: 'Issue involves OCR processing',
            },
          ],
          testableChecks: [
            'Increase DPI/resolution',
            'Pre-process image for better contrast',
            'Try alternative OCR settings',
          ],
        };

      case 'Validation Layer':
        return {
          hypothesis: 'Data format does not match expected schema',
          confidence: 80,
          evidence: [
            {
              type: 'pattern_match',
              description: 'Validation failure detected',
            },
          ],
          testableChecks: [
            'Review Xero template requirements',
            'Check date formats',
            'Verify field data types',
          ],
        };

      default:
        return null;
    }
  }

  /**
   * Hypothesize from text patterns
   */
  private hypothesizeFromTextPatterns(text: string): RootCauseHypothesis[] {
    const hypotheses: RootCauseHypothesis[] = [];

    if (/timeout|slow|long\s+time/i.test(text)) {
      hypotheses.push({
        hypothesis: 'Performance bottleneck causing timeout or slow response',
        confidence: 70,
        evidence: [
          {
            type: 'pattern_match',
            description: 'Performance-related keywords found in report',
          },
        ],
        testableChecks: [
          'Profile application performance',
          'Check for memory leaks',
          'Optimize heavy operations',
        ],
      });
    }

    if (/memory|heap|ram/i.test(text)) {
      hypotheses.push({
        hypothesis: 'Memory exhaustion from large PDF processing',
        confidence: 75,
        evidence: [
          {
            type: 'pattern_match',
            description: 'Memory-related issue indicated',
          },
        ],
        testableChecks: [
          'Monitor memory usage during processing',
          'Process PDFs in smaller batches',
          'Implement streaming processing',
        ],
      });
    }

    return hypotheses;
  }

  /**
   * Infer module from file path
   */
  private inferModule(filePath: string): string {
    const parts = filePath.split(/[\/\\]/);

    for (const part of parts) {
      if (Object.keys(this.codeOwnership).some((key) => part.includes(key))) {
        return part;
      }
    }

    return parts[parts.length - 2] || 'unknown';
  }

  /**
   * Get locations for a component
   */
  private getComponentLocations(component: string): CodeLocation[] {
    const locationMap: Record<string, CodeLocation[]> = {
      'PDF Processor': [
        {
          file: 'src/modules/pdf-processor/index.ts',
          module: 'pdf-processor',
          confidence: 80,
        },
      ],
      'OCR Engine': [
        {
          file: 'src/modules/ocr/index.ts',
          module: 'ocr',
          confidence: 80,
        },
      ],
      'Validation Layer': [
        {
          file: 'src/modules/validation/index.ts',
          module: 'validation',
          confidence: 80,
        },
      ],
      'Export Module': [
        {
          file: 'src/modules/export/index.ts',
          module: 'export',
          confidence: 80,
        },
      ],
    };

    return locationMap[component] || [];
  }

  /**
   * Get owner for component
   */
  private getComponentOwner(component: string): string | null {
    const ownerMap: Record<string, string> = {
      'PDF Processor': 'core-team',
      'OCR Engine': 'core-team',
      'Validation Layer': 'data-quality-team',
      'Export Module': 'integration-team',
      'User Interface': 'frontend-team',
      'AI Assistant': 'ai-team',
    };

    return ownerMap[component] || null;
  }

  /**
   * Remove duplicate locations
   */
  private deduplicateLocations(locations: CodeLocation[]): CodeLocation[] {
    const seen = new Set<string>();
    const unique: CodeLocation[] = [];

    for (const loc of locations) {
      const key = `${loc.file}:${loc.function || 'unknown'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(loc);
      }
    }

    return unique;
  }
}

export default RootCauseAnalyzer;
