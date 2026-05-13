import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

/**
 * Compress image before uploading and return a cloud URL from MinIO.
 *
 * Supported configuration:
 * 1) `EXPO_PUBLIC_MINIO_UPLOAD_API`
 *    - POST multipart/form-data with field `file`
 *    - Optional bearer token via `EXPO_PUBLIC_MINIO_UPLOAD_TOKEN`
 *    - Expected response contains one of: `url`, `publicUrl`, `location`
 *
 * 2) `EXPO_PUBLIC_MINIO_PUT_BASE_URL` + `EXPO_PUBLIC_MINIO_PUBLIC_BASE_URL`
 *    - Upload by PUT to `${PUT_BASE_URL}/${objectKey}`
 *    - Read from `${PUBLIC_BASE_URL}/${objectKey}`
 *    - Optional bearer token via `EXPO_PUBLIC_MINIO_UPLOAD_TOKEN`
 */
export async function persistImageLocally(pickerUri: string): Promise<string> {
  if (!pickerUri) return '';

  if (pickerUri.startsWith('http://') || pickerUri.startsWith('https://')) {
    return pickerUri;
  }

  const compressed = await compressImage(pickerUri);
  const sourceUri = compressed.uri;
  const extension = extensionFromUri(sourceUri);
  const fileName = `muscle-${Date.now()}-${Math.random().toString(16).slice(2, 10)}.${extension}`;
  const contentType = mimeFromExt(extension);
  const blob = await uriToBlob(sourceUri);

  const uploadApi = process.env.EXPO_PUBLIC_MINIO_UPLOAD_API?.trim();
  const token = process.env.EXPO_PUBLIC_MINIO_UPLOAD_TOKEN?.trim();

  if (uploadApi) {
    const form = new FormData();
    if (typeof File !== 'undefined') {
      form.append('file', new File([blob], fileName, { type: contentType }));
    } else {
      form.append('file', {
        uri: sourceUri,
        name: fileName,
        type: contentType,
      } as unknown as Blob);
    }

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(uploadApi, {
      method: 'POST',
      headers,
      body: form,
    });

    if (!response.ok) {
      throw new Error(`MinIO upload API failed (${response.status})`);
    }

    const data = (await response.json()) as {
      url?: string;
      publicUrl?: string;
      location?: string;
    };
    const uploadedUrl = data.url ?? data.publicUrl ?? data.location;
    if (!uploadedUrl) {
      throw new Error('MinIO upload API response missing image URL');
    }
    return uploadedUrl;
  }

  const putBase = process.env.EXPO_PUBLIC_MINIO_PUT_BASE_URL?.trim();
  const publicBase = process.env.EXPO_PUBLIC_MINIO_PUBLIC_BASE_URL?.trim();

  if (!putBase || !publicBase) {
    throw new Error(
      'Missing MinIO config. Set EXPO_PUBLIC_MINIO_UPLOAD_API or EXPO_PUBLIC_MINIO_PUT_BASE_URL + EXPO_PUBLIC_MINIO_PUBLIC_BASE_URL',
    );
  }

  const objectKey = `muscle-images/${fileName}`;
  const putUrl = `${putBase.replace(/\/$/, '')}/${objectKey}`;
  const readUrl = `${publicBase.replace(/\/$/, '')}/${objectKey}`;

  const headers: Record<string, string> = { 'Content-Type': contentType };
  if (token) headers.Authorization = `Bearer ${token}`;

  const uploadResponse = await fetch(putUrl, {
    method: 'PUT',
    headers,
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`MinIO direct upload failed (${uploadResponse.status})`);
  }

  return readUrl;
}

async function compressImage(uri: string): Promise<{ uri: string }> {
  // Keep visual quality good enough for cards while reducing payload.
  return manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.72, format: SaveFormat.JPEG },
  );
}

function extensionFromUri(uri: string): string {
  const raw = uri.split('.').pop()?.split('?')[0]?.toLowerCase();
  if (raw === 'png' || raw === 'webp') return raw;
  return 'jpg';
}

function mimeFromExt(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  if (!response.ok) {
    throw new Error(`Failed to read image data (${response.status})`);
  }
  return response.blob();
}
