import { BugReviewResult } from '../bug-review-agent/types';
import { FeatureProposal } from '../new-features-agent/types';
import {
  FixPlan,
  CodeChange,
  RiskLevel,
  BugFixInput,
  FeatureFixInput,
} from './types';
import { log } from '../../shared/utils/logger';

/**
 * Generates fix plans from bug reviews and feature proposals
 */
export class PlanGenerator {
  /**
   * Generate a fix plan from a bug review result
   */
  generateBugFixPlan(input: BugFixInput): FixPlan {
    const { bugReview, additionalContext } = input;
    log.debug('Generating bug fix plan', { reviewId: bugReview.reviewId });

    const codeChanges = this.generateBugFixChanges(bugReview);
    const riskLevel = this.assessBugFixRisk(bugReview);
    const validationSteps = this.generateBugValidationSteps(bugReview);

    const plan: FixPlan = {
      id: this.generatePlanId('bug'),
      type: 'bug_fix',
      title: `Fix: ${bugReview.summary.title}`,
      description: this.generateBugFixDescription(bugReview, additionalContext),
      priority: this.mapSeverityToPriority(bugReview.severitySuggestion.level),
      riskLevel,
      estimatedEffort: bugReview.suggestedPriority.estimatedEffort,
      codeChanges,
      validationSteps,
      rollbackPlan: this.generateRollbackPlan(codeChanges),
      dependencies: this.extractDependencies(bugReview),
      createdAt: new Date(),
    };

    log.info('Bug fix plan generated', {
      planId: plan.id,
      title: plan.title,
      riskLevel: plan.riskLevel,
      changesCount: codeChanges.length,
    });

    return plan;
  }

  /**
   * Generate a fix plan from a feature proposal
   */
  generateFeaturePlan(input: FeatureFixInput): FixPlan {
    const { proposal, scope = 'standard' } = input;
    log.debug('Generating feature plan', { proposalId: proposal.id, scope });

    const codeChanges = this.generateFeatureChanges(proposal, scope);
    const riskLevel = this.assessFeatureRisk(proposal, scope);
    const validationSteps = this.generateFeatureValidationSteps(proposal);

    const plan: FixPlan = {
      id: this.generatePlanId('feature'),
      type: 'feature_implementation',
      title: `Feature: ${proposal.title}`,
      description: proposal.description,
      priority: proposal.priorityScore,
      riskLevel,
      estimatedEffort: proposal.estimatedEffort,
      codeChanges,
      validationSteps,
      rollbackPlan: this.generateRollbackPlan(codeChanges),
      dependencies: proposal.requiredDependencies,
      createdAt: new Date(),
    };

    log.info('Feature plan generated', {
      planId: plan.id,
      title: plan.title,
      scope,
      changesCount: codeChanges.length,
    });

    return plan;
  }

  /**
   * Generate code changes for bug fix
   */
  private generateBugFixChanges(bugReview: BugReviewResult): CodeChange[] {
    const changes: CodeChange[] = [];

    // If patch suggestion exists with high confidence, use it
    if (bugReview.patchSuggestion && bugReview.patchSuggestion.confidence > 70) {
      for (const file of bugReview.patchSuggestion.affectedFiles) {
        changes.push({
          filePath: file,
          originalContent: '// Original content would be read from file system',
          newContent: `// Suggested patch for ${bugReview.summary.title}\n${bugReview.patchSuggestion.suggestedFix}`,
          changeType: 'modify',
          description: bugReview.patchSuggestion.description,
        });
      }
    }

    // Generate changes based on root cause hypotheses
    for (const hypothesis of bugReview.rootCauseHypotheses.slice(0, 1)) {
      // Take highest confidence
      if (hypothesis.confidence > 60) {
        for (const location of bugReview.codeLocations) {
          changes.push({
            filePath: location.path,
            originalContent: '// Would read actual file content',
            newContent: `// Fix for hypothesis: ${hypothesis.hypothesis}\n// Location: ${location.path}:${location.line || 'unknown'}`,
            changeType: 'modify',
            description: `Address ${hypothesis.hypothesis}`,
          });
        }
      }
    }

    // Add test changes
    if (bugReview.suggestedTests.length > 0) {
      const testFile = bugReview.codeLocations[0]?.path.replace('.ts', '.test.ts') || 'test.ts';
      const testContent = bugReview.suggestedTests
        .map(
          (test) => `
describe('${bugReview.summary.title}', () => {
  it('${test}', () => {
    // Test implementation
    expect(true).toBe(true);
  });
});`
        )
        .join('\n');

      changes.push({
        filePath: testFile,
        originalContent: '',
        newContent: testContent,
        changeType: 'create',
        description: 'Add regression tests for the bug fix',
      });
    }

    return changes;
  }

