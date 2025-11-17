# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bulk PDF Invoice Extraction and CSV Generation tool for Xero Import. Extracts invoice data from multiple PDFs (scanned and digital) and generates CSV files formatted for Xero's sales invoice import template.

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Frontend**: Electron (desktop app) with React
- **OCR**: Tesseract.js for local processing
- **PDF Parsing**: pdf-parse for digital PDFs, pdf2pic for scanned PDFs
- **AI Integration**: Google Gemini API with OAuth 2.0 authentication
- **Build Tool**: Vite for frontend, tsc for backend

## Architecture

### Core Modules

1. **PDF Processor Module** (`src/modules/pdf-processor/`)
   - File ingestion and format detection
   - Batch processing orchestration
   - Digital vs scanned PDF identification

2. **OCR Engine** (`src/modules/ocr/`)
   - Tesseract.js integration
   - Confidence scoring
   - Text extraction from scanned PDFs

3. **Parser Engine** (`src/modules/parser/`)
   - Regex-based field extraction
   - Pattern matching for invoice fields
   - Line-item discovery and structuring

4. **Validation Layer** (`src/modules/validation/`)
   - Schema validation against Xero template
   - Date format validation (Australian format: DD/MM/YYYY)
   - Required field checks
   - Data type validation

5. **Template Formatter** (`src/modules/formatter/`)
   - Maps extracted data to Xero CSV columns
   - Handles multi-line items per invoice
   - Enforces exact column headers

6. **Export Module** (`src/modules/export/`)
   - UTF-8 CSV generation
   - Preview functionality
   - Extraction issue logging

7. **Gemini AI Chatbot** (`src/modules/ai-assistant/`)
   - OAuth 2.0 authentication
   - CSV validation and error detection
   - Conversational feedback
   - Auto-correction suggestions

8. **User Interface** (`src/renderer/`)
   - React-based Electron frontend
   - Drag-and-drop PDF upload
   - Real-time processing status
   - Editable data preview table
   - Step-by-step workflow wizard

9. **Main Process** (`src/main/`)
   - Electron main process orchestration
   - IPC handlers for module communication
   - File dialog management
   - Preload scripts for secure context bridging

10. **New Features Agent** (`src/modules/new-features-agent/`)
    - Autonomous product-development intelligence
    - Opportunity detection from usage analytics and feedback
    - Feature proposal generation with RICE prioritization
    - User story and success metrics definition
    - Rollout planning and risk assessment

11. **Bug Review Agent** (`src/modules/bug-review-agent/`)
    - Automated bug triage and analysis
    - Report parsing and field extraction
    - Severity classification (P0-P4)
    - Root cause hypothesis generation
    - Owner/team suggestion based on code ownership
    - Patch suggestions for high-confidence fixes
    - Reproducibility estimation

12. **Auto-Fixer Agent** (`src/modules/auto-fixer-agent/`)
    - Automatically implements bug fixes from Bug Review Agent
    - Implements feature recommendations from New Features Agent
    - Code generation based on agent suggestions
    - Safe patch application with rollback capability
    - Validates fixes before committing

## Agent Review Workflow

**IMPORTANT**: The New Features Agent and Bug Review Agent run directly within Claude Code to continuously review and improve this project. They are NOT part of the application itself.

### How It Works

1. **Continuous Review**: When working on this codebase, Claude Code should periodically run the agents to:
   - Detect potential bugs and security issues
   - Identify feature improvement opportunities
   - Generate prioritized recommendations

2. **Auto-Fix Workflow**: The Auto-Fixer Agent takes recommendations and:
   - Automatically implements suggested bug fixes
   - Builds new features from proposals
   - Validates and tests changes before committing

3. **Proactive Maintenance**: Always run agents to check for:
   - Security vulnerabilities (CSV injection, memory leaks, etc.)
   - Performance optimizations
   - Code quality improvements
   - Missing features based on domain analysis

### Running the Agents

When Claude Code is working on this project, it should:
1. Run New Features Agent analysis to identify improvement opportunities
2. Run Bug Review Agent to detect potential issues
3. Use Auto-Fixer Agent to implement high-priority fixes/features
4. Commit changes with detailed descriptions

## Commands

```bash
# Install dependencies
npm install

# Development
npm run dev              # Start Electron app in dev mode
npm run dev:renderer     # Start React frontend only

# Build
npm run build            # Build for production
npm run package          # Package Electron app

# Testing
npm test                 # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests

# Linting
npm run lint             # ESLint check
npm run lint:fix         # Auto-fix lint issues
npm run typecheck        # TypeScript type checking
```

## Key Conventions

- All dates must be in Australian format: DD/MM/YYYY
- CSV output must strictly match Xero template headers (no additions/removals)
- Local processing only unless cloud processing explicitly enabled
- No PDF data persistence after export
- Confidence thresholds for OCR flagging low-certainty fields
- Per-file logging for extraction failures

## Logging & Error Handling

- Winston-based structured logging (`src/shared/utils/logger.ts`)
- Log files stored in `logs/` directory (app.log, error.log)
- Custom error types for domain-specific errors (`src/shared/utils/error-handler.ts`)
  - PDFProcessingError, OCRError, ValidationError, ExportError, AIAssistantError
- All operations wrapped with error handling and audit trails
- Performance timing utilities for profiling

## Data Flow

```
PDF Files → PDF Processor → OCR Engine (if scanned) → Parser Engine → Validation Layer → Template Formatter → CSV Export
```

## Xero CSV Template Fields

- ContactName (required)
- InvoiceNumber (required)
- InvoiceDate (required, DD/MM/YYYY)
- DueDate (required, DD/MM/YYYY)
- Description
- Quantity
- UnitAmount
- AccountCode
- TaxType
- Reference
