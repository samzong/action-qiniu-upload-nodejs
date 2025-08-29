import qiniu from 'qiniu';

export function genToken(
  bucket: string,
  ak: string,
  sk: string,
  fileKey?: string,
  allowOverwrite = false,
): string {
  const mac = new qiniu.auth.digest.Mac(ak, sk);

  let scope = bucket;
  if (allowOverwrite && fileKey) {
    // Use "bucket:key" format to allow overwriting specific file
    scope = `${bucket}:${fileKey}`;
  }

  const putPolicy = new qiniu.rs.PutPolicy({
    scope,
  });
  const token = putPolicy.uploadToken(mac);
  return token;
}
