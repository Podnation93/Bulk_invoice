import { BrowserWindow } from 'electron';
import Store from 'electron-store';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  tokenType: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
}

// Note: In production, these would be configured via environment variables
const DEFAULT_CONFIG: OAuthConfig = {
  clientId: process.env.GEMINI_CLIENT_ID || '',
  clientSecret: process.env.GEMINI_CLIENT_SECRET || '',
  redirectUri: 'http://localhost:3001/oauth/callback',
  scopes: ['https://www.googleapis.com/auth/generative-language'],
};

export class GeminiOAuthManager {
  private config: OAuthConfig;
  private store: Store;
  private tokens: OAuthTokens | null = null;

  constructor(config: Partial<OAuthConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.store = new Store({
      name: 'gemini-auth',
      encryptionKey: 'bulk-invoice-extractor-key', // In production, use a secure key
    });

    // Load existing tokens
    this.loadTokens();
  }

  /**
   * Load tokens from secure storage
   */
  private loadTokens(): void {
    const stored = this.store.get('tokens') as OAuthTokens | undefined;
    if (stored && stored.expiresAt > Date.now()) {
      this.tokens = stored;
    }
  }

  /**
   * Save tokens to secure storage
   */
  private saveTokens(tokens: OAuthTokens): void {
    this.tokens = tokens;
    this.store.set('tokens', tokens);
  }

  /**
   * Clear stored tokens
   */
  clearTokens(): void {
    this.tokens = null;
    this.store.delete('tokens');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.tokens !== null && this.tokens.expiresAt > Date.now();
  }

  /**
   * Get current access token
   */
  getAccessToken(): string | null {
    if (this.isAuthenticated() && this.tokens) {
      return this.tokens.accessToken;
    }
    return null;
  }

  /**
   * Initiate OAuth login flow
   * Opens a browser window for Google OAuth consent
   */
  async login(): Promise<OAuthTokens> {
    return new Promise((resolve, reject) => {
      if (!this.config.clientId) {
        reject(new Error('OAuth client ID not configured'));
        return;
      }

      const authUrl = this.buildAuthUrl();

      const authWindow = new BrowserWindow({
        width: 600,
        height: 700,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
        },
      });

      authWindow.loadURL(authUrl);

      // Listen for the redirect with auth code
      authWindow.webContents.on('will-redirect', async (_event, url) => {
        const urlObj = new URL(url);

        if (urlObj.origin === new URL(this.config.redirectUri).origin) {
          const code = urlObj.searchParams.get('code');
          const error = urlObj.searchParams.get('error');

          if (error) {
            authWindow.close();
            reject(new Error(`OAuth error: ${error}`));
            return;
          }

          if (code) {
            try {
              const tokens = await this.exchangeCodeForTokens(code);
              this.saveTokens(tokens);
              authWindow.close();
              resolve(tokens);
            } catch (err) {
              authWindow.close();
              reject(err);
            }
          }
        }
      });

      authWindow.on('closed', () => {
        if (!this.isAuthenticated()) {
          reject(new Error('Authentication window closed'));
        }
      });
    });
  }

  /**
   * Build the OAuth authorization URL
   */
  private buildAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: 'code',
      scope: this.config.scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent',
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  /**
   * Exchange authorization code for tokens
   */
  private async exchangeCodeForTokens(code: string): Promise<OAuthTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token exchange failed: ${error}`);
    }

    const data = await response.json();

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
    };
  }

  /**
   * Refresh the access token using the refresh token
   */
  async refreshAccessToken(): Promise<OAuthTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        refresh_token: this.tokens.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Token refresh failed: ${error}`);
    }

    const data = await response.json();

    const newTokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: this.tokens.refreshToken, // Keep existing refresh token
      expiresAt: Date.now() + data.expires_in * 1000,
      tokenType: data.token_type,
    };

    this.saveTokens(newTokens);
    return newTokens;
  }

  /**
   * Ensure we have a valid access token, refreshing if necessary
   */
  async ensureValidToken(): Promise<string> {
    if (!this.tokens) {
      throw new Error('Not authenticated');
    }

    // Refresh if token expires in less than 5 minutes
    if (this.tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }

    return this.tokens.accessToken;
  }

  /**
   * Logout and clear all stored tokens
   */
  logout(): void {
    this.clearTokens();
  }

  /**
   * Get token expiration status
   */
  getTokenStatus(): {
    isValid: boolean;
    expiresIn?: number;
    hasRefreshToken: boolean;
  } {
    if (!this.tokens) {
      return {
        isValid: false,
        hasRefreshToken: false,
      };
    }

    const expiresIn = Math.max(0, this.tokens.expiresAt - Date.now());

    return {
      isValid: expiresIn > 0,
      expiresIn: Math.floor(expiresIn / 1000),
      hasRefreshToken: !!this.tokens.refreshToken,
    };
  }
}

export default GeminiOAuthManager;
