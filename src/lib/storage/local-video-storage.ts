// src/lib/storage/local-video-storage.ts
// IndexedDB-based video storage for liveness verification

interface LivenessVideo {
  id: string;
  userId: string;
  videoBlob: Blob;
  challenges: string[];
  timestamp: number;
  expiresAt: number;
  verified: boolean;
}

const DB_NAME = 'f9_liveness_db';
const STORE_NAME = 'liveness_videos';
const DB_VERSION = 1;
const VIDEO_EXPIRY_DAYS = 90; // Keep for 90 days

class LocalVideoStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('userId', 'userId', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }
      };
    });
  }

  async saveVideo(
    userId: string,
    videoBlob: Blob,
    challenges: string[]
  ): Promise<string> {
    await this.init();
    
    const id = `liveness_${userId}_${Date.now()}`;
    const timestamp = Date.now();
    const expiresAt = timestamp + (VIDEO_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const video: LivenessVideo = {
      id,
      userId,
      videoBlob,
      challenges,
      timestamp,
      expiresAt,
      verified: false,
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(video);

      request.onsuccess = () => resolve(id);
      request.onerror = () => reject(request.error);
    });
  }

  async getVideo(id: string): Promise<LivenessVideo | null> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getUserVideos(userId: string): Promise<LivenessVideo[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('userId');
      const request = index.getAll(userId);

      request.onsuccess = () => {
        const videos = request.result || [];
        // Filter expired videos
        const validVideos = videos.filter(v => v.expiresAt > Date.now());
        resolve(validVideos);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async markAsVerified(id: string): Promise<void> {
    await this.init();

    return new Promise(async (resolve, reject) => {
      const video = await this.getVideo(id);
      if (!video) {
        reject(new Error('Video not found'));
        return;
      }

      video.verified = true;

      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(video);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteVideo(id: string): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async cleanupExpired(): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('expiresAt');
      const now = Date.now();
      
      const request = index.openCursor();
      let deletedCount = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        
        if (cursor) {
          if (cursor.value.expiresAt < now) {
            cursor.delete();
            deletedCount++;
          }
          cursor.continue();
        } else {
          resolve(deletedCount);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async getStorageSize(): Promise<{ videos: number; totalSize: number }> {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const videos = request.result || [];
        const totalSize = videos.reduce((sum, v) => sum + v.videoBlob.size, 0);
        resolve({
          videos: videos.length,
          totalSize,
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  async exportVideoForUpload(id: string): Promise<Blob | null> {
    const video = await this.getVideo(id);
    return video ? video.videoBlob : null;
  }
}

export const localVideoStorage = new LocalVideoStorage();

// Helper to format storage size
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// Auto-cleanup on app load
if (typeof window !== 'undefined') {
  localVideoStorage.cleanupExpired().catch(console.error);
}