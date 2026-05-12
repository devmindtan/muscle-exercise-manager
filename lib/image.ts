import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Convert picker URI to a portable data URL so the same image can render
 * across devices after sync (instead of device-local file/blob paths).
 */
export async function persistImageLocally(pickerUri: string): Promise<string> {
  if (!pickerUri) return '';

  // Already portable (http/https/data) -> keep as-is.
  if (
    pickerUri.startsWith('data:') ||
    pickerUri.startsWith('http://') ||
    pickerUri.startsWith('https://')
  ) {
    return pickerUri;
  }

  if (Platform.OS === 'web') {
    // blob/object URL -> data URL for portability across sessions/devices.
    const response = await fetch(pickerUri);
    const blob = await response.blob();
    return await blobToDataUrl(blob);
  }

  // Native file:// -> data URL.
  const ext = pickerUri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';
  const mime = extToMime(ext);
  const base64 = await FileSystem.readAsStringAsync(pickerUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${mime};base64,${base64}`;
}

function extToMime(ext: string): string {
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new Error('Failed to read blob as data URL'));
    reader.readAsDataURL(blob);
  });
}
