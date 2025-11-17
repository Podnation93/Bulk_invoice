# Bulk Invoice Extractor

A powerful desktop application for extracting invoice data from PDF files and generating CSV files compatible with Xero's import template. Built with Electron, React, and TypeScript.

## Features

### Core Functionality
- **PDF Processing**: Support for both digital and scanned PDF invoices
- **OCR Engine**: Tesseract.js-based text extraction with confidence scoring
- **Smart Parsing**: Regex and pattern-based extraction of invoice fields
- **Data Validation**: Automatic validation against Xero schema requirements
- **CSV Export**: Generate Xero-compatible CSV files with UTF-8 encoding

### AI-Powered Capabilities
- **Gemini AI Assistant**: Intelligent CSV validation and error detection
- **Auto-Correction Suggestions**: AI-powered recommendations for fixing data issues
- **Conversational Feedback**: Natural language explanations of validation errors

### Intelligent Agents
- **New Features Agent**: Autonomous product improvement recommendations
  - Opportunity detection from usage analytics
  - Feature proposal generation with RICE prioritization
  - User story and rollout planning

- **Bug Review Agent**: Automated bug triage system
  - Severity classification (P0-P4)
  - Root cause hypothesis generation
  - Owner/team suggestions
  - Patch recommendations for high-confidence fixes

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Frontend**: Electron + React
- **OCR**: Tesseract.js
- **PDF Processing**: pdf-parse, pdf2pic
- **AI Integration**: Google Gemini API
- **Build Tools**: Vite, TypeScript Compiler
- **Logging**: Winston

## Installation

```bash
# Clone the repository
git clone https://github.com/Podnation93/Bulk_invoice.git
cd Bulk_invoice

# Install dependencies
npm install
```

## Usage

### Development
```bash
# Start in development mode
npm run dev

# Start frontend only
npm run dev:renderer

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

### Production
```bash
# Build the application
npm run build

# Package for distribution
npm run package

# Start the built application
npm start
```

### Testing
```bash
# Run all tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# Watch mode
npm run test:watch
```

## Project Structure

```
src/
├── main/                    # Electron main process
│   ├── index.ts            # Main entry point
│   └── preload.ts          # Secure context bridge
├── renderer/               # React frontend
│   ├── App.tsx            # Main application component
│   ├── main.tsx           # React entry point
│   └── styles/            # CSS styles
├── modules/               # Core business logic
│   ├── pdf-processor/     # PDF file handling
│   ├── ocr/               # Text extraction engine
│   ├── parser/            # Invoice field extraction
│   ├── validation/        # Data validation layer
│   ├── formatter/         # Xero CSV formatting
│   ├── export/            # CSV file generation
│   ├── ai-assistant/      # Gemini AI integration
│   ├── new-features-agent/ # Product improvement agent
│   └── bug-review-agent/  # Bug triage automation
└── shared/                # Shared utilities
    ├── types/             # TypeScript interfaces
    ├── constants/         # Application constants
    └── utils/             # Logging and error handling
```

## Xero CSV Format

The application generates CSV files with the following exact headers:
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

## Data Flow

```
PDF Files → PDF Processor → OCR Engine → Parser Engine → Validation → CSV Export
```

## Key Features

### Australian Date Format
All dates are automatically normalized to DD/MM/YYYY format as required by Xero for Australian businesses.

### Local Processing
All PDF processing occurs locally on your machine. No data is sent to external servers unless you explicitly enable cloud features.

### Batch Processing
Process up to 200+ PDF invoices in a single batch with real-time progress tracking.

### Data Privacy
PDF data is not persisted after export. Only the generated CSV file is saved.

## Configuration

### Environment Variables
```env
# Optional: Gemini API configuration
GEMINI_CLIENT_ID=your_client_id
GEMINI_CLIENT_SECRET=your_client_secret
```

### Logging
Logs are stored in the `logs/` directory:
- `app.log` - General application logs
- `error.log` - Error-specific logs

## License

MIT License

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Support

For issues and feature requests, please use the [GitHub Issues](https://github.com/Podnation93/Bulk_invoice/issues) page.
