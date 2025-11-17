import { BugReviewResult } from '../bug-review-agent/types';
import { FeatureProposal } from '../new-features-agent/types';
import { PlanGenerator } from './plan-generator';
import { FixExecutor } from './fix-executor';
import {
  FixPlan,
  FixResult,
  FixQueue,
  AutoFixerConfig,
  AutoFixerStats,
  AgentRecommendation,
  BugFixInput,
  FeatureFixInput,
} from './types';
import { log } from '../../shared/utils/logger';

/**
 * Auto-Fixer Agent - Automatically implements bug fixes and feature recommendations
 * Takes outputs from Bug Review Agent and New Features Agent to generate and apply fixes
 */
export class AutoFixerAgent {
  private planGenerator: PlanGenerator;
  private executor: FixExecutor;
  private queue: FixQueue;
  private config: AutoFixerConfig;

  constructor(config?: Partial<AutoFixerConfig>) {
    this.config = {
      maxRiskLevel: config?.maxRiskLevel || 'medium',
      requireValidation: config?.requireValidation ?? true,
      autoCommit: config?.autoCommit ?? false,
      dryRun: config?.dryRun ?? true, // Default to dry run for safety
      backupEnabled: config?.backupEnabled ?? true,
    };

    this.planGenerator = new PlanGenerator();
    this.executor = new FixExecutor(this.config);
    this.queue = {
      pending: [],
      inProgress: null,
      completed: [],
      failed: [],
    };

    log.info('Auto-Fixer Agent initialized', { config: this.config });
  }

  /**
   * Process recommendations from both agents
   */
  async processRecommendations(recommendations: AgentRecommendation[]): Promise<FixPlan[]> {
    log.info('Processing recommendations', { count: recommendations.length });

    const plans: FixPlan[] = [];

    // Sort by priority
    const sorted = [...recommendations].sort((a, b) => b.priority - a.priority);

    for (const rec of sorted) {
      const plan = this.createPlanFromRecommendation(rec);
      if (plan) {
        plans.push(plan);
        this.queue.pending.push(plan);
      }
    }

    log.info('Plans generated from recommendations', { count: plans.length });
    return plans;
  }

  /**
   * Create a fix plan from a bug review
   */
  createBugFixPlan(bugReview: BugReviewResult, additionalContext?: string): FixPlan {
    const input: BugFixInput = { bugReview, additionalContext };
    const plan = this.planGenerator.generateBugFixPlan(input);
    this.queue.pending.push(plan);
    return plan;
  }

  /**
   * Create a fix plan from a feature proposal
   */
  createFeaturePlan(
    proposal: FeatureProposal,
    scope?: 'minimal' | 'standard' | 'complete'
  ): FixPlan {
    const input: FeatureFixInput = { proposal, scope };
    const plan = this.planGenerator.generateFeaturePlan(input);
    this.queue.pending.push(plan);
    return plan;
  }

  /**
   * Execute the next plan in queue
   */
  async executeNextPlan(): Promise<FixResult | null> {
    if (this.queue.pending.length === 0) {
      log.info('No pending plans to execute');
      return null;
    }

    if (this.queue.inProgress) {
      log.warn('A plan is already in progress');
      return null;
    }

    const plan = this.queue.pending.shift()!;
    this.queue.inProgress = plan;

    log.info('Executing next plan', { planId: plan.id, title: plan.title });

    const result = await this.executor.executePlan(plan);

    this.queue.inProgress = null;

    if (result.status === 'completed') {
      this.queue.completed.push(result);
    } else {
      this.queue.failed.push(result);
    }

    return result;
  }

  /**
   * Execute all pending plans
   */
  async executeAllPlans(): Promise<FixResult[]> {
    const results: FixResult[] = [];

    while (this.queue.pending.length > 0) {
      const result = await this.executeNextPlan();
      if (result) {
        results.push(result);

        // Stop on critical failures
        if (result.status === 'failed' && result.errors.length > 0) {
          log.warn('Stopping execution due to failure', {
            planId: result.planId,
            errors: result.errors,
          });
          break;
        }
      }
    }

    return results;
  }

  /**
   * Get queue status
   */
  getQueueStatus(): FixQueue {
    return {
      pending: [...this.queue.pending],
      inProgress: this.queue.inProgress,
      completed: [...this.queue.completed],
      failed: [...this.queue.failed],
    };
  }

