import { GoogleGenerativeAI, GenerativeModel, ChatSession } from '@google/generative-ai';
import { XeroCSVRow, ValidationResult } from '../../shared/types';
import { XERO_CSV_HEADERS, REQUIRED_FIELDS, DATE_FORMAT } from '../../shared/constants';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface ValidationAnalysis {
  summary: string;
  criticalIssues: string[];
  suggestions: string[];
  autoFixable: Array<{
    rowIndex: number;
    field: string;
    currentValue: string;
    suggestedValue: string;
    reason: string;
  }>;
}

export interface GeminiAuthConfig {
  apiKey?: string;
  useOAuth?: boolean;
  accessToken?: string;
}

export class GeminiAssistant {
  private model: GenerativeModel | null = null;
  private chatSession: ChatSession | null = null;
  private chatHistory: ChatMessage[] = [];
  private isAuthenticated: boolean = false;

  /**
   * Initialize the Gemini AI model
   * Note: For production OAuth flow, this would integrate with Google's OAuth 2.0
   */
  async initialize(config: GeminiAuthConfig): Promise<boolean> {
    try {
      if (config.apiKey) {
        const genAI = new GoogleGenerativeAI(config.apiKey);
        this.model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        this.isAuthenticated = true;
        return true;
      }

      // OAuth flow would be implemented here
      if (config.useOAuth && config.accessToken) {
        // In production, use OAuth token to authenticate
        // This is a placeholder for the OAuth implementation
        console.warn('OAuth authentication not yet implemented');
        return false;
      }

      return false;
    } catch (error) {
      console.error('Failed to initialize Gemini:', error);
      return false;
    }
  }

  /**
   * Start a new chat session for CSV validation
   */
  async startValidationChat(csvRows: XeroCSVRow[]): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const systemPrompt = this.buildSystemPrompt();
    const csvContext = this.formatCSVForAnalysis(csvRows);

    this.chatSession = this.model.startChat({
      history: [
        {
          role: 'user',
          parts: [{ text: systemPrompt }],
        },
        {
          role: 'model',
          parts: [
            {
              text: 'I understand. I am ready to analyze Xero invoice CSV data and help identify issues, validate formatting, and suggest corrections. Please share the CSV data you would like me to review.',
            },
          ],
        },
      ],
      generationConfig: {
        maxOutputTokens: 2048,
        temperature: 0.3,
      },
    });

    // Send the CSV data for initial analysis
    const initialMessage = `Here is the CSV data to analyze (${csvRows.length} rows):\n\n${csvContext}`;
    const response = await this.chat(initialMessage);

