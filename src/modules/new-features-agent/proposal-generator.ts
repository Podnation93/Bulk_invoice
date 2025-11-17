import {
  FeatureOpportunity,
  FeatureProposal,
  UserStory,
  SuccessMetric,
  RolloutPhase,
  Risk,
  PrioritizationScore,
} from './types';

/**
 * Generates detailed feature proposals from opportunities
 */
export class ProposalGenerator {
  /**
   * Generate a complete feature proposal from an opportunity
   */
  generateProposal(opportunity: FeatureOpportunity): FeatureProposal {
    const userStories = this.generateUserStories(opportunity);
    const technicalConsiderations = this.identifyTechnicalConsiderations(opportunity);
    const successMetrics = this.defineSuccessMetrics(opportunity);
    const rolloutPlan = this.createRolloutPlan(opportunity);
    const risks = this.identifyRisks(opportunity);
    const alternatives = this.suggestAlternatives(opportunity);

    return {
      id: this.generateProposalId(),
      featureName: opportunity.title,
      problemStatement: this.formulateProblemStatement(opportunity),
      proposedSolution: this.describeSolution(opportunity),
      userStories,
      jobToBeDone: this.identifyJobToBeDone(opportunity),
      uxFlowOutline: this.outlineUXFlow(opportunity),
      technicalConsiderations,
      successMetrics,
      rolloutPlan,
      risks,
      alternatives,
      priorityScore: this.calculatePriorityScore(opportunity).totalScore,
      opportunityId: opportunity.id,
      createdAt: new Date(),
    };
  }

  /**
   * Generate user stories for the feature
   */
  private generateUserStories(opportunity: FeatureOpportunity): UserStory[] {
    const stories: UserStory[] = [];

    // Primary user story
    switch (opportunity.category) {
      case 'pain_point':
        stories.push({
          asA: 'user processing invoices',
          iWant: `to have ${opportunity.title.toLowerCase()}`,
          soThat: 'I can complete my work faster with fewer errors',
          acceptanceCriteria: [
            'Feature reduces time spent on manual corrections by 50%',
            'Error rate decreases by at least 30%',
            'User receives clear feedback when issues are detected',
          ],
        });
        break;

      case 'performance_optimization':
        stories.push({
          asA: 'user with large batch of invoices',
          iWant: 'faster processing performance',
          soThat: 'I can process all my invoices within my time constraints',
          acceptanceCriteria: [
            'Processing time reduced by at least 40%',
            'Progress indicator shows accurate ETA',
            'System remains responsive during processing',
          ],
        });
        break;

      case 'feature_gap':
        stories.push({
          asA: 'user importing invoices to Xero',
          iWant: `${opportunity.title.toLowerCase()} functionality`,
          soThat: 'my workflow is complete and efficient',
          acceptanceCriteria: [
            'Feature is accessible from main workflow',
            'Integration with existing features is seamless',
            'No data loss or corruption occurs',
          ],
        });
        break;

      case 'innovation':
        stories.push({
          asA: 'user seeking efficient invoice processing',
          iWant: 'intelligent automation features',
          soThat: 'the system learns and improves over time',
          acceptanceCriteria: [
            'AI suggestions are correct at least 80% of the time',
            'User can easily accept or reject suggestions',
            'System improves based on user feedback',
          ],
        });
        break;

      default:
        stories.push({
          asA: 'invoice processing user',
          iWant: `${opportunity.title.toLowerCase()}`,
          soThat: 'my overall experience is improved',
          acceptanceCriteria: [
            'Feature is intuitive to use',
            'Performance does not degrade',
            'Existing workflows are not disrupted',
          ],
        });
    }

    // Secondary user story for admin/power users
    stories.push({
      asA: 'system administrator',
      iWant: 'to configure and monitor this feature',
      soThat: 'I can ensure it meets organization requirements',
      acceptanceCriteria: [
        'Configuration options are available in settings',
        'Usage metrics are tracked and reportable',
        'Feature can be enabled/disabled as needed',
      ],
    });

    return stories;
  }

