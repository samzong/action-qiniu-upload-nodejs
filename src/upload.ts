import qiniu from 'qiniu';
import path from 'path';
import { globSync } from 'glob';
import pAll from 'p-all';
import pRetry from 'p-retry';
import { genToken } from './token';
import {
  FileStrategyManager, UploadOptions, UploadStats, FileAction,
} from './fileStrategy';

function normalizePath(input: string): string {
  return input.replace(/^\//, '');
}

type UploadResult = {
  ok: boolean;
  file: string;
  to?: string;
  error?: Error;
  statusCode?: number;
  action: FileAction;
};

export function upload(
  bucket: string,
  ak: string,
  sk: string,
  srcDir: string,
  destDir: string,
  options: UploadOptions,
  onProgress: (srcFile: string, destFile: string, action: FileAction) => void,
  onComplete: (stats: UploadStats) => void,
  onFail: (errorInfo: any) => void,
): void {
  const baseDir = path.resolve(process.cwd(), srcDir);
  const files = globSync(`${baseDir}/**/*`, { nodir: true });

  const config = new qiniu.conf.Config();
  const uploader = new qiniu.form_up.FormUploader(config);
  const strategyManager = new FileStrategyManager(options);

  const tasks = files.map((file: string) => {
    const relativePath = path.relative(baseDir, path.dirname(file));
    const key = normalizePath(path.join(destDir, relativePath, path.basename(file)));

    // Skip source maps if requested
    if (options.ignoreSourceMap && file.endsWith('.map')) return null;

    const shouldOverwrite = strategyManager.shouldOverwrite(file);

    const task = (): Promise<UploadResult> => new Promise((resolve, reject) => {
      // Generate token based on overwrite strategy
      const token = genToken(bucket, ak, sk, key, shouldOverwrite);

      const putExtra = new qiniu.form_up.PutExtra();
      uploader.putFile(token, key, file, putExtra, (err, body, info) => {
        if (err) return reject(new Error(`Upload failed: ${file}`));

        const code = info?.statusCode;
        let action: FileAction;

        if (code === 200) {
          // File was uploaded (new or overwritten)
          action = shouldOverwrite ? 'updated' : 'uploaded';
        } else if (code === 614) {
          // File exists and was not overwritten
          action = 'skipped';
        } else {
          return reject(new Error(`Upload failed: ${file} (status: ${code})`));
        }

        onProgress(file, key, action);
        return resolve({
          ok: true, file, to: key, statusCode: code, action,
        });
      });
    });

    // Wrap with retry and convert rejection to a resolved failure result
    return () => pRetry(task, { retries: 3 }).then(
      (res) => ({
        ok: true,
        file: res.file,
        to: res.to,
        statusCode: res.statusCode,
        action: res.action,
      } as UploadResult),
      (error: Error) => ({
        ok: false,
        file,
        error,
        action: 'skipped' as FileAction,
      } as UploadResult),
    );
  }).filter((item: any) => !!item) as (() => Promise<any>)[];

  pAll(tasks, { concurrency: options.concurrency })
    .then((results: UploadResult[]) => {
      const failed = results.filter((r) => !r.ok);
      const successful = results.filter((r) => r.ok);

      const stats: UploadStats = {
        uploaded: successful.filter((r) => r.action === 'uploaded').length,
        updated: successful.filter((r) => r.action === 'updated').length,
        skipped: successful.filter((r) => r.action === 'skipped').length,
        failed: failed.length,
      };

      if (failed.length > 0) {
        const sample = failed.slice(0, 5).map((f) => f.file).join(', ');
        const message = `Failed to upload ${failed.length} file(s). Examples: ${sample}`;
        onFail(new Error(message));
        return;
      }

      onComplete(stats);
    })
    .catch(onFail);
}
