# Github Action for Uploading Files to Qiniu

This is a action for uploading files to [Qiniu](https://qiniu.com).

This action uses the [qiniu nodejs sdk](https://github.com/qiniu/nodejs-sdk) to upload a directory (either from your repository or generated during your workflow) to a cloud bucket.


## Usage
```yaml
name: Upload Website

on:
  push:
    branches:
    - master

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@master
    - uses: hujiulong/action-qiniu-upload@master
      with:
        # Your qiniu access key, required.
        access_key: ${{ secrets.QINIU_ACCESS_KEY }}

        # Your qiniu secret key, required.
        secret_key: ${{ secrets.QINIU_SECRET_KEY }}

        # Bucket name, required.
        bucket: ${{ secrets.QINIU_BUCKET }}

        # The local directory (or file) you want to upload to bucket.
        # Default: './'
        source_dir: 'dist'

        # The directory inside of the bucket you want to upload to, namely key prefix prepended to dest file key.
        # Default: '/'
        dest_dir: '/static'

        # Overwrite strategy for existing files
        # 'smart' (default): overwrites code files (.html, .js, .css, etc.) but skips media files (.jpg, .png, .mp4, etc.)
        # 'always': always overwrite existing files
        # 'never': never overwrite, skip existing files
        overwrite: 'smart'

        # Custom patterns for files to always overwrite (comma-separated)
        # Example: '*.min.js,build/*,dist/*.css'
        overwrite_patterns: ''

        # Custom patterns for files to always skip (comma-separated)
        # Example: '*.log,temp/*'
        skip_patterns: ''

        # Whether to ignore source maps.
        # Default: true
        ignore_source_map: true

        # Support concurrency
        # Default: 5
        concurrency: 5
```

## Smart Overwrite Strategy

The action supports intelligent file handling with three overwrite strategies:

### `smart` (Default)
Automatically decides whether to overwrite based on file type:
- **Always overwrites**: Code files (`.html`, `.js`, `.css`, `.json`, etc.), docs (`.md`, `.txt`), config files
- **Always skips**: Media files (`.jpg`, `.png`, `.mp4`, `.mp3`, etc.), fonts (`.woff`, `.ttf`), archives (`.zip`, `.tar`)
- **Conservative**: Unknown file types are not overwritten by default

### `always` 
Always overwrites existing files in the bucket.

### `never`
Never overwrites existing files, skips them silently.

### Custom Patterns
Use `overwrite_patterns` and `skip_patterns` to override the default behavior with glob patterns:

```yaml
# Always overwrite these files regardless of strategy
overwrite_patterns: '*.min.js,build/*,dist/*.css'

# Never overwrite these files regardless of strategy  
skip_patterns: '*.log,temp/*,backup/**'
```

## License

[MIT license](LICENSE).
