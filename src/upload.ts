import qiniu from 'qiniu';
import path from 'path';
import { globSync } from 'glob';
import pAll from 'p-all';
import pRetry from 'p-retry';

function normalizePath(input: string): string {
  return input.replace(/^\//, '');
}

type UploadResult = {
  ok: boolean;
  file: string;
  to?: string;
  error?: Error;
  statusCode?: number;
};

export function upload(
  token: string,
  srcDir: string,
  destDir: string,
  ignoreSourceMap: boolean,
  concurrency: number,
  onProgress: (srcFile: string, destFile: string) => void,
  onComplete: () => void,
  onFail: (errorInfo: any) => void,
): void {
  const baseDir = path.resolve(process.cwd(), srcDir);
  const files = globSync(`${baseDir}/**/*`, { nodir: true });

  const config = new qiniu.conf.Config();
  const uploader = new qiniu.form_up.FormUploader(config);

  const tasks = files.map((file: string) => {
    const relativePath = path.relative(baseDir, path.dirname(file));
    const key = normalizePath(path.join(destDir, relativePath, path.basename(file)));

    if (ignoreSourceMap && file.endsWith('.map')) return null;

    const task = (): Promise<UploadResult> => new Promise((resolve, reject) => {
      const putExtra = new qiniu.form_up.PutExtra();
      uploader.putFile(token, key, file, putExtra, (err, body, info) => {
        if (err) return reject(new Error(`Upload failed: ${file}`));

        const code = info?.statusCode;
        // Treat 200 OK and 614 (file exists) as success
        if (code === 200 || code === 614) {
          onProgress(file, key);
          return resolve({ ok: true, file, to: key, statusCode: code });
        }

        reject(new Error(`Upload failed: ${file} (status: ${code})`));
      });
    });

    // Wrap with retry and convert rejection to a resolved failure result
    return () => pRetry(task, { retries: 3 }).then(
      (res) => ({ ok: true, file: res.file, to: res.to, statusCode: res.statusCode } as UploadResult),
      (error: Error) => ({ ok: false, file, error } as UploadResult),
    );
  }).filter((item: any) => !!item) as (() => Promise<any>)[];

  pAll(tasks, { concurrency })
    .then((results: UploadResult[]) => {
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        const sample = failed.slice(0, 5).map((f) => f.file).join(', ');
        const message = `Failed to upload ${failed.length} file(s). Examples: ${sample}`;
        onFail(new Error(message));
        return;
      }
      onComplete();
    })
    .catch(onFail);
}