  /**
   * Identify technical considerations
   */
  private identifyTechnicalConsiderations(opportunity: FeatureOpportunity): string[] {
    const considerations: string[] = [];

    // Common considerations
    considerations.push('Ensure backward compatibility with existing data');
    considerations.push('Implement proper error handling and logging');
    considerations.push('Add appropriate test coverage (unit and integration)');

    // Category-specific considerations
    switch (opportunity.category) {
      case 'performance_optimization':
        considerations.push('Profile current performance to establish baseline');
        considerations.push('Consider caching strategies for frequently accessed data');
        considerations.push('Implement progress tracking for long-running operations');
        considerations.push('Test with maximum expected data volume (200+ PDFs)');
        break;

      case 'innovation':
        considerations.push('Ensure AI/ML model can be updated without full deployment');
        considerations.push('Implement fallback for when AI service is unavailable');
        considerations.push('Store user feedback for model improvement');
        considerations.push('Consider privacy implications of AI processing');
        break;

      case 'ux_improvement':
        considerations.push('Follow existing UI/UX patterns for consistency');
        considerations.push('Ensure accessibility compliance (WCAG 2.1)');
        considerations.push('Test across different screen sizes and resolutions');
        break;

      case 'feature_gap':
        considerations.push('Research Xero API requirements and limitations');
        considerations.push('Ensure data format compliance with Xero standards');
        considerations.push('Handle edge cases in invoice data');
        break;
    }

    // Impact-specific considerations
    if (opportunity.impactEstimate === 'critical') {
      considerations.push('Prioritize security review before release');
      considerations.push('Plan for gradual rollout with monitoring');
    }

    return considerations;
  }

  /**
   * Define success metrics for the feature
   */
  private defineSuccessMetrics(opportunity: FeatureOpportunity): SuccessMetric[] {
    const metrics: SuccessMetric[] = [];

    switch (opportunity.category) {
      case 'pain_point':
        metrics.push({
          name: 'Error Reduction Rate',
          targetValue: 30,
          measurementMethod: 'Compare validation errors before and after feature deployment',
        });
        metrics.push({
          name: 'Time to Completion',
          targetValue: -40,
          measurementMethod: 'Measure average time from PDF upload to CSV export',
        });
        break;

      case 'performance_optimization':
        metrics.push({
          name: 'Processing Speed Improvement',
          targetValue: 50,
          measurementMethod: 'Measure PDFs processed per minute',
        });
        metrics.push({
          name: 'User Satisfaction Score',
          targetValue: 4.5,
          measurementMethod: 'Post-processing user survey (1-5 scale)',
        });
        break;

      case 'conversion_leak':
        metrics.push({
          name: 'Completion Rate',
          targetValue: 85,
          measurementMethod: 'Percentage of started workflows that complete successfully',
        });
        metrics.push({
          name: 'Dropoff Reduction',
          targetValue: -50,
          measurementMethod: 'Compare dropoff rates at identified step',
        });
        break;

      case 'innovation':
        metrics.push({
          name: 'AI Suggestion Accuracy',
          targetValue: 85,
          measurementMethod: 'Percentage of AI suggestions accepted by users',
        });
        metrics.push({
          name: 'Manual Corrections Reduced',
          targetValue: -60,
          measurementMethod: 'Count of user edits to extracted data',
        });
        break;

      default:
        metrics.push({
          name: 'Feature Adoption Rate',
          targetValue: 70,
          measurementMethod: 'Percentage of users using the new feature',
        });
    }

    // Universal metrics
    metrics.push({
      name: 'User Retention',
      targetValue: 90,
      measurementMethod: 'Users returning within 30 days',
    });

    return metrics;
  }

