/**
 * Types for the Bug Review Agent
 */

export interface BugReport {
  id: string;
  source: BugSource;
  title: string;
  body: string;
  attachments: Attachment[];
  metadata: BugMetadata;
  reporter: string;
  createdAt: Date;
}

export type BugSource =
  | 'github'
  | 'jira'
  | 'azure_devops'
  | 'zendesk'
  | 'sentry'
  | 'email'
  | 'slack'
  | 'manual';

export interface Attachment {
  type: 'log' | 'screenshot' | 'video' | 'stack_trace' | 'config';
  name: string;
  content: string;
  mimeType?: string;
}

export interface BugMetadata {
  repo?: string;
  labels?: string[];
  environment?: string;
  version?: string;
  os?: string;
  browser?: string;
  device?: string;
}

export interface BugReviewResult {
  reviewId: string;
  originalReportId: string;
  summary: BugSummary;
  extractedFields: ExtractedBugFields;
  severitySuggestion: SeveritySuggestion;
  reproducibility: ReproducibilityEstimate;
  rootCauseHypotheses: RootCauseHypothesis[];
  suggestedLabels: string[];
  suggestedOwner: OwnerSuggestion;
  suggestedPriority: PrioritySuggestion;
  suggestedTests: TestSuggestion[];
  codeLocations: CodeLocation[];
  patchSuggestion?: PatchSuggestion;
  recommendedActions: RecommendedAction[];
  provenance: Provenance;
  createdAt: Date;
}

export interface BugSummary {
  title: string;
  description: string;
  expectedBehavior: string;
  actualBehavior: string;
}

export interface ExtractedBugFields {
  product?: string;
  component?: string;
  os?: string;
  browser?: string;
  device?: string;
  version?: string;
  environment?: string;
  stepsToReproduce: string[];
  errorCodes: string[];
  timestamps: string[];
  userActions: string[];
  configValues: Record<string, string>;
}

export interface SeveritySuggestion {
  level: SeverityLevel;
  confidence: number;
  reasoning: string;
}

export type SeverityLevel = 'P0' | 'P1' | 'P2' | 'P3' | 'P4';

export interface ReproducibilityEstimate {
  level: 'likely' | 'possible' | 'not_reproducible';
  confidence: number;
  checklist: string[];
  missingInfo: string[];
}

export interface RootCauseHypothesis {
  hypothesis: string;
  confidence: number;
  evidence: Evidence[];
  testableChecks: string[];
}

export interface Evidence {
  type: 'stack_frame' | 'log_entry' | 'error_code' | 'pattern_match' | 'historical';
  description: string;
  file?: string;
  line?: number;
  snippet?: string;
}

export interface OwnerSuggestion {
  team: string;
  confidence: number;
  reasoning: string;
  alternativeOwners?: string[];
}

export interface PrioritySuggestion {
  backlogBucket: string;
  estimatedEffort: 'S' | 'M' | 'L' | 'XL';
  confidence: number;
}

export interface TestSuggestion {
  type: 'unit' | 'integration' | 'e2e';
  description: string;
  targetModule: string;
}

export interface CodeLocation {
  file: string;
  function?: string;
  module: string;
  confidence: number;
  codeSearchLink?: string;
}

export interface PatchSuggestion {
  description: string;
  pseudoCode: string;
  riskLevel: 'low' | 'medium' | 'high';
  confidence: number;
}

export type RecommendedAction =
  | 'assign'
  | 'request_more_info'
  | 'close_as_duplicate'
  | 'close_as_wontfix'
  | 'escalate_to_security'
  | 'mark_regression'
  | 'add_to_sprint';

export interface Provenance {
  modelVersions: Record<string, string>;
  analysisTimestamp: Date;
  confidence: number;
  evidenceSources: string[];
}

export interface TriageAction {
  action: RecommendedAction;
  target?: string;
  comment?: string;
  autoApply: boolean;
}

export interface HumanOverride {
  reviewId: string;
  field: string;
  originalValue: unknown;
  newValue: unknown;
  reason: string;
  user: string;
  timestamp: Date;
}

export interface BugReviewStats {
  totalReviewed: number;
  averageTimeToTriage: number;
  acceptanceRate: number;
  overrideRate: number;
  severityAccuracy: number;
  ownerAccuracy: number;
}

export interface ClarifyingQuestion {
  question: string;
  field: string;
  priority: 'high' | 'medium' | 'low';
}
