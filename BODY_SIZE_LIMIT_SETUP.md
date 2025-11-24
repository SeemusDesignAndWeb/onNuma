# Body Size Limit Configuration

## Issue
SvelteKit has a default body size limit of 512KB (524288 bytes) for request bodies. This causes errors when uploading large audio files (e.g., 43MB MP3 files).

## Solution
SvelteKit respects the `BODY_SIZE_LIMIT` environment variable to configure the maximum request body size.

## Configuration

### Railway (Production)

1. Go to your Railway project dashboard
2. Select your service
3. Go to the "Variables" tab
4. Add a new environment variable:
   - **Name**: `BODY_SIZE_LIMIT`
   - **Value**: `150M` (or `150MB` - supports K, M, G suffixes)
5. Redeploy your service

### Local Development

Add to your `.env` file:
```
BODY_SIZE_LIMIT=150M
```

## Supported Formats

The `BODY_SIZE_LIMIT` value can be specified as:
- Bytes: `157286400` (150MB in bytes)
- Kilobytes: `153600K` (150MB in KB)
- Megabytes: `150M` (recommended)
- Gigabytes: `0.15G`

## Default
If not set, SvelteKit defaults to `512K` (524288 bytes).

## Testing

After setting the environment variable and redeploying:
1. Try uploading a large audio file (e.g., 43MB MP3)
2. The upload should succeed without the "Content-length exceeds limit" error

