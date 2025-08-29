import path from 'path';
import { minimatch } from 'minimatch';

export type OverwriteMode = 'always' | 'never' | 'smart';
export type FileAction = 'uploaded' | 'updated' | 'skipped';

export interface UploadOptions {
  overwrite: OverwriteMode;
  overwritePatterns?: string;
  skipPatterns?: string;
  ignoreSourceMap: boolean;
  concurrency: number;
}

export interface UploadStats {
  uploaded: number;
  updated: number;
  skipped: number;
  failed: number;
}

const DEFAULT_OVERWRITE_EXTENSIONS = [
  // Web files
  '.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx',
  // Data files
  '.json', '.xml', '.yaml', '.yml',
  // Documents
  '.md', '.txt', '.rst',
  // Config files
  '.conf', '.config', '.ini', '.env',
  // Build outputs
  '.map', '.min.js', '.min.css',
];

const DEFAULT_SKIP_EXTENSIONS = [
  // Images
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.ico', '.bmp', '.tiff',
  // Videos
  '.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv',
  // Audio
  '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a',
  // Fonts
  '.woff', '.woff2', '.ttf', '.otf', '.eot',
  // Archives
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  // Binary files
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
];

export class FileStrategyManager {
  private overwritePatterns: string[];

  private skipPatterns: string[];

  constructor(private options: UploadOptions) {
    this.overwritePatterns = FileStrategyManager.parsePatterns(options.overwritePatterns);
    this.skipPatterns = FileStrategyManager.parsePatterns(options.skipPatterns);
  }

  private static parsePatterns(patterns?: string): string[] {
    if (!patterns?.trim()) return [];
    return patterns.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  }

  shouldOverwrite(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();

    // Check custom patterns first
    if (this.overwritePatterns.length > 0) {
      if (this.overwritePatterns.some((pattern) => (
        minimatch(fileName, pattern) || minimatch(filePath, pattern)
      ))) {
        return true;
      }
    }

    if (this.skipPatterns.length > 0) {
      if (this.skipPatterns.some((pattern) => (
        minimatch(fileName, pattern) || minimatch(filePath, pattern)
      ))) {
        return false;
      }
    }

    // Apply global strategy
    switch (this.options.overwrite) {
      case 'always':
        return true;
      case 'never':
        return false;
      case 'smart':
      default:
        // Smart mode: overwrite code files, skip media files
        if (DEFAULT_OVERWRITE_EXTENSIONS.includes(ext)) return true;
        if (DEFAULT_SKIP_EXTENSIONS.includes(ext)) return false;

        // For unknown extensions, be conservative and don't overwrite
        return false;
    }
  }

  static getFileCategory(filePath: string): 'code' | 'media' | 'unknown' {
    const ext = path.extname(filePath).toLowerCase();

    if (DEFAULT_OVERWRITE_EXTENSIONS.includes(ext)) {
      return 'code';
    }

    if (DEFAULT_SKIP_EXTENSIONS.includes(ext)) {
      return 'media';
    }

    return 'unknown';
  }
}
