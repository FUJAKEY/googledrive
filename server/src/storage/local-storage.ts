import fs from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config.js';
import type { StorageProvider, SaveFileOptions } from './storage-provider.js';

export class LocalStorageProvider implements StorageProvider {
  constructor(private readonly rootDir = config.storageRoot) {}

  async init(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true });
  }

  async saveFile(options: SaveFileOptions): Promise<{ key: string; size: number }> {
    const filePath = path.join(this.rootDir, options.key);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, options.buffer);
    return { key: options.key, size: options.buffer.length };
  }

  async deleteFile(key: string): Promise<void> {
    const filePath = path.join(this.rootDir, key);
    await fs.promises.rm(filePath, { force: true });
  }

  async getFileStream(key: string) {
    const filePath = path.join(this.rootDir, key);
    return fs.createReadStream(filePath);
  }

  getFilePath(key: string) {
    return path.join(this.rootDir, key);
  }
}
