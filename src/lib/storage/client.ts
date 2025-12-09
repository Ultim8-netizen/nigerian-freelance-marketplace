// src/lib/storage/client.ts
// Persistent storage API implementation for artifacts

interface StorageResult {
  key: string;
  value: string;
  shared: boolean;
}

interface ListResult {
  keys: string[];
  prefix?: string;
  shared: boolean;
}

class StorageAPI {
  private readonly maxKeyLength = 200;
  private readonly maxValueSize = 5 * 1024 * 1024; // 5MB
  private readonly baseUrl = '/api/storage';

  /**
   * Validate key format
   */
  private validateKey(key: string): void {
    if (!key || key.trim().length === 0) {
      throw new Error('Storage key cannot be empty');
    }

    if (key.length > this.maxKeyLength) {
      throw new Error(`Storage key exceeds ${this.maxKeyLength} characters`);
    }

    // Check for invalid characters
    if (/[\s\/\\'"]/.test(key)) {
      throw new Error('Storage key cannot contain whitespace, slashes, or quotes');
    }
  }

  /**
   * Validate value size
   */
  private validateValue(value: string): void {
    const size = new Blob([value]).size;
    if (size > this.maxValueSize) {
      throw new Error(`Storage value exceeds ${this.maxValueSize / (1024 * 1024)}MB limit`);
    }
  }

  /**
   * Get a value from storage
   */
  async get(key: string, shared: boolean = false): Promise<StorageResult | null> {
    try {
      this.validateKey(key);

      const response = await fetch(`${this.baseUrl}/get`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, shared }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Key "${key}" not found`);
        }
        throw new Error(`Storage get failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Storage get error:', error);
      throw error;
    }
  }

  /**
   * Set a value in storage
   */
  async set(
    key: string, 
    value: string, 
    shared: boolean = false
  ): Promise<StorageResult | null> {
    try {
      this.validateKey(key);
      this.validateValue(value);

      const response = await fetch(`${this.baseUrl}/set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value, shared }),
      });

      if (!response.ok) {
        throw new Error(`Storage set failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Storage set error:', error);
      throw error;
    }
  }

  /**
   * Delete a key from storage
   */
  async delete(key: string, shared: boolean = false): Promise<{ key: string; deleted: boolean; shared: boolean } | null> {
    try {
      this.validateKey(key);

      const response = await fetch(`${this.baseUrl}/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, shared }),
      });

      if (!response.ok) {
        throw new Error(`Storage delete failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Storage delete error:', error);
      throw error;
    }
  }

  /**
   * List keys with optional prefix
   */
  async list(prefix?: string, shared: boolean = false): Promise<ListResult | null> {
    try {
      if (prefix) {
        this.validateKey(prefix);
      }

      const response = await fetch(`${this.baseUrl}/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prefix, shared }),
      });

      if (!response.ok) {
        throw new Error(`Storage list failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Storage list error:', error);
      throw error;
    }
  }
}

// Initialize and attach to window
if (typeof window !== 'undefined') {
  (window as any).storage = new StorageAPI();
}

export const storage = typeof window !== 'undefined' ? (window as any).storage : null;