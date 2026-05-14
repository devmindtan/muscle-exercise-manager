import * as FileSystem from 'expo-file-system';

const MINIO_ENDPOINT = process.env.EXPO_PUBLIC_MINIO_ENDPOINT;
const BUCKET_NAME = 'muscle-manager';
const BASE_URL = `${MINIO_ENDPOINT}/${BUCKET_NAME}`;

export interface ImageUploadProgress {
  loaded: number;
  total: number;
}

export interface ImageUploadResult {
  success: boolean;
  key?: string;
  url?: string;
  error?: string;
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.trim().replace(/\/+$/, '');
}

function makeImageKey(fileName: string): string {
  const clean = fileName
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
  return `images/${Date.now()}_${clean}`;
}

function toImageUrl(key: string): string {
  const encodedKey = key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `${normalizeEndpoint(BASE_URL)}/${encodedKey}`;
}

export async function uploadImage(
  fileUri: string,
  fileName: string,
  mimeType: string = 'image/jpeg',
  onProgress?: (progress: ImageUploadProgress) => void
): Promise<ImageUploadResult> {
  try {
    const key = makeImageKey(fileName);
    const uploadUrl = `${normalizeEndpoint(BASE_URL)}/${encodeURIComponent(key)}`;

    const task = FileSystem.createUploadTask(
      uploadUrl,
      fileUri,
      {
        httpMethod: 'PUT',
        uploadType: 'binary' as any,
        headers: { 'Content-Type': mimeType },
      },
      (progress: { totalBytesSent: number; totalBytesExpectedToSend: number }) => {
        onProgress?.({
          loaded: progress.totalBytesSent,
          total: progress.totalBytesExpectedToSend,
        });
      }
    );

    await task.uploadAsync();

    return {
      success: true,
      key,
      url: toImageUrl(key),
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Image upload failed';
    console.error('Image upload error:', err);
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function deleteImage(key: string): Promise<boolean> {
  try {
    const deleteUrl = `${normalizeEndpoint(BASE_URL)}/${encodeURIComponent(key)}`;
    const response = await fetch(deleteUrl, {
      method: 'DELETE',
    });
    return response.ok;
  } catch (err: any) {
    console.error('Image delete error:', err);
    return false;
  }
}

export async function testImageUploadConnection(): Promise<boolean> {
  try {
    const response = await fetch(normalizeEndpoint(BASE_URL), { method: 'GET' });
    return response.status < 500;
  } catch (err) {
    console.error('Connection test error:', err);
    return false;
  }
}

export function getImageUrl(key: string): string {
  return toImageUrl(key);
}
