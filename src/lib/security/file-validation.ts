//src/lib/security/file-validation.ts

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
];

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'File type not allowed. Only JPEG, PNG, WebP, and PDF are accepted.',
    };
  }
  
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: 'File too large. Maximum size is 5MB.',
    };
  }
  
  // Check file extension matches MIME type
  const ext = file.name.split('.').pop()?.toLowerCase();
  const mimeToExt: Record<string, string[]> = {
    'image/jpeg': ['jpg', 'jpeg'],
    'image/png': ['png'],
    'image/webp': ['webp'],
    'application/pdf': ['pdf'],
  };
  
  const expectedExts = mimeToExt[file.type];
  if (!expectedExts || !ext || !expectedExts.includes(ext)) {
    return {
      valid: false,
      error: 'File extension does not match file type.',
    };
  }
  
  return { valid: true };
}