    return response;
  }

  /**
   * Send a message to the chat session
   */
  async chat(message: string): Promise<string> {
    if (!this.chatSession) {
      throw new Error('Chat session not started');
    }

    // Store user message
    this.chatHistory.push({
      role: 'user',
      content: message,
      timestamp: new Date(),
    });

    const result = await this.chatSession.sendMessage(message);
    const response = result.response.text();

    // Store assistant response
    this.chatHistory.push({
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    });

    return response;
  }

  /**
   * Analyze CSV and provide validation feedback
   */
  async analyzeCSV(csvRows: XeroCSVRow[]): Promise<ValidationAnalysis> {
    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const csvData = this.formatCSVForAnalysis(csvRows);
    const prompt = `
Analyze the following Xero invoice CSV data and provide a structured validation report.

CSV Data:
${csvData}

Please analyze for:
1. Missing required fields (ContactName, InvoiceNumber, InvoiceDate, DueDate)
2. Invalid date formats (should be DD/MM/YYYY)
3. Invalid number formats in Quantity and UnitAmount
4. Duplicate invoice numbers
5. Data consistency issues

Respond in JSON format:
{
  "summary": "Brief summary of overall data quality",
  "criticalIssues": ["list of critical issues that must be fixed"],
  "suggestions": ["list of recommendations for improvement"],
  "autoFixable": [
    {
      "rowIndex": 0,
      "field": "fieldName",
      "currentValue": "current",
      "suggestedValue": "suggested",
      "reason": "why this fix is suggested"
    }
  ]
}`;

    const result = await this.model.generateContent(prompt);
    const responseText = result.response.text();

    try {
      // Extract JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
      // If parsing fails, return a basic analysis
    }

    return {
      summary: 'Analysis completed but could not parse structured response',
      criticalIssues: [],
      suggestions: [responseText],
      autoFixable: [],
    };
  }

  /**
   * Get suggested fixes for specific issues
   */
  async getSuggestedFixes(
    csvRows: XeroCSVRow[],
    validationResult: ValidationResult
  ): Promise<Map<number, Partial<XeroCSVRow>>> {
    const fixes = new Map<number, Partial<XeroCSVRow>>();

    if (!this.model) {
      return fixes;
    }

    const prompt = `
Given these validation errors:
${validationResult.errors.map((e) => `- ${e.field}: ${e.message}`).join('\n')}

And these CSV rows:
${this.formatCSVForAnalysis(csvRows.slice(0, 10))}

Suggest specific fixes for each error. Respond with JSON array of fixes:
[
  {
    "rowIndex": 0,
    "fixes": {
      "fieldName": "correctedValue"
    }
  }
]`;

    try {
      const result = await this.model.generateContent(prompt);
      const responseText = result.response.text();
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        const suggestions = JSON.parse(jsonMatch[0]);
        for (const suggestion of suggestions) {
          fixes.set(suggestion.rowIndex, suggestion.fixes);
        }
      }
    } catch (error) {
      console.error('Failed to get suggested fixes:', error);
    }

    return fixes;
  }

  /**
   * Ask a specific question about the CSV data
   */
  async askQuestion(question: string): Promise<string> {
    if (!this.chatSession) {
      throw new Error('Chat session not started. Call startValidationChat first.');
    }

    return this.chat(question);
  }

  /**
   * Get natural language explanation for a validation error
   */
  async explainError(error: string, context?: string): Promise<string> {
    if (!this.model) {
      throw new Error('Gemini model not initialized');
    }

    const prompt = `
Explain this Xero invoice validation error in simple terms:
Error: ${error}
${context ? `Context: ${context}` : ''}

Provide:
1. What the error means
2. Why it's important to fix
3. How to fix it
`;

    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  /**
   * Build the system prompt for the assistant
   */
  private buildSystemPrompt(): string {
    return `You are a Xero invoice data validation assistant. Your role is to:

1. Analyze CSV data formatted for Xero sales invoice import
2. Identify data quality issues and validation errors
3. Suggest corrections and improvements
4. Explain errors in clear, non-technical language
5. Help users fix common invoice data problems

Key Xero CSV requirements:
- Headers must match exactly: ${XERO_CSV_HEADERS.join(', ')}
- Required fields: ${REQUIRED_FIELDS.join(', ')}
- Date format: ${DATE_FORMAT} (Australian format)
- Numeric fields must be properly formatted
- Each line item is a separate row
- Multiple rows can share the same InvoiceNumber for multi-line invoices

Common issues to check:
- Missing required fields
- Invalid date formats
- Invalid numeric values
- Duplicate invoice numbers (unless intentional for multi-line)
- Missing contact names
- Inconsistent data

Always provide actionable advice and specific suggestions when possible.`;
  }

  /**
   * Format CSV rows for AI analysis
   */
  private formatCSVForAnalysis(rows: XeroCSVRow[]): string {
    const headers = XERO_CSV_HEADERS.join(',');
    const dataRows = rows.map((row, index) => {
      const values = XERO_CSV_HEADERS.map(
        (header) => row[header as keyof XeroCSVRow] || ''
      );
      return `Row ${index + 1}: ${values.join(',')}`;
    });

    return `Headers: ${headers}\n\n${dataRows.join('\n')}`;
  }

  /**
   * Get chat history
   */
  getChatHistory(): ChatMessage[] {
    return [...this.chatHistory];
  }

  /**
   * Clear chat history
   */
  clearChatHistory(): void {
    this.chatHistory = [];
    this.chatSession = null;
  }

  /**
   * Check if authenticated
   */
  isReady(): boolean {
    return this.isAuthenticated && this.model !== null;
  }

  /**
   * Chunk large CSV data for processing
   */
  private chunkCSVData(rows: XeroCSVRow[], chunkSize: number = 50): XeroCSVRow[][] {
    const chunks: XeroCSVRow[][] = [];
    for (let i = 0; i < rows.length; i += chunkSize) {
      chunks.push(rows.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Analyze large CSV in chunks
   */
  async analyzeLargeCSV(csvRows: XeroCSVRow[]): Promise<ValidationAnalysis> {
    const chunks = this.chunkCSVData(csvRows);
    const analyses: ValidationAnalysis[] = [];

    for (const chunk of chunks) {
      const analysis = await this.analyzeCSV(chunk);
      analyses.push(analysis);
    }

    // Combine analyses
    return {
      summary: `Analyzed ${csvRows.length} rows across ${chunks.length} chunks`,
      criticalIssues: analyses.flatMap((a) => a.criticalIssues),
      suggestions: [...new Set(analyses.flatMap((a) => a.suggestions))],
      autoFixable: analyses.flatMap((a) => a.autoFixable),
    };
  }
}

export default GeminiAssistant;
