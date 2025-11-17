import { BugReportParser } from './report-parser';
import { SeverityClassifier } from './severity-classifier';
import { RootCauseAnalyzer } from './root-cause-analyzer';
import {
  BugReport,
  BugReviewResult,
  HumanOverride,
  BugReviewStats,
  TriageAction,
} from './types';
import { log } from '../../shared/utils/logger';

/**
 * Bug Review Agent - Automated bug triage and analysis system
 * Accelerates bug triage by standardizing reports, inferring severity,
 * suggesting root causes, and recommending actions
 */
export class BugReviewAgent {
  private parser: BugReportParser;
  private severityClassifier: SeverityClassifier;
  private rootCauseAnalyzer: RootCauseAnalyzer;
  private reviewHistory: BugReviewResult[] = [];
  private overrides: HumanOverride[] = [];

  constructor() {
    this.parser = new BugReportParser();
    this.severityClassifier = new SeverityClassifier();
    this.rootCauseAnalyzer = new RootCauseAnalyzer();
  }

  /**
   * Perform a complete bug review
   */
  async reviewBug(report: BugReport): Promise<BugReviewResult> {
    log.info('Bug Review Agent starting analysis', { reportId: report.id });
    const startTime = Date.now();

    // Parse and extract fields
    const extractedFields = this.parser.parseReport(report);
    log.debug('Fields extracted', {
      component: extractedFields.component,
      errorCodes: extractedFields.errorCodes,
    });

    // Generate summary
    const summary = this.parser.generateSummary(report, extractedFields);

    // Classify severity
    const severitySuggestion = this.severityClassifier.classifySeverity(
      report,
      extractedFields
    );

    // Estimate reproducibility
    const reproducibility = this.severityClassifier.estimateReproducibility(
      report,
      extractedFields
    );

    // Generate root cause hypotheses
    const rootCauseHypotheses = this.rootCauseAnalyzer.generateHypotheses(
      report,
      extractedFields
    );

    // Identify code locations
    const codeLocations = this.rootCauseAnalyzer.identifyCodeLocations(
      extractedFields,
      rootCauseHypotheses
    );

    // Suggest owner
    const suggestedOwner = this.rootCauseAnalyzer.suggestOwner(
      extractedFields,
      codeLocations
    );

    // Suggest priority
    const suggestedPriority = this.severityClassifier.suggestPriority(
      severitySuggestion,
      reproducibility,
      extractedFields
    );

    // Suggest tests
    const suggestedTests = this.rootCauseAnalyzer.suggestTests(
      extractedFields,
      rootCauseHypotheses
    );

    // Suggest labels
    const suggestedLabels = this.generateLabels(
      extractedFields,
      severitySuggestion,
      reproducibility
    );

    // Suggest patch (only for high-confidence cases)
    const patchSuggestion = this.rootCauseAnalyzer.suggestPatch(
      extractedFields,
      rootCauseHypotheses
    );

    // Recommend actions
    const hasSecurityIndicators = /security|vulnerability/i.test(report.body);
    const recommendedActions = this.rootCauseAnalyzer.recommendActions(
      severitySuggestion.level,
      reproducibility.level,
      severitySuggestion.confidence,
      hasSecurityIndicators
    );

    // Create review result
    const result: BugReviewResult = {
      reviewId: this.generateReviewId(),
      originalReportId: report.id,
      summary,
      extractedFields,
      severitySuggestion,
      reproducibility,
      rootCauseHypotheses,
      suggestedLabels,
      suggestedOwner,
      suggestedPriority,
      suggestedTests,
      codeLocations,
      patchSuggestion,
      recommendedActions,
      provenance: {
        modelVersions: {
          parser: '1.0.0',
          classifier: '1.0.0',
          analyzer: '1.0.0',
        },
        analysisTimestamp: new Date(),
        confidence:
          (severitySuggestion.confidence +
            reproducibility.confidence +
            suggestedOwner.confidence) /
          3,
        evidenceSources: ['report_text', 'attachments', 'metadata', 'patterns'],
      },
      createdAt: new Date(),
    };

    // Store in history
    this.reviewHistory.push(result);

    const duration = Date.now() - startTime;
    log.info('Bug review completed', {
      reviewId: result.reviewId,
      durationMs: duration,
      severity: severitySuggestion.level,
      confidence: result.provenance.confidence,
    });

    return result;
  }