  /**
   * Create a phased rollout plan
   */
  private createRolloutPlan(opportunity: FeatureOpportunity): RolloutPhase[] {
    const phases: RolloutPhase[] = [];

    // Phase 1: Internal Testing
    phases.push({
      phase: 1,
      name: 'Internal Alpha',
      description: 'Feature tested by development team with synthetic data',
      duration: '1 week',
      successCriteria: [
        'All automated tests pass',
        'No critical bugs identified',
        'Performance meets baseline requirements',
      ],
    });

    // Phase 2: Beta Testing
    phases.push({
      phase: 2,
      name: 'Limited Beta',
      description: 'Feature enabled for 10% of users with opt-in',
      duration: '2 weeks',
      successCriteria: [
        'User feedback is predominantly positive',
        'No major issues reported',
        'Metrics trending towards targets',
      ],
    });

    // Phase 3: Gradual Rollout
    phases.push({
      phase: 3,
      name: 'Gradual Rollout',
      description: 'Feature enabled for 50% of users',
      duration: '1 week',
      successCriteria: [
        'System stability maintained',
        'Support ticket volume remains normal',
        'Success metrics show improvement',
      ],
    });

    // Phase 4: Full Release
    phases.push({
      phase: 4,
      name: 'General Availability',
      description: 'Feature available to all users',
      duration: 'Ongoing',
      successCriteria: [
        'All success metrics meet or exceed targets',
        'Documentation and training complete',
        'Support team fully trained',
      ],
    });

    return phases;
  }

  /**
   * Identify potential risks
   */
  private identifyRisks(opportunity: FeatureOpportunity): Risk[] {
    const risks: Risk[] = [];

    // Universal risks
    risks.push({
      description: 'Feature may not meet user expectations',
      severity: 'medium',
      mitigation: 'Conduct user research and gather feedback during beta phase',
    });

    risks.push({
      description: 'Technical implementation more complex than estimated',
      severity: 'medium',
      mitigation: 'Break down into smaller tasks and track progress closely',
    });

    // Category-specific risks
    switch (opportunity.category) {
      case 'innovation':
        risks.push({
          description: 'AI model accuracy insufficient for production use',
          severity: 'high',
          mitigation: 'Extensive testing with real data and fallback mechanisms',
        });
        risks.push({
          description: 'Privacy concerns with AI data processing',
          severity: 'high',
          mitigation: 'Ensure all processing is local, no data sent externally',
        });
        break;

      case 'performance_optimization':
        risks.push({
          description: 'Performance improvements may introduce bugs',
          severity: 'medium',
          mitigation: 'Comprehensive regression testing suite',
        });
        break;

      case 'feature_gap':
        risks.push({
          description: 'Xero API changes may break integration',
          severity: 'medium',
          mitigation: 'Monitor Xero API changelog and implement version handling',
        });
        break;
    }

    // Impact-based risks
    if (opportunity.impactEstimate === 'critical') {
      risks.push({
        description: 'Failure could significantly impact user trust',
        severity: 'high',
        mitigation: 'Extensive QA, monitoring, and quick rollback capability',
      });
    }

    return risks;
  }

  /**
   * Suggest alternative approaches
   */
  private suggestAlternatives(opportunity: FeatureOpportunity): string[] {
    const alternatives: string[] = [];

    switch (opportunity.category) {
      case 'pain_point':
        alternatives.push('Improve documentation and user guidance instead of automated solution');
        alternatives.push('Provide warning system before errors occur');
        alternatives.push('Offer premium support for complex cases');
        break;

      case 'performance_optimization':
        alternatives.push('Optimize existing code before adding new features');
        alternatives.push('Implement background processing with notification');
        alternatives.push('Offer tiered processing (fast vs thorough)');
        break;

      case 'innovation':
        alternatives.push('Rule-based system instead of AI/ML');
        alternatives.push('User-defined templates and mappings');
        alternatives.push('Integration with third-party specialized service');
        break;

      case 'feature_gap':
        alternatives.push('Partner with existing solution provider');
        alternatives.push('Provide export to format supported by other tools');
        alternatives.push('Offer manual workaround documentation');
        break;
    }

    return alternatives;
  }

  /**
   * Formulate problem statement
   */
  private formulateProblemStatement(opportunity: FeatureOpportunity): string {
    return `${opportunity.summary}. ${opportunity.explanation} This represents a ${opportunity.impactEstimate} impact ${opportunity.category.replace(/_/g, ' ')} that needs to be addressed to improve user satisfaction and product effectiveness.`;
  }

