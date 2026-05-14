import * as FileSystem from 'expo-file-system/legacy';

export async function persistImageLocally(uri: string): Promise<string> {
  if (!uri) return uri;
  if (uri.startsWith('file://') && uri.includes('/document/')) {
    return uri;
  }

  const baseDir = `${FileSystem.documentDirectory}images`;
  const fileName = `${Date.now()}_${uri.split('/').pop() || 'image.jpg'}`;
  const destination = `${baseDir}/${fileName}`;

  await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  await FileSystem.copyAsync({ from: uri, to: destination });

  return destination;
}