  /**
   * Clear the queue
   */
  clearQueue(): void {
    this.queue = {
      pending: [],
      inProgress: null,
      completed: [],
      failed: [],
    };
    log.info('Queue cleared');
  }

  /**
   * Get statistics on agent performance
   */
  getStats(): AutoFixerStats {
    const totalPlansGenerated = this.queue.completed.length + this.queue.failed.length;
    const totalFixesApplied = this.queue.completed.reduce(
      (sum, r) => sum + r.appliedChanges.length,
      0
    );
    const successRate =
      totalPlansGenerated > 0 ? (this.queue.completed.length / totalPlansGenerated) * 100 : 0;
    const averageExecutionTime =
      totalPlansGenerated > 0
        ? this.queue.completed.reduce((sum, r) => sum + r.executionTime, 0) /
          this.queue.completed.length
        : 0;
    const rollbackCount = this.queue.failed.filter((r) => r.status === 'rolled_back').length;

    // Calculate risk distribution
    const riskDistribution: Record<string, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    // Count from completed results - we'd need to track plans separately
    // For now, return empty distribution
    return {
      totalPlansGenerated,
      totalFixesApplied,
      successRate,
      averageExecutionTime,
      rollbackCount,
      riskDistribution: riskDistribution as AutoFixerStats['riskDistribution'],
    };
  }

