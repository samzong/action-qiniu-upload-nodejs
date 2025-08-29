import * as core from '@actions/core';
import { upload } from './upload';

async function run(): Promise<void> {
  try {
    const ak = core.getInput('access_key');
    const sk = core.getInput('secret_key');
    const bucket = core.getInput('bucket');
    const sourceDir = core.getInput('source_dir');
    const destDir = core.getInput('dest_dir');
    const overwrite = (core.getInput('overwrite') || 'smart') as 'always' | 'never' | 'smart';
    const overwritePatterns = core.getInput('overwrite_patterns');
    const skipPatterns = core.getInput('skip_patterns');
    const ignoreSourceMap = core.getInput('ignore_source_map') === 'true';
    const concurrency = parseInt(core.getInput('concurrency') || '5', 10);

    upload(
      bucket,
      ak,
      sk,
      sourceDir,
      destDir,
      {
        overwrite,
        overwritePatterns,
        skipPatterns,
        ignoreSourceMap,
        concurrency,
      },
      (file, key, action) => {
        let actionEmoji = '✅';
        let actionText = 'Uploaded';

        if (action === 'updated') {
          actionEmoji = '🔄';
          actionText = 'Updated';
        } else if (action === 'skipped') {
          actionEmoji = '⏭️';
          actionText = 'Skipped (exists)';
        }

        core.info(`${actionEmoji} ${actionText}: ${file} => [${bucket}]: ${key}`);
      },
      (stats) => {
        core.info('Upload Summary:');
        core.info(`📤 New files: ${stats.uploaded}`);
        core.info(`🔄 Updated files: ${stats.updated}`);
        core.info(`⏭️ Skipped files: ${stats.skipped}`);
        if (stats.failed > 0) {
          core.info(`❌ Failed: ${stats.failed}`);
        }
        core.info('Done!');
      },
      (error) => core.setFailed(error.message),
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    core.setFailed(errorMessage);
  }
}

run();