  /**
   * Generate code changes for feature implementation
   */
  private generateFeatureChanges(proposal: FeatureProposal, scope: string): CodeChange[] {
    const changes: CodeChange[] = [];

    // Create main feature file
    const featurePath = `src/modules/${proposal.title.toLowerCase().replace(/\s+/g, '-')}/index.ts`;

    const featureCode = this.generateFeatureBoilerplate(proposal);
    changes.push({
      filePath: featurePath,
      originalContent: '',
      newContent: featureCode,
      changeType: 'create',
      description: `Main implementation for ${proposal.title}`,
    });

    // Create types file
    const typesPath = featurePath.replace('index.ts', 'types.ts');
    const typesCode = this.generateFeatureTypes(proposal);
    changes.push({
      filePath: typesPath,
      originalContent: '',
      newContent: typesCode,
      changeType: 'create',
      description: `Type definitions for ${proposal.title}`,
    });

    // Add tests if scope is standard or complete
    if (scope !== 'minimal') {
      const testPath = featurePath.replace('index.ts', 'index.test.ts');
      const testCode = this.generateFeatureTests(proposal);
      changes.push({
        filePath: testPath,
        originalContent: '',
        newContent: testCode,
        changeType: 'create',
        description: `Tests for ${proposal.title}`,
      });
    }

    // Add documentation if complete scope
    if (scope === 'complete') {
      const docPath = featurePath.replace('index.ts', 'README.md');
      const docContent = this.generateFeatureDoc(proposal);
      changes.push({
        filePath: docPath,
        originalContent: '',
        newContent: docContent,
        changeType: 'create',
        description: `Documentation for ${proposal.title}`,
      });
    }

    return changes;
  }

  /**
   * Assess risk level for bug fix
   */
  private assessBugFixRisk(bugReview: BugReviewResult): RiskLevel {
    const severity = bugReview.severitySuggestion.level;
    const confidence = bugReview.provenance.confidence;

    // High severity bugs with low confidence = high risk
    if (severity === 'P0' || severity === 'P1') {
      if (confidence < 70) return 'critical';
      if (confidence < 85) return 'high';
      return 'medium';
    }

    if (severity === 'P2') {
      if (confidence < 70) return 'high';
      return 'medium';
    }

    return confidence < 70 ? 'medium' : 'low';
  }