  /**
   * Apply human override to a review
   */
  applyOverride(override: HumanOverride): void {
    this.overrides.push(override);
    log.info('Human override applied', {
      reviewId: override.reviewId,
      field: override.field,
      reason: override.reason,
    });
  }

  /**
   * Get clarifying questions for a report
   */
  getClarifyingQuestions(report: BugReport): string[] {
    const fields = this.parser.parseReport(report);
    const reproducibility = this.severityClassifier.estimateReproducibility(
      report,
      fields
    );

    const questions = this.severityClassifier.generateClarifyingQuestions(
      fields,
      reproducibility
    );

    return questions.map((q) => q.question);
  }

  /**
   * Generate suggested triage actions
   */
  generateTriageActions(result: BugReviewResult): TriageAction[] {
    const actions: TriageAction[] = [];

    for (const action of result.recommendedActions) {
      const triageAction: TriageAction = {
        action,
        autoApply: result.provenance.confidence > 80,
      };

      switch (action) {
        case 'assign':
          triageAction.target = result.suggestedOwner.team;
          triageAction.comment = `Assigning to ${result.suggestedOwner.team} based on code analysis. ${result.suggestedOwner.reasoning}`;
          triageAction.autoApply = result.suggestedOwner.confidence > 85;
          break;

        case 'request_more_info':
          const questions = this.severityClassifier.generateClarifyingQuestions(
            result.extractedFields,
            result.reproducibility
          );
          triageAction.comment =
            questions.length > 0
              ? `Please provide: ${questions.map((q) => q.question).join(' ')}`
              : 'Additional information needed for investigation.';
          triageAction.autoApply = false; // Always require human approval for requests
          break;

        case 'escalate_to_security':
          triageAction.target = 'security-team';
          triageAction.comment =
            'Potential security issue detected. Escalating for security review.';
          triageAction.autoApply = false; // Security escalations need human approval
          break;

        case 'mark_regression':
          triageAction.comment =
            'Marking as potential regression based on severity and symptoms.';
          break;

        case 'add_to_sprint':
          triageAction.comment = `Adding to current sprint. Priority: ${result.suggestedPriority.backlogBucket}`;
          break;
      }

      actions.push(triageAction);
    }

    return actions;
  }

  /**
   * Get statistics on agent performance
   */
  getStats(): BugReviewStats {
    if (this.reviewHistory.length === 0) {
      return {
        totalReviewed: 0,
        averageTimeToTriage: 0,
        acceptanceRate: 0,
        overrideRate: 0,
        severityAccuracy: 0,
        ownerAccuracy: 0,
      };
    }

    const totalReviewed = this.reviewHistory.length;
    const overrideRate =
      (this.overrides.length / (totalReviewed * 5)) * 100; // Approximate fields per review

    // Calculate average confidence as proxy for accuracy
    const avgSeverityConfidence =
      this.reviewHistory.reduce((sum, r) => sum + r.severitySuggestion.confidence, 0) /
      totalReviewed;

    const avgOwnerConfidence =
      this.reviewHistory.reduce((sum, r) => sum + r.suggestedOwner.confidence, 0) /
      totalReviewed;

    return {
      totalReviewed,
      averageTimeToTriage: 0, // Would need timing data
      acceptanceRate: 100 - overrideRate,
      overrideRate,
      severityAccuracy: avgSeverityConfidence,
      ownerAccuracy: avgOwnerConfidence,
    };
  }

