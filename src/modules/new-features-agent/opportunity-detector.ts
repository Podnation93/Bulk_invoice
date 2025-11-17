import {
  FeatureOpportunity,
  UsageAnalytics,
  UserFeedback,
  OpportunityCategory,
  ImpactLevel,
} from './types';
import { v4 as uuidv4 } from 'crypto';

/**
 * Detects opportunities for product improvement based on various data sources
 */
export class OpportunityDetector {
  /**
   * Analyze usage analytics to detect opportunities
   */
  analyzeUsageData(analytics: UsageAnalytics): FeatureOpportunity[] {
    const opportunities: FeatureOpportunity[] = [];

    // Detect high error rates
    if (analytics.validationErrorRate > 0.2) {
      opportunities.push({
        id: this.generateId(),
        title: 'Improve Data Validation Guidance',
        summary: 'High validation error rate indicates users struggle with data requirements',
        explanation: `Current validation error rate is ${(analytics.validationErrorRate * 100).toFixed(1)}%. Users frequently encounter validation errors, suggesting they need better guidance on data requirements or the system needs smarter auto-correction.`,
        category: 'pain_point',
        impactEstimate: 'high',
        confidenceScore: 85,
        evidenceSources: ['usage_analytics'],
        relatedMetrics: ['validation_error_rate', 'time_to_completion'],
        detectedAt: new Date(),
      });
    }

    // Detect OCR issues
    if (analytics.ocrSuccessRate < 0.9) {
      opportunities.push({
        id: this.generateId(),
        title: 'Enhance OCR Accuracy',
        summary: 'OCR success rate below target indicates quality issues',
        explanation: `OCR success rate is ${(analytics.ocrSuccessRate * 100).toFixed(1)}%, below the 95% target. This causes manual corrections and user frustration.`,
        category: 'performance_optimization',
        impactEstimate: 'critical',
        confidenceScore: 92,
        evidenceSources: ['usage_analytics', 'ocr_metrics'],
        relatedMetrics: ['ocr_success_rate', 'manual_correction_rate'],
        detectedAt: new Date(),
      });
    }

    // Detect slow processing
    if (analytics.averageProcessingTime > 300000) {
      // > 5 minutes
      opportunities.push({
        id: this.generateId(),
        title: 'Optimize Processing Performance',
        summary: 'Processing time exceeds user expectations',
        explanation: `Average processing time of ${Math.round(analytics.averageProcessingTime / 1000)}s is too slow. Users may abandon the process or lose productivity.`,
        category: 'performance_optimization',
        impactEstimate: 'high',
        confidenceScore: 88,
        evidenceSources: ['usage_analytics'],
        relatedMetrics: ['processing_time', 'completion_rate'],
        detectedAt: new Date(),
      });
    }

    // Analyze common errors
    const topErrors = analytics.mostCommonErrors.slice(0, 3);
    for (const error of topErrors) {
      if (error.count > 10) {
        opportunities.push({
          id: this.generateId(),
          title: `Auto-Fix: ${error.error}`,
          summary: `Frequently occurring error could be auto-corrected`,
          explanation: `"${error.error}" has occurred ${error.count} times. Implementing automatic correction would save significant user effort.`,
          category: 'ux_improvement',
          impactEstimate: this.calculateErrorImpact(error.count),
          confidenceScore: 75,
          evidenceSources: ['error_logs'],
          relatedMetrics: ['error_frequency', 'user_effort'],
          detectedAt: new Date(),
        });
      }
    }

    // Detect workflow dropoffs
    for (const dropoff of analytics.dropoffPoints) {
      if (dropoff.dropoffRate > 0.15) {
        opportunities.push({
          id: this.generateId(),
          title: `Reduce Dropoff at ${dropoff.step}`,
          summary: 'Significant user dropoff detected at workflow step',
          explanation: `${(dropoff.dropoffRate * 100).toFixed(1)}% of users abandon the process at "${dropoff.step}". This is a critical conversion leak.`,
          category: 'conversion_leak',
          impactEstimate: 'critical',
          confidenceScore: 90,
          evidenceSources: ['workflow_analytics'],
          relatedMetrics: ['dropoff_rate', 'completion_rate'],
          detectedAt: new Date(),
        });
      }
    }

    return opportunities;
  }