  /**
   * Describe the proposed solution
   */
  private describeSolution(opportunity: FeatureOpportunity): string {
    switch (opportunity.category) {
      case 'pain_point':
        return `Implement an intelligent system that proactively identifies and addresses the root cause of the pain point. This includes better user guidance, automated detection of issues, and smart suggestions for resolution. The solution should reduce user friction while maintaining data accuracy.`;

      case 'performance_optimization':
        return `Optimize the processing pipeline through parallel processing, efficient caching, and smart resource management. Implement progress visibility and allow users to prioritize critical items. Target is 50% improvement in processing speed.`;

      case 'innovation':
        return `Leverage machine learning and AI capabilities to automate complex decision-making. The system will learn from user behavior and historical data to provide increasingly accurate suggestions. All processing remains local to ensure privacy.`;

      case 'feature_gap':
        return `Implement the missing functionality as a first-class feature integrated seamlessly into the existing workflow. Ensure compatibility with Xero requirements and provide clear user feedback throughout the process.`;

      default:
        return `Address the identified opportunity through targeted improvements that enhance the overall user experience while maintaining system reliability and performance.`;
    }
  }

  /**
   * Identify job-to-be-done
   */
  private identifyJobToBeDone(opportunity: FeatureOpportunity): string {
    return `Help users complete invoice processing tasks more efficiently and accurately, reducing manual effort and errors while ensuring compliance with Xero import requirements.`;
  }

  /**
   * Outline UX flow
   */
  private outlineUXFlow(opportunity: FeatureOpportunity): string {
    return `
1. User initiates action (e.g., uploads PDFs, clicks process)
2. System analyzes input and applies ${opportunity.title.toLowerCase()}
3. Progress/status indicator shows current state
4. Results displayed with clear success/warning/error states
5. User reviews and can adjust if needed
6. User confirms and proceeds to next step
7. System logs action for future improvement
    `.trim();
  }

  /**
   * Calculate priority score using RICE framework
   */
  calculatePriorityScore(opportunity: FeatureOpportunity): PrioritizationScore {
    // Reach (1-10): How many users affected
    let reach = 7;
    if (opportunity.impactEstimate === 'critical') reach = 10;
    else if (opportunity.impactEstimate === 'high') reach = 8;
    else if (opportunity.impactEstimate === 'medium') reach = 6;
    else reach = 4;

    // Impact (1-10): Effect on each user
    let impact = 7;
    switch (opportunity.category) {
      case 'pain_point':
        impact = 9;
        break;
      case 'conversion_leak':
        impact = 10;
        break;
      case 'performance_optimization':
        impact = 8;
        break;
      case 'innovation':
        impact = 7;
        break;
      case 'feature_gap':
        impact = 8;
        break;
      default:
        impact = 6;
    }

    // Confidence (1-10): How sure are we
    const confidence = Math.round(opportunity.confidenceScore / 10);

    // Effort (1-10): Lower is better (inverse)
    let effort = 5;
    if (opportunity.category === 'innovation') effort = 8;
    else if (opportunity.category === 'performance_optimization') effort = 6;
    else if (opportunity.category === 'ux_improvement') effort = 4;

    // Strategic Alignment (1-10)
    let strategicAlignment = 7;
    if (opportunity.category === 'innovation') strategicAlignment = 9;
    else if (opportunity.category === 'conversion_leak') strategicAlignment = 10;

    // RICE Score = (Reach * Impact * Confidence) / Effort
    const totalScore = Math.round(
      ((reach * impact * confidence * strategicAlignment) / effort) * 10
    );

    const rationale = `Reach: ${reach}/10, Impact: ${impact}/10, Confidence: ${confidence}/10, Effort: ${effort}/10 (lower better), Strategic Alignment: ${strategicAlignment}/10`;

    return {
      impact,
      confidence,
      effort,
      reach,
      strategicAlignment,
      totalScore,
      rationale,
    };
  }

  private generateProposalId(): string {
    return `prop_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export default ProposalGenerator;
