import type { ReadStream } from 'node:fs';

export interface SaveFileOptions {
  buffer: Buffer;
  key: string;
}

export interface StorageProvider {
  init(): Promise<void>;
  saveFile(options: SaveFileOptions): Promise<{ key: string; size: number }>;
  deleteFile(key: string): Promise<void>;
  getFileStream(key: string): Promise<ReadStream>;
  getFilePath(key: string): string;
}
