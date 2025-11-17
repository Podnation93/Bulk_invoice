import { OpportunityDetector } from './opportunity-detector';
import { ProposalGenerator } from './proposal-generator';
import {
  FeatureOpportunity,
  FeatureProposal,
  UsageAnalytics,
  UserFeedback,
  AnalysisReport,
  AgentContext,
} from './types';
import { log } from '../../shared/utils/logger';

/**
 * New Features Agent - Autonomous product-development intelligence system
 * Discovers, analyzes, and proposes new product features
 */
export class NewFeaturesAgent {
  private opportunityDetector: OpportunityDetector;
  private proposalGenerator: ProposalGenerator;
  private context: AgentContext;

  constructor() {
    this.opportunityDetector = new OpportunityDetector();
    this.proposalGenerator = new ProposalGenerator();
    this.context = this.initializeContext();
  }

  /**
   * Initialize agent context with product-specific information
   */
  private initializeContext(): AgentContext {
    return {
      productDescription:
        'Bulk PDF Invoice Extraction and CSV Generation tool for Xero Import. Extracts invoice data from multiple PDFs and generates CSV files formatted for Xero.',
      currentFeatures: [
        'PDF file ingestion (drag & drop, file selection)',
        'Digital and scanned PDF processing',
        'OCR text extraction with Tesseract.js',
        'Invoice field extraction (number, dates, contact, line items)',
        'Data validation against Xero schema',
        'CSV generation with Xero template format',
        'Data preview and manual editing',
        'AI-powered validation assistance (Gemini)',
        'Error logging and reporting',
      ],
      targetUserPersonas: [
        'Small business owners managing invoices',
        'Accountants processing client invoices',
        'Bookkeepers importing historical data',
        'Finance teams migrating to Xero',
      ],
      businessGoals: [
        'Reduce manual data entry time by 80%',
        'Achieve 95% extraction accuracy',
        'Process 200+ PDFs in under 5 minutes',
        'Ensure 100% Xero import compatibility',
      ],
      technicalConstraints: [
        'Local processing only (no cloud unless explicit)',
        'No PDF data persistence after export',
        'Must support Australian date format (DD/MM/YYYY)',
        'Electron desktop application',
      ],
      complianceRequirements: [
        'Data privacy (no external transmission)',
        'Audit trail for all processing',
        'GST/Tax compliance for Australian businesses',
      ],
    };
  }

  /**
   * Run full analysis and generate comprehensive report
   */
  async analyzeAndPropose(
    analytics?: UsageAnalytics,
    feedback?: UserFeedback[]
  ): Promise<AnalysisReport> {
    log.info('New Features Agent starting analysis');

    const opportunities: FeatureOpportunity[] = [];
    const proposals: FeatureProposal[] = [];

    // Detect opportunities from various sources
    if (analytics) {
      const usageOpportunities = this.opportunityDetector.analyzeUsageData(analytics);
      opportunities.push(...usageOpportunities);
      log.info(`Detected ${usageOpportunities.length} opportunities from usage analytics`);
    }

    if (feedback && feedback.length > 0) {
      const feedbackOpportunities = this.opportunityDetector.analyzeFeedback(feedback);
      opportunities.push(...feedbackOpportunities);
      log.info(`Detected ${feedbackOpportunities.length} opportunities from user feedback`);
    }

    // Always include domain-specific opportunities
    const domainOpportunities =
      this.opportunityDetector.detectDomainSpecificOpportunities();
    opportunities.push(...domainOpportunities);
    log.info(`Added ${domainOpportunities.length} domain-specific opportunities`);

    // Include market trend opportunities
    const trendOpportunities = this.opportunityDetector.analyzeMarketTrends();
    opportunities.push(...trendOpportunities);
    log.info(`Added ${trendOpportunities.length} market trend opportunities`);

    // Generate proposals for top opportunities
    const sortedOpportunities = this.prioritizeOpportunities(opportunities);
    const topOpportunities = sortedOpportunities.slice(0, 10);

    for (const opportunity of topOpportunities) {
      const proposal = this.proposalGenerator.generateProposal(opportunity);
      proposals.push(proposal);
    }

    log.info(`Generated ${proposals.length} feature proposals`);

    // Prioritize backlog
    const prioritizedBacklog = this.prioritizeBacklog(proposals);

    // Generate insights
    const keyInsights = this.generateKeyInsights(opportunities, proposals);

    // Recommend next steps
    const recommendedNextSteps = this.generateNextSteps(prioritizedBacklog);

    const report: AnalysisReport = {
      timestamp: new Date(),
      opportunities,
      proposals,
      prioritizedBacklog,
      keyInsights,
      recommendedNextSteps,
    };

    log.info('New Features Agent analysis complete', {
      opportunitiesFound: opportunities.length,
      proposalsGenerated: proposals.length,
    });

    return report;
  }