  /**
   * Assess risk level for feature
   */
  private assessFeatureRisk(proposal: FeatureProposal, scope: string): RiskLevel {
    const hasHighImpact = proposal.riceScore.impact >= 8;
    const hasLowConfidence = proposal.riceScore.confidence < 70;

    if (scope === 'complete' && hasHighImpact && hasLowConfidence) {
      return 'high';
    }

    if (scope === 'complete' || (hasHighImpact && hasLowConfidence)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Generate validation steps for bug fix
   */
  private generateBugValidationSteps(bugReview: BugReviewResult): string[] {
    const steps: string[] = [
      'Run TypeScript compilation to check for type errors',
      'Execute unit tests to ensure no regressions',
    ];

    // Add specific validation from root cause
    for (const test of bugReview.suggestedTests.slice(0, 3)) {
      steps.push(`Verify: ${test}`);
    }

    // Add severity-specific validation
    if (bugReview.severitySuggestion.level === 'P0' || bugReview.severitySuggestion.level === 'P1') {
      steps.push('Perform integration testing');
      steps.push('Manual verification of fix');
    }

    steps.push('Check for memory leaks or performance issues');
    steps.push('Verify no new security vulnerabilities introduced');

    return steps;
  }

  /**
   * Generate validation steps for feature
   */
  private generateFeatureValidationSteps(proposal: FeatureProposal): string[] {
    const steps: string[] = [
      'Run TypeScript compilation',
      'Execute all unit tests',
      'Verify feature meets acceptance criteria',
    ];

    // Add user story validation
    for (const story of proposal.userStories.slice(0, 2)) {
      steps.push(`Validate user story: ${story.role} can ${story.action}`);
    }

    // Add metrics validation
    for (const metric of proposal.successMetrics.slice(0, 2)) {
      steps.push(`Measure: ${metric.metric}`);
    }

    steps.push('Check bundle size impact');
    steps.push('Verify no breaking changes');

    return steps;
  }

  /**
   * Generate rollback plan
   */
  private generateRollbackPlan(changes: CodeChange[]): string {
    const modifiedFiles = changes.filter((c) => c.changeType === 'modify').length;
    const createdFiles = changes.filter((c) => c.changeType === 'create').length;
    const deletedFiles = changes.filter((c) => c.changeType === 'delete').length;

    return `Rollback Plan:
1. Revert ${modifiedFiles} modified file(s) to original content
2. Delete ${createdFiles} newly created file(s)
3. Restore ${deletedFiles} deleted file(s)
4. Run tests to verify rollback
5. Clear any cached data related to changes`;
  }

  /**
   * Extract dependencies from bug review
   */
  private extractDependencies(bugReview: BugReviewResult): string[] {
    const deps: string[] = [];

    // Extract from code locations
    for (const location of bugReview.codeLocations) {
      if (location.path.includes('node_modules')) {
        const match = location.path.match(/node_modules\/([^/]+)/);
        if (match) deps.push(match[1]);
      }
    }

    return [...new Set(deps)];
  }

  /**
   * Map severity to priority number
   */
  private mapSeverityToPriority(severity: string): number {
    const map: Record<string, number> = {
      P0: 100,
      P1: 90,
      P2: 70,
      P3: 50,
      P4: 30,
    };
    return map[severity] || 50;
  }

  /**
   * Generate description for bug fix
   */
  private generateBugFixDescription(bugReview: BugReviewResult, context?: string): string {
    let desc = `${bugReview.summary.description}\n\n`;
    desc += `Expected: ${bugReview.summary.expectedBehavior}\n`;
    desc += `Actual: ${bugReview.summary.actualBehavior}\n`;

    if (context) {
      desc += `\nAdditional Context: ${context}`;
    }

    return desc;
  }

  /**
   * Generate feature boilerplate code
   */
  private generateFeatureBoilerplate(proposal: FeatureProposal): string {
    const className = proposal.title.replace(/\s+/g, '');
    return `import { log } from '../../shared/utils/logger';

/**
 * ${proposal.title}
 * ${proposal.description}
 *
 * Priority Score: ${proposal.priorityScore}
 * Estimated Effort: ${proposal.estimatedEffort}
 */
export class ${className} {
  constructor() {
    log.info('${className} initialized');
  }

  /**
   * Main entry point for the feature
   */
  async execute(): Promise<void> {
    log.info('${className} executing');
    // TODO: Implement feature logic
  }
}

export default ${className};
`;
  }

  /**
   * Generate feature types
   */
  private generateFeatureTypes(proposal: FeatureProposal): string {
    return `/**
 * Types for ${proposal.title}
 */

export interface ${proposal.title.replace(/\s+/g, '')}Config {
  enabled: boolean;
  // TODO: Add configuration options
}

export interface ${proposal.title.replace(/\s+/g, '')}Result {
  success: boolean;
  data?: unknown;
  error?: string;
}
`;
  }

  /**
   * Generate feature tests
   */
  private generateFeatureTests(proposal: FeatureProposal): string {
    const className = proposal.title.replace(/\s+/g, '');
    return `import { ${className} } from './index';

describe('${proposal.title}', () => {
  let feature: ${className};

  beforeEach(() => {
    feature = new ${className}();
  });

  it('should initialize correctly', () => {
    expect(feature).toBeDefined();
  });

  it('should execute without errors', async () => {
    await expect(feature.execute()).resolves.not.toThrow();
  });

  // TODO: Add more specific tests based on user stories
${proposal.userStories
  .map(
    (story) => `
  it('should allow ${story.role} to ${story.action}', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });`
  )
  .join('\n')}
});
`;
  }

  /**
   * Generate feature documentation
   */
  private generateFeatureDoc(proposal: FeatureProposal): string {
    return `# ${proposal.title}

${proposal.description}

## Priority Score: ${proposal.priorityScore}

## User Stories

${proposal.userStories.map((s) => `- As a **${s.role}**, I want to **${s.action}** so that **${s.benefit}**`).join('\n')}

## Success Metrics

${proposal.successMetrics.map((m) => `- **${m.metric}**: Target ${m.target} (Measured by: ${m.measurementMethod})`).join('\n')}

## Implementation

${proposal.implementationOutline}

## Dependencies

${proposal.requiredDependencies.length > 0 ? proposal.requiredDependencies.join('\n- ') : 'No external dependencies'}

## Estimated Effort

${proposal.estimatedEffort}
`;
  }

  /**
   * Generate unique plan ID
   */
  private generatePlanId(type: string): string {
    return `plan_${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
