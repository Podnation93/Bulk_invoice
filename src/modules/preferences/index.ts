import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface UserPreferences {
  // OCR Settings
  ocrConfidenceThreshold: number;
  ocrLanguage: string;

  // Default Values
  defaultAccountCode: string;
  defaultTaxType: string;

  // Export Settings
  includeHeadersInCSV: boolean;
  autoOpenAfterExport: boolean;
  defaultExportPath: string;

  // Processing Settings
  autoRemoveDuplicates: boolean;
  showLowConfidenceWarnings: boolean;

  // UI Settings
  previewRowLimit: number;
  showFieldTooltips: boolean;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  ocrConfidenceThreshold: 60,
  ocrLanguage: 'eng',
  defaultAccountCode: '200',
  defaultTaxType: 'GST on Income',
  includeHeadersInCSV: true,
  autoOpenAfterExport: false,
  defaultExportPath: '',
  autoRemoveDuplicates: false,
  showLowConfidenceWarnings: true,
  previewRowLimit: 100,
  showFieldTooltips: true,
};

export class PreferencesManager {
  private preferences: UserPreferences;
  private filePath: string;

  constructor() {
    // Store preferences in user data directory
    const userDataPath = app?.getPath?.('userData') || process.cwd();
    this.filePath = path.join(userDataPath, 'preferences.json');
    this.preferences = this.loadPreferences();
  }

  /**
   * Load preferences from disk
   */
  private loadPreferences(): UserPreferences {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, 'utf-8');
        const loaded = JSON.parse(data);
        // Merge with defaults to ensure all fields exist
        return { ...DEFAULT_PREFERENCES, ...loaded };
      }
    } catch (error) {
      console.error('Failed to load preferences:', error);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  /**
   * Save preferences to disk
   */
  private savePreferences(): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(this.preferences, null, 2), 'utf-8');
    } catch (error) {
      console.error('Failed to save preferences:', error);
    }
  }

  /**
   * Get all preferences
   */
  getAll(): UserPreferences {
    return { ...this.preferences };
  }

  /**
   * Get a specific preference
   */
  get<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
    return this.preferences[key];
  }

  /**
   * Set a specific preference
   */
  set<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
    this.preferences[key] = value;
    this.savePreferences();
  }

  /**
   * Update multiple preferences at once
   */
  update(updates: Partial<UserPreferences>): void {
    this.preferences = { ...this.preferences, ...updates };
    this.savePreferences();
  }

  /**
   * Reset all preferences to defaults
   */
  resetToDefaults(): void {
    this.preferences = { ...DEFAULT_PREFERENCES };
    this.savePreferences();
  }

  /**
   * Reset a specific preference to default
   */
  resetToDefault<K extends keyof UserPreferences>(key: K): void {
    this.preferences[key] = DEFAULT_PREFERENCES[key];
    this.savePreferences();
  }

  /**
   * Get default preferences (for comparison)
   */
  getDefaults(): UserPreferences {
    return { ...DEFAULT_PREFERENCES };
  }

  /**
   * Export preferences as JSON string
   */
  exportAsJSON(): string {
    return JSON.stringify(this.preferences, null, 2);
  }

  /**
   * Import preferences from JSON string
   */
  importFromJSON(json: string): boolean {
    try {
      const imported = JSON.parse(json);
      // Validate structure
      const validated: UserPreferences = { ...DEFAULT_PREFERENCES };
      for (const key of Object.keys(DEFAULT_PREFERENCES) as Array<keyof UserPreferences>) {
        if (key in imported && typeof imported[key] === typeof DEFAULT_PREFERENCES[key]) {
          (validated as unknown as Record<string, unknown>)[key] = imported[key];
        }
      }
      this.preferences = validated;
      this.savePreferences();
      return true;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      return false;
    }
  }
}

export default PreferencesManager;