  /**
   * Generate labels for the bug
   */
  private generateLabels(
    fields: ReturnType<BugReportParser['parseReport']>,
    severity: ReturnType<SeverityClassifier['classifySeverity']>,
    reproducibility: ReturnType<SeverityClassifier['estimateReproducibility']>
  ): string[] {
    const labels: string[] = [];

    // Severity label
    labels.push(`severity:${severity.level.toLowerCase()}`);

    // Component label
    if (fields.component) {
      labels.push(`component:${fields.component.toLowerCase().replace(/\s+/g, '-')}`);
    }

    // Reproducibility label
    if (reproducibility.level === 'not_reproducible') {
      labels.push('needs-info');
    } else if (reproducibility.level === 'likely') {
      labels.push('reproducible');
    }

    // Additional labels based on content
    if (fields.errorCodes.length > 0) {
      labels.push('has-error-code');
    }

    if (severity.level === 'P0' || severity.level === 'P1') {
      labels.push('high-priority');
    }

    return labels;
  }

  /**
   * Format review result as readable text
   */
  formatReviewAsText(result: BugReviewResult): string {
    let output = '═══════════════════════════════════════════════════════════════\n';
    output += '                     BUG REVIEW AGENT REPORT                    \n';
    output += `                     Review ID: ${result.reviewId}              \n`;
    output += '═══════════════════════════════════════════════════════════════\n\n';

    output += '📋 SUMMARY\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `Title: ${result.summary.title}\n`;
    output += `Description: ${result.summary.description}\n`;
    output += `Expected: ${result.summary.expectedBehavior}\n`;
    output += `Actual: ${result.summary.actualBehavior}\n\n`;

    output += '⚠️  SEVERITY & PRIORITY\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `Severity: ${result.severitySuggestion.level} (${result.severitySuggestion.confidence}% confidence)\n`;
    output += `Reasoning: ${result.severitySuggestion.reasoning}\n`;
    output += `Priority Bucket: ${result.suggestedPriority.backlogBucket}\n`;
    output += `Estimated Effort: ${result.suggestedPriority.estimatedEffort}\n\n`;

    output += '🔍 ROOT CAUSE HYPOTHESES\n';
    output += '───────────────────────────────────────────────────────────────\n';
    for (let i = 0; i < result.rootCauseHypotheses.length; i++) {
      const hyp = result.rootCauseHypotheses[i];
      output += `${i + 1}. ${hyp.hypothesis} (${hyp.confidence}% confidence)\n`;
      output += `   Checks: ${hyp.testableChecks.slice(0, 2).join(', ')}\n\n`;
    }

    output += '👥 SUGGESTED OWNER\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `Team: ${result.suggestedOwner.team} (${result.suggestedOwner.confidence}% confidence)\n`;
    output += `Reasoning: ${result.suggestedOwner.reasoning}\n`;
    if (result.suggestedOwner.alternativeOwners?.length) {
      output += `Alternatives: ${result.suggestedOwner.alternativeOwners.join(', ')}\n`;
    }
    output += '\n';

    output += '🏷️  SUGGESTED LABELS\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += result.suggestedLabels.join(', ') + '\n\n';

    output += '➡️  RECOMMENDED ACTIONS\n';
    output += '───────────────────────────────────────────────────────────────\n';
    for (const action of result.recommendedActions) {
      output += `• ${action.replace(/_/g, ' ').toUpperCase()}\n`;
    }
    output += '\n';

    if (result.patchSuggestion) {
      output += '🔧 PATCH SUGGESTION\n';
      output += '───────────────────────────────────────────────────────────────\n';
      output += `${result.patchSuggestion.description}\n`;
      output += `Risk: ${result.patchSuggestion.riskLevel}\n`;
      output += `Confidence: ${result.patchSuggestion.confidence}%\n\n`;
    }

    output += `📊 Overall Confidence: ${Math.round(result.provenance.confidence)}%\n`;
    output += '═══════════════════════════════════════════════════════════════\n';

    return output;
  }

  /**
   * Generate unique review ID
   */
  private generateReviewId(): string {
    return `r_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get review history
   */
  getReviewHistory(): BugReviewResult[] {
    return [...this.reviewHistory];
  }

  /**
   * Clear review history
   */
  clearHistory(): void {
    this.reviewHistory = [];
    this.overrides = [];
    log.info('Bug Review Agent history cleared');
  }
}

export default BugReviewAgent;
export * from './types';
export { BugReportParser } from './report-parser';
export { SeverityClassifier } from './severity-classifier';
export { RootCauseAnalyzer } from './root-cause-analyzer';