  /**
   * Prioritize opportunities based on impact and confidence
   */
  private prioritizeOpportunities(
    opportunities: FeatureOpportunity[]
  ): FeatureOpportunity[] {
    return opportunities.sort((a, b) => {
      const aScore = this.calculateOpportunityScore(a);
      const bScore = this.calculateOpportunityScore(b);
      return bScore - aScore;
    });
  }

  /**
   * Calculate opportunity score
   */
  private calculateOpportunityScore(opportunity: FeatureOpportunity): number {
    let impactMultiplier = 1;
    switch (opportunity.impactEstimate) {
      case 'critical':
        impactMultiplier = 4;
        break;
      case 'high':
        impactMultiplier = 3;
        break;
      case 'medium':
        impactMultiplier = 2;
        break;
      case 'low':
        impactMultiplier = 1;
        break;
    }

    return opportunity.confidenceScore * impactMultiplier;
  }

  /**
   * Prioritize the feature backlog
   */
  private prioritizeBacklog(proposals: FeatureProposal[]): FeatureProposal[] {
    return proposals.sort((a, b) => b.priorityScore - a.priorityScore);
  }

  /**
   * Generate key insights from analysis
   */
  private generateKeyInsights(
    opportunities: FeatureOpportunity[],
    proposals: FeatureProposal[]
  ): string[] {
    const insights: string[] = [];

    // Count by category
    const categoryCount = new Map<string, number>();
    for (const opp of opportunities) {
      categoryCount.set(opp.category, (categoryCount.get(opp.category) || 0) + 1);
    }

    const topCategory = Array.from(categoryCount.entries()).sort(
      (a, b) => b[1] - a[1]
    )[0];

    if (topCategory) {
      insights.push(
        `Most opportunities identified are ${topCategory[0].replace(/_/g, ' ')} type (${topCategory[1]} found)`
      );
    }

    // Count critical/high impact
    const criticalHighCount = opportunities.filter(
      (o) => o.impactEstimate === 'critical' || o.impactEstimate === 'high'
    ).length;

    insights.push(
      `${criticalHighCount} out of ${opportunities.length} opportunities have critical or high impact potential`
    );

    // Average confidence
    const avgConfidence =
      opportunities.reduce((sum, o) => sum + o.confidenceScore, 0) /
      opportunities.length;
    insights.push(
      `Average confidence score across opportunities is ${avgConfidence.toFixed(1)}%`
    );

    // Top proposal
    if (proposals.length > 0) {
      const topProposal = proposals[0];
      insights.push(
        `Highest priority feature: "${topProposal.featureName}" with priority score of ${topProposal.priorityScore}`
      );
    }

    // Innovation opportunities
    const innovationCount = opportunities.filter(
      (o) => o.category === 'innovation' || o.category === 'trend_alignment'
    ).length;
    if (innovationCount > 0) {
      insights.push(
        `${innovationCount} opportunities for innovation and market differentiation identified`
      );
    }

    return insights;
  }

