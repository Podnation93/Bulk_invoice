/**
 * Types for the New Features Agent
 */

export interface FeatureOpportunity {
  id: string;
  title: string;
  summary: string;
  explanation: string;
  category: OpportunityCategory;
  impactEstimate: ImpactLevel;
  confidenceScore: number; // 0-100
  evidenceSources: string[];
  relatedMetrics: string[];
  detectedAt: Date;
}

export type OpportunityCategory =
  | 'pain_point'
  | 'conversion_leak'
  | 'feature_gap'
  | 'innovation'
  | 'trend_alignment'
  | 'performance_optimization'
  | 'ux_improvement';

export type ImpactLevel = 'critical' | 'high' | 'medium' | 'low';

export interface FeatureProposal {
  id: string;
  featureName: string;
  problemStatement: string;
  proposedSolution: string;
  userStories: UserStory[];
  jobToBeDone: string;
  uxFlowOutline: string;
  technicalConsiderations: string[];
  successMetrics: SuccessMetric[];
  rolloutPlan: RolloutPhase[];
  risks: Risk[];
  alternatives: string[];
  priorityScore: number;
  opportunityId: string;
  createdAt: Date;
}

export interface UserStory {
  asA: string;
  iWant: string;
  soThat: string;
  acceptanceCriteria: string[];
}

export interface SuccessMetric {
  name: string;
  currentBaseline?: number;
  targetValue: number;
  measurementMethod: string;
}

export interface RolloutPhase {
  phase: number;
  name: string;
  description: string;
  duration: string;
  successCriteria: string[];
}

export interface Risk {
  description: string;
  severity: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface PrioritizationScore {
  impact: number; // 1-10
  confidence: number; // 1-10
  effort: number; // 1-10 (lower is better)
  reach: number; // 1-10
  strategicAlignment: number; // 1-10
  totalScore: number;
  rationale: string;
}

export interface UsageAnalytics {
  totalInvoicesProcessed: number;
  averageProcessingTime: number;
  ocrSuccessRate: number;
  validationErrorRate: number;
  mostCommonErrors: Array<{ error: string; count: number }>;
  featureUsageFrequency: Map<string, number>;
  userWorkflowPatterns: WorkflowPattern[];
  dropoffPoints: Array<{ step: string; dropoffRate: number }>;
}

export interface WorkflowPattern {
  patternName: string;
  frequency: number;
  steps: string[];
  avgCompletionTime: number;
  successRate: number;
}

export interface CompetitorAnalysis {
  competitorName: string;
  features: string[];
  strengths: string[];
  weaknesses: string[];
  marketPosition: string;
}

export interface UserFeedback {
  id: string;
  type: 'bug_report' | 'feature_request' | 'complaint' | 'praise' | 'suggestion';
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  keywords: string[];
  timestamp: Date;
}

export interface AgentContext {
  productDescription: string;
  currentFeatures: string[];
  targetUserPersonas: string[];
  businessGoals: string[];
  technicalConstraints: string[];
  complianceRequirements: string[];
}

export interface AnalysisReport {
  timestamp: Date;
  opportunities: FeatureOpportunity[];
  proposals: FeatureProposal[];
  prioritizedBacklog: FeatureProposal[];
  keyInsights: string[];
  recommendedNextSteps: string[];
}
