import { BugReviewResult } from '../bug-review-agent/types';
import { FeatureProposal } from '../new-features-agent/types';

/**
 * Types for Auto-Fixer Agent
 */

export type FixType = 'bug_fix' | 'feature_implementation' | 'refactor' | 'security_patch';
export type FixStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'rolled_back';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface CodeChange {
  filePath: string;
  originalContent: string;
  newContent: string;
  changeType: 'create' | 'modify' | 'delete';
  description: string;
}

export interface FixPlan {
  id: string;
  type: FixType;
  title: string;
  description: string;
  priority: number;
  riskLevel: RiskLevel;
  estimatedEffort: string;
  codeChanges: CodeChange[];
  validationSteps: string[];
  rollbackPlan: string;
  dependencies: string[];
  createdAt: Date;
}

export interface FixResult {
  planId: string;
  status: FixStatus;
  appliedChanges: CodeChange[];
  validationResults: ValidationCheckResult[];
  errors: string[];
  warnings: string[];
  rollbackAvailable: boolean;
  executionTime: number;
  completedAt: Date;
}

export interface ValidationCheckResult {
  check: string;
  passed: boolean;
  message: string;
  details?: string;
}

export interface AutoFixerConfig {
  maxRiskLevel: RiskLevel;
  requireValidation: boolean;
  autoCommit: boolean;
  dryRun: boolean;
  backupEnabled: boolean;
}

export interface FixQueue {
  pending: FixPlan[];
  inProgress: FixPlan | null;
  completed: FixResult[];
  failed: FixResult[];
}

export interface AgentRecommendation {
  source: 'bug_review' | 'new_features';
  priority: number;
  recommendation: string;
  actionItems: string[];
  codeContext?: {
    files: string[];
    patterns: string[];
    dependencies: string[];
  };
}

export interface AutoFixerStats {
  totalPlansGenerated: number;
  totalFixesApplied: number;
  successRate: number;
  averageExecutionTime: number;
  rollbackCount: number;
  riskDistribution: Record<RiskLevel, number>;
}

export interface BugFixInput {
  bugReview: BugReviewResult;
  additionalContext?: string;
}

export interface FeatureFixInput {
  proposal: FeatureProposal;
  scope?: 'minimal' | 'standard' | 'complete';
}
