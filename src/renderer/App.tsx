import React, { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { ExtractedInvoice, XeroCSVRow, ValidationResult } from '../shared/types';

type WorkflowStep = 'upload' | 'processing' | 'review' | 'export' | 'complete';

interface FileStatus {
  name: string;
  path: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  error?: string;
}

const App: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [files, setFiles] = useState<FileStatus[]>([]);
  const [invoices, setInvoices] = useState<ExtractedInvoice[]>([]);
  const [csvRows, setCsvRows] = useState<XeroCSVRow[]>([]);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exportResult, setExportResult] = useState<string | null>(null);

  const onDrop = (acceptedFiles: File[]): void => {
    const pdfFiles = acceptedFiles.filter((f) => f.name.endsWith('.pdf'));
    const newFiles: FileStatus[] = pdfFiles.map((f) => ({
      name: f.name,
      path: (f as unknown as { path: string }).path,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
  });

  const handleSelectFiles = async (): Promise<void> => {
    const filePaths = await window.electronAPI.selectPDFFiles();
    const newFiles: FileStatus[] = filePaths.map((path) => ({
      name: path.split(/[/\\]/).pop() || path,
      path,
      status: 'pending',
    }));
    setFiles((prev) => [...prev, ...newFiles]);
  };

  const handleProcessPDFs = async (): Promise<void> => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setCurrentStep('processing');

    // Update all files to processing status
    setFiles((prev) => prev.map((f) => ({ ...f, status: 'processing' })));

    const filePaths = files.map((f) => f.path);
    const result = await window.electronAPI.processPDFs(filePaths);

    // Update file statuses based on results
    const updatedFiles = files.map((file) => {
      const error = result.errors.find((e) => e.file === file.name);
      if (error) {
        return { ...file, status: 'error' as const, error: error.error };
      }
      const invoice = result.invoices.find((inv) => inv.sourceFile === file.name);
      if (invoice) {
        return { ...file, status: 'success' as const };
      }
      return { ...file, status: 'error' as const, error: 'No data extracted' };
    });

    setFiles(updatedFiles);
    setInvoices(result.invoices);

    // Validate extracted invoices
    const validation = await window.electronAPI.validateInvoices(result.invoices);
    setValidationResult(validation);

    // Format to CSV rows
    const rows = await window.electronAPI.formatToCSVRows(result.invoices);
    setCsvRows(rows);

    setIsProcessing(false);
    setCurrentStep('review');
  };

  const handleExport = async (): Promise<void> => {
    const result = await window.electronAPI.exportCSV(csvRows);
    if (result.success) {
      setExportResult(
        `Successfully exported ${result.rowCount} rows to ${result.filePath}`
      );
      setCurrentStep('complete');
    } else {
      setExportResult(`Export failed: ${result.error}`);
    }
  };

  const handleReset = (): void => {
    setFiles([]);
    setInvoices([]);
    setCsvRows([]);
    setValidationResult(null);
    setExportResult(null);
    setCurrentStep('upload');
  };

  const updateCSVCell = (
    rowIndex: number,
    field: keyof XeroCSVRow,
    value: string
  ): void => {
    const updatedRows = [...csvRows];
    updatedRows[rowIndex] = { ...updatedRows[rowIndex], [field]: value };
    setCsvRows(updatedRows);
  };

  const renderStepIndicator = (): React.ReactElement => (
    <div className="workflow-steps">
      {['upload', 'processing', 'review', 'export', 'complete'].map((step, index) => {
        const stepNames = ['Upload PDFs', 'Processing', 'Review Data', 'Export', 'Complete'];
        const isActive = step === currentStep;
        const isCompleted =
          ['upload', 'processing', 'review', 'export', 'complete'].indexOf(currentStep) >
          index;

        return (
          <div
            key={step}
            className={`step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
          >
            <div className="step-number">{isCompleted ? '✓' : index + 1}</div>
            <div>{stepNames[index]}</div>
          </div>
        );
      })}
    </div>
  );

  const renderUploadStep = (): React.ReactElement => (
    <div>
      <div
        {...getRootProps()}
        className={`dropzone ${isDragActive ? 'active' : ''}`}
      >
        <input {...getInputProps()} />
        <h3>Drag & Drop PDF Invoices Here</h3>
        <p>or click to select files</p>
      </div>

      <div className="actions">
        <button className="btn btn-primary" onClick={handleSelectFiles}>
          Select Files
        </button>
      </div>

      {files.length > 0 && (
        <div className="file-list">
          <h4>Selected Files ({files.length})</h4>
          {files.map((file, index) => (
            <div key={index} className="file-item">
              <span className="filename">{file.name}</span>
              <span className={`status ${file.status}`}>{file.status}</span>
            </div>
          ))}

          <div className="actions">
            <button
              className="btn btn-success"
              onClick={handleProcessPDFs}
              disabled={isProcessing}
            >
              Process PDFs
            </button>
            <button className="btn btn-danger" onClick={handleReset}>
              Clear All
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderProcessingStep = (): React.ReactElement => (
    <div className="loading">
      <div className="spinner"></div>
      <h3>Processing PDFs...</h3>
      <p>Extracting invoice data using OCR and parsing</p>
    </div>
  );

  const renderReviewStep = (): React.ReactElement => (
    <div>
      <div className="stats">
        <div className="stat-card">
          <div className="stat-value">{invoices.length}</div>
          <div className="stat-label">Invoices Extracted</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{csvRows.length}</div>
          <div className="stat-label">CSV Rows</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{validationResult?.errors.length || 0}</div>
          <div className="stat-label">Errors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{validationResult?.warnings.length || 0}</div>
          <div className="stat-label">Warnings</div>
        </div>
      </div>

      {validationResult && (
        <div className="validation-results">
          {validationResult.errors.length > 0 && (
            <div className="validation-section">
              <h4>Errors (Must Fix)</h4>
              <ul className="error-list">
                {validationResult.errors.map((error, index) => (
                  <li key={index}>
                    [{error.field}] {error.message}
                    {error.invoiceNumber && ` (Invoice: ${error.invoiceNumber})`}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {validationResult.warnings.length > 0 && (
            <div className="validation-section">
              <h4>Warnings</h4>
              <ul className="warning-list">
                {validationResult.warnings.slice(0, 10).map((warning, index) => (
                  <li key={index}>
                    [{warning.field}] {warning.message}
                  </li>
                ))}
                {validationResult.warnings.length > 10 && (
                  <li>...and {validationResult.warnings.length - 10} more</li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      <h4>CSV Preview (click cells to edit)</h4>
      <div style={{ overflowX: 'auto' }}>
        <table className="preview-table">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Due Date</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Amount</th>
              <th>Account</th>
              <th>Tax</th>
              <th>Ref</th>
            </tr>
          </thead>
          <tbody>
            {csvRows.slice(0, 20).map((row, index) => (
              <tr key={index}>
                {Object.entries(row).map(([key, value]) => (
                  <td key={key} className="editable-cell">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        updateCSVCell(index, key as keyof XeroCSVRow, e.target.value)
                      }
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {csvRows.length > 20 && <p>Showing first 20 of {csvRows.length} rows</p>}

      <div className="actions">
        <button
          className="btn btn-success"
          onClick={handleExport}
          disabled={validationResult?.errors.length !== 0}
        >
          Export to CSV
        </button>
        <button className="btn btn-primary" onClick={handleReset}>
          Start Over
        </button>
      </div>
    </div>
  );

  const renderCompleteStep = (): React.ReactElement => (
    <div>
      <div className="success-message">
        <h3>Export Complete!</h3>
        <p>{exportResult}</p>
      </div>
      <div className="actions" style={{ justifyContent: 'center', marginTop: '20px' }}>
        <button className="btn btn-primary" onClick={handleReset}>
          Process More Invoices
        </button>
      </div>
    </div>
  );

  const renderCurrentStep = (): React.ReactElement => {
    switch (currentStep) {
      case 'upload':
        return renderUploadStep();
      case 'processing':
        return renderProcessingStep();
      case 'review':
      case 'export':
        return renderReviewStep();
      case 'complete':
        return renderCompleteStep();
      default:
        return renderUploadStep();
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Bulk Invoice Extractor</h1>
        <p>Extract invoice data from PDFs and export to Xero-compatible CSV</p>
      </header>

      {renderStepIndicator()}

      <main className="main-content">{renderCurrentStep()}</main>
    </div>
  );
};

export default App;
