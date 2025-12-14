import crypto from 'crypto';

// NOTE: Ensure ENCRYPTION_KEY is a 32-byte (256-bit) key, typically stored as a hex string in environment variables.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a plain text string using AES-256-GCM.
 * The output format is: IV:AuthTag:EncryptedText (all in hex).
 *
 * @param text The plain text string to encrypt.
 * @returns The encrypted string with IV and AuthTag concatenated.
 */
export function encrypt(text: string): string {
  // Initialization Vector (IV) for uniqueness
  const iv = crypto.randomBytes(16);
  // Key must be converted from hex string to Buffer
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Authentication Tag ensures data integrity
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a string that was encrypted using the 'encrypt' function.
 *
 * @param encrypted The encrypted string (format: IV:AuthTag:EncryptedText).
 * @returns The original plain text string.
 */
export function decrypt(encrypted: string): string {
  const [ivHex, authTagHex, encryptedText] = encrypted.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Usage Example (Commented out to prevent errors caused by undefined variables):
/*
const sensitiveData = '1234567890'; // Example sensitive string
const encryptedData = encrypt(sensitiveData);
console.log('Encrypted:', encryptedData);

const decryptedData = decrypt(encryptedData);
console.log('Decrypted:', decryptedData);

// Use case:
// const encryptedAccountNumber = encrypt(accountNumber);
// Store encrypted version in database (e.g., in a secure field)
*/