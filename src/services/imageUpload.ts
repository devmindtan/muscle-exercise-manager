import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '@/src/lib/supabase';

const MINIO_ENDPOINT = process.env.EXPO_PUBLIC_MINIO_ENDPOINT;
const BUCKET_NAME = process.env.EXPO_PUBLIC_MINIO_BUCKET ?? 'muscle-manager';
const BASE_URL = MINIO_ENDPOINT ? `${MINIO_ENDPOINT}/${BUCKET_NAME}` : '';

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
  return `${Date.now()}_${clean}`;
}

function encodeObjectKey(key: string): string {
  return key
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
}

function toImageUrl(key: string): string {
  return `${normalizeEndpoint(BASE_URL)}/${encodeObjectKey(key)}`;
}

export async function uploadImage(
  fileUri: string,
  fileName: string,
  mimeType: string = 'image/jpeg',
  onProgress?: (progress: ImageUploadProgress) => void
): Promise<ImageUploadResult> {
  try {
    if (!MINIO_ENDPOINT) {
      return { success: false, error: 'Missing EXPO_PUBLIC_MINIO_ENDPOINT' };
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return {
        success: false,
        error: userError?.message || 'No authenticated user for image upload',
      };
    }

    const key = `users/${user.id}/images/${makeImageKey(fileName)}`;
    const uploadUrl = `${normalizeEndpoint(BASE_URL)}/${encodeObjectKey(key)}`;

    const task = FileSystem.createUploadTask(
      uploadUrl,
      fileUri,
      {
        httpMethod: 'PUT',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
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

    // Trả về URL đầy đủ để lưu vào image_uri
    return {
      success: true,
      key,
      url: toImageUrl(key),
    };
  } catch (err: any) {
    const errorMessage = err?.message || 'Image upload failed';
    return {
      success: false,
      error: errorMessage,
    };
  }
}

export async function deleteImage(key: string): Promise<boolean> {
  try {
    const deleteUrl = `${normalizeEndpoint(BASE_URL)}/${encodeObjectKey(key)}`;
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