  /**
   * Analyze user feedback to detect opportunities
   */
  analyzeFeedback(feedback: UserFeedback[]): FeatureOpportunity[] {
    const opportunities: FeatureOpportunity[] = [];

    // Group feedback by type
    const featureRequests = feedback.filter((f) => f.type === 'feature_request');
    const complaints = feedback.filter((f) => f.type === 'complaint');
    const suggestions = feedback.filter((f) => f.type === 'suggestion');

    // Analyze keyword frequency for feature requests
    const keywordCounts = new Map<string, number>();
    for (const fb of featureRequests) {
      for (const keyword of fb.keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }

    // Identify top requested features
    const topKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    for (const [keyword, count] of topKeywords) {
      if (count >= 3) {
        opportunities.push({
          id: this.generateId(),
          title: `Feature Request: ${this.capitalizeKeyword(keyword)}`,
          summary: `Multiple users requesting ${keyword} functionality`,
          explanation: `${count} users have requested "${keyword}". This represents a clear feature gap in the product.`,
          category: 'feature_gap',
          impactEstimate: this.calculateRequestImpact(count, featureRequests.length),
          confidenceScore: Math.min(95, 60 + count * 5),
          evidenceSources: ['user_feedback'],
          relatedMetrics: ['feature_request_count', 'user_satisfaction'],
          detectedAt: new Date(),
        });
      }
    }

    // Analyze complaint patterns
    const complaintThemes = this.extractThemes(complaints);
    for (const theme of complaintThemes) {
      opportunities.push({
        id: this.generateId(),
        title: `Address Complaint: ${theme.name}`,
        summary: `Recurring user complaint about ${theme.name.toLowerCase()}`,
        explanation: `${theme.count} complaints related to "${theme.name}". Addressing this pain point is essential for user retention.`,
        category: 'pain_point',
        impactEstimate: theme.count > 5 ? 'critical' : 'high',
        confidenceScore: 80,
        evidenceSources: ['user_feedback'],
        relatedMetrics: ['complaint_rate', 'user_retention'],
        detectedAt: new Date(),
      });
    }

    return opportunities;
  }

  /**
   * Detect opportunities specific to invoice processing domain
   */
  detectDomainSpecificOpportunities(): FeatureOpportunity[] {
    return [
      {
        id: this.generateId(),
        title: 'Intelligent Account Code Mapping',
        summary: 'Auto-suggest account codes based on invoice content',
        explanation:
          'Users manually selecting account codes is error-prone and time-consuming. ML-based suggestions could significantly improve accuracy and speed.',
        category: 'innovation',
        impactEstimate: 'high',
        confidenceScore: 78,
        evidenceSources: ['domain_analysis'],
        relatedMetrics: ['account_code_accuracy', 'time_to_completion'],
        detectedAt: new Date(),
      },
      {
        id: this.generateId(),
        title: 'Invoice Template Learning',
        summary: 'Learn and remember invoice formats from vendors',
        explanation:
          'Regular vendors have consistent invoice formats. Learning these patterns would dramatically improve extraction accuracy for repeat vendors.',
        category: 'innovation',
        impactEstimate: 'high',
        confidenceScore: 82,
        evidenceSources: ['domain_analysis'],
        relatedMetrics: ['extraction_accuracy', 'processing_time'],
        detectedAt: new Date(),
      },
      {
        id: this.generateId(),
        title: 'Batch Processing Progress Dashboard',
        summary: 'Real-time visibility into bulk processing status',
        explanation:
          'When processing 200+ PDFs, users need detailed progress visibility, estimated completion time, and ability to prioritize specific invoices.',
        category: 'ux_improvement',
        impactEstimate: 'medium',
        confidenceScore: 85,
        evidenceSources: ['domain_analysis', 'user_workflow'],
        relatedMetrics: ['user_satisfaction', 'perceived_performance'],
        detectedAt: new Date(),
      },
      {
        id: this.generateId(),
        title: 'Duplicate Invoice Detection',
        summary: 'Prevent importing duplicate invoices into Xero',
        explanation:
          'Users may accidentally process the same invoice multiple times. Detecting and warning about duplicates prevents accounting errors.',
        category: 'feature_gap',
        impactEstimate: 'high',
        confidenceScore: 90,
        evidenceSources: ['domain_analysis', 'compliance_requirements'],
        relatedMetrics: ['data_accuracy', 'error_prevention'],
        detectedAt: new Date(),
      },
      {
        id: this.generateId(),
        title: 'Tax Type Auto-Detection',
        summary: 'Automatically identify GST/tax types from invoice content',
        explanation:
          'Australian invoices contain tax information. Automatically detecting GST vs GST-free items would reduce manual work and errors.',
        category: 'innovation',
        impactEstimate: 'medium',
        confidenceScore: 72,
        evidenceSources: ['domain_analysis'],
        relatedMetrics: ['tax_accuracy', 'compliance_rate'],
        detectedAt: new Date(),
      },
    ];
  }

  /**
   * Analyze market trends for opportunities
   */
  analyzeMarketTrends(): FeatureOpportunity[] {
    return [
      {
        id: this.generateId(),
        title: 'AI-Powered Data Extraction',
        summary: 'Leverage LLMs for more intelligent document understanding',
        explanation:
          'Market trend shows increasing use of AI/LLMs for document processing. Integrating LLM-based extraction could provide competitive advantage.',
        category: 'trend_alignment',
        impactEstimate: 'high',
        confidenceScore: 75,
        evidenceSources: ['market_analysis'],
        relatedMetrics: ['competitive_position', 'feature_parity'],
        detectedAt: new Date(),
      },
      {
        id: this.generateId(),
        title: 'Mobile Document Capture',
        summary: 'Allow invoice capture via mobile camera',
        explanation:
          'Growing trend of mobile-first workflows. Users increasingly want to capture documents on-the-go.',
        category: 'trend_alignment',
        impactEstimate: 'medium',
        confidenceScore: 68,
        evidenceSources: ['market_analysis'],
        relatedMetrics: ['user_base_expansion', 'workflow_flexibility'],
        detectedAt: new Date(),
      },
    ];
  }

  private generateId(): string {
    return `opp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateErrorImpact(count: number): ImpactLevel {
    if (count > 50) return 'critical';
    if (count > 20) return 'high';
    if (count > 10) return 'medium';
    return 'low';
  }

  private calculateRequestImpact(
    count: number,
    totalRequests: number
  ): ImpactLevel {
    const percentage = count / totalRequests;
    if (percentage > 0.3) return 'critical';
    if (percentage > 0.2) return 'high';
    if (percentage > 0.1) return 'medium';
    return 'low';
  }

  private capitalizeKeyword(keyword: string): string {
    return keyword
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private extractThemes(
    feedback: UserFeedback[]
  ): Array<{ name: string; count: number }> {
    const themes = new Map<string, number>();

    for (const fb of feedback) {
      // Simple theme extraction based on keywords
      for (const keyword of fb.keywords) {
        themes.set(keyword, (themes.get(keyword) || 0) + 1);
      }
    }

    return Array.from(themes.entries())
      .filter(([_, count]) => count >= 2)
      .map(([name, count]) => ({ name: this.capitalizeKeyword(name), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }
}

export default OpportunityDetector;