  /**
   * Generate recommended next steps
   */
  private generateNextSteps(prioritizedBacklog: FeatureProposal[]): string[] {
    const steps: string[] = [];

    if (prioritizedBacklog.length === 0) {
      steps.push('Gather more user feedback and usage analytics to identify opportunities');
      return steps;
    }

    const topProposal = prioritizedBacklog[0];

    steps.push(`Begin implementation planning for "${topProposal.featureName}"`);
    steps.push('Review user stories and acceptance criteria with stakeholders');
    steps.push('Conduct technical feasibility assessment for top 3 proposals');
    steps.push('Set up metrics tracking for baseline measurements');
    steps.push('Schedule user research sessions to validate assumptions');

    if (prioritizedBacklog.length > 1) {
      steps.push(
        `Prepare development timeline including "${prioritizedBacklog[1].featureName}" as next priority`
      );
    }

    return steps;
  }

  /**
   * Get current product context
   */
  getContext(): AgentContext {
    return { ...this.context };
  }

  /**
   * Update product context
   */
  updateContext(updates: Partial<AgentContext>): void {
    this.context = { ...this.context, ...updates };
    log.info('New Features Agent context updated');
  }

  /**
   * Generate a quick analysis without external data
   */
  generateQuickAnalysis(): AnalysisReport {
    log.info('Generating quick analysis based on domain knowledge');

    const opportunities = [
      ...this.opportunityDetector.detectDomainSpecificOpportunities(),
      ...this.opportunityDetector.analyzeMarketTrends(),
    ];

    const proposals = opportunities.map((opp) =>
      this.proposalGenerator.generateProposal(opp)
    );

    const prioritizedBacklog = this.prioritizeBacklog(proposals);

    return {
      timestamp: new Date(),
      opportunities,
      proposals,
      prioritizedBacklog,
      keyInsights: this.generateKeyInsights(opportunities, proposals),
      recommendedNextSteps: this.generateNextSteps(prioritizedBacklog),
    };
  }

  /**
   * Format report as readable text
   */
  formatReportAsText(report: AnalysisReport): string {
    let output = '═══════════════════════════════════════════════════════════════\n';
    output += '                    NEW FEATURES AGENT REPORT                    \n';
    output += `                    ${report.timestamp.toISOString()}                 \n`;
    output += '═══════════════════════════════════════════════════════════════\n\n';

    output += '📊 KEY INSIGHTS\n';
    output += '───────────────────────────────────────────────────────────────\n';
    for (const insight of report.keyInsights) {
      output += `• ${insight}\n`;
    }
    output += '\n';

    output += '🎯 TOP FEATURE OPPORTUNITIES\n';
    output += '───────────────────────────────────────────────────────────────\n';
    for (let i = 0; i < Math.min(5, report.opportunities.length); i++) {
      const opp = report.opportunities[i];
      output += `${i + 1}. ${opp.title}\n`;
      output += `   Impact: ${opp.impactEstimate.toUpperCase()} | Confidence: ${opp.confidenceScore}%\n`;
      output += `   ${opp.summary}\n\n`;
    }

    output += '📋 PRIORITIZED BACKLOG\n';
    output += '───────────────────────────────────────────────────────────────\n';
    for (let i = 0; i < Math.min(5, report.prioritizedBacklog.length); i++) {
      const proposal = report.prioritizedBacklog[i];
      output += `${i + 1}. ${proposal.featureName} (Score: ${proposal.priorityScore})\n`;
      output += `   ${proposal.problemStatement.substring(0, 100)}...\n\n`;
    }

    output += '➡️  RECOMMENDED NEXT STEPS\n';
    output += '───────────────────────────────────────────────────────────────\n';
    for (const step of report.recommendedNextSteps) {
      output += `• ${step}\n`;
    }

    output += '\n═══════════════════════════════════════════════════════════════\n';

    return output;
  }
}

export default NewFeaturesAgent;
export * from './types';
export { OpportunityDetector } from './opportunity-detector';
export { ProposalGenerator } from './proposal-generator';