  /**
   * Update agent configuration
   */
  updateConfig(newConfig: Partial<AutoFixerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.executor.updateConfig(newConfig);
    log.info('Auto-Fixer Agent configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  getConfig(): AutoFixerConfig {
    return { ...this.config };
  }

  /**
   * Format queue status as readable text
   */
  formatQueueStatus(): string {
    const queue = this.getQueueStatus();
    let output = '═══════════════════════════════════════════════════════════════\n';
    output += '                    AUTO-FIXER AGENT STATUS                      \n';
    output += '═══════════════════════════════════════════════════════════════\n\n';

    output += '📋 QUEUE STATUS\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `Pending: ${queue.pending.length} plan(s)\n`;
    output += `In Progress: ${queue.inProgress ? queue.inProgress.title : 'None'}\n`;
    output += `Completed: ${queue.completed.length} plan(s)\n`;
    output += `Failed: ${queue.failed.length} plan(s)\n\n`;

    if (queue.pending.length > 0) {
      output += '⏳ PENDING PLANS\n';
      output += '───────────────────────────────────────────────────────────────\n';
      for (const plan of queue.pending.slice(0, 5)) {
        output += `• ${plan.title} (${plan.riskLevel} risk, priority: ${plan.priority})\n`;
      }
      if (queue.pending.length > 5) {
        output += `  ... and ${queue.pending.length - 5} more\n`;
      }
      output += '\n';
    }

    if (queue.completed.length > 0) {
      output += '✅ RECENTLY COMPLETED\n';
      output += '───────────────────────────────────────────────────────────────\n';
      for (const result of queue.completed.slice(-3)) {
        output += `• Plan ${result.planId.substring(0, 20)}...\n`;
        output += `  Applied ${result.appliedChanges.length} change(s) in ${result.executionTime}ms\n`;
        if (result.warnings.length > 0) {
          output += `  Warnings: ${result.warnings.join('; ')}\n`;
        }
      }
      output += '\n';
    }

    if (queue.failed.length > 0) {
      output += '❌ FAILED PLANS\n';
      output += '───────────────────────────────────────────────────────────────\n';
      for (const result of queue.failed.slice(-3)) {
        output += `• Plan ${result.planId.substring(0, 20)}...\n`;
        output += `  Status: ${result.status}\n`;
        output += `  Errors: ${result.errors.join('; ')}\n`;
      }
      output += '\n';
    }

    const stats = this.getStats();
    output += '📊 STATISTICS\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `Total Plans Generated: ${stats.totalPlansGenerated}\n`;
    output += `Total Fixes Applied: ${stats.totalFixesApplied}\n`;
    output += `Success Rate: ${stats.successRate.toFixed(1)}%\n`;
    output += `Average Execution Time: ${stats.averageExecutionTime.toFixed(0)}ms\n`;
    output += `Rollback Count: ${stats.rollbackCount}\n\n`;

    output += '⚙️  CONFIGURATION\n';
    output += '───────────────────────────────────────────────────────────────\n';
    output += `Max Risk Level: ${this.config.maxRiskLevel}\n`;
    output += `Require Validation: ${this.config.requireValidation}\n`;
    output += `Auto Commit: ${this.config.autoCommit}\n`;
    output += `Dry Run Mode: ${this.config.dryRun}\n`;
    output += `Backup Enabled: ${this.config.backupEnabled}\n`;

    output += '═══════════════════════════════════════════════════════════════\n';

    return output;
  }

  /**
   * Format fix result as readable text
   */
  formatFixResult(result: FixResult): string {
    let output = '═══════════════════════════════════════════════════════════════\n';
    output += '                       FIX EXECUTION RESULT                      \n';
    output += `                       Plan: ${result.planId.substring(0, 20)}...               \n`;
    output += '═══════════════════════════════════════════════════════════════\n\n';

    const statusEmoji: Record<string, string> = {
      pending: '⏳',
      in_progress: '🔄',
      completed: '✅',
      failed: '❌',
      rolled_back: '↩️',
    };

    output += `Status: ${statusEmoji[result.status] || '❓'} ${result.status.toUpperCase()}\n`;
    output += `Execution Time: ${result.executionTime}ms\n`;
    output += `Rollback Available: ${result.rollbackAvailable ? 'Yes' : 'No'}\n\n`;

    if (result.appliedChanges.length > 0) {
      output += '📝 APPLIED CHANGES\n';
      output += '───────────────────────────────────────────────────────────────\n';
      for (const change of result.appliedChanges) {
        output += `• ${change.changeType.toUpperCase()}: ${change.filePath}\n`;
        output += `  ${change.description}\n`;
      }
      output += '\n';
    }

    if (result.validationResults.length > 0) {
      output += '🔍 VALIDATION RESULTS\n';
      output += '───────────────────────────────────────────────────────────────\n';
      for (const validation of result.validationResults) {
        const icon = validation.passed ? '✓' : '✗';
        output += `${icon} ${validation.check}\n`;
        output += `  ${validation.message}\n`;
      }
      output += '\n';
    }

    if (result.errors.length > 0) {
      output += '❌ ERRORS\n';
      output += '───────────────────────────────────────────────────────────────\n';
      for (const error of result.errors) {
        output += `• ${error}\n`;
      }
      output += '\n';
    }

    if (result.warnings.length > 0) {
      output += '⚠️  WARNINGS\n';
      output += '───────────────────────────────────────────────────────────────\n';
      for (const warning of result.warnings) {
        output += `• ${warning}\n`;
      }
      output += '\n';
    }

    output += '═══════════════════════════════════════════════════════════════\n';

    return output;
  }

  /**
   * Create plan from generic recommendation
   */
  private createPlanFromRecommendation(rec: AgentRecommendation): FixPlan | null {
    const planId = `plan_rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Map recommendation to fix type
    const type =
      rec.source === 'bug_review' ? ('bug_fix' as const) : ('feature_implementation' as const);

    // Estimate risk based on priority
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium';
    if (rec.priority >= 90) riskLevel = 'high';
    else if (rec.priority >= 70) riskLevel = 'medium';
    else riskLevel = 'low';

    const plan: FixPlan = {
      id: planId,
      type,
      title: rec.recommendation,
      description: `Source: ${rec.source}\nAction Items:\n${rec.actionItems.map((a) => `- ${a}`).join('\n')}`,
      priority: rec.priority,
      riskLevel,
      estimatedEffort: rec.priority >= 80 ? 'High' : rec.priority >= 50 ? 'Medium' : 'Low',
      codeChanges: rec.codeContext
        ? rec.codeContext.files.map((file) => ({
            filePath: file,
            originalContent: '',
            newContent: `// Implementation for: ${rec.recommendation}`,
            changeType: 'modify' as const,
            description: rec.recommendation,
          }))
        : [],
      validationSteps: ['Run TypeScript compilation', 'Execute unit tests', 'Verify fix'],
      rollbackPlan: 'Revert all modified files to original state',
      dependencies: rec.codeContext?.dependencies || [],
      createdAt: new Date(),
    };

    return plan;
  }
}

export default AutoFixerAgent;
export * from './types';
export { PlanGenerator } from './plan-generator';
export { FixExecutor } from './fix-executor';
