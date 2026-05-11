import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * On native: copies the picker URI to documentDirectory so it survives restarts.
 * On web: returns the picker URI as-is (blob/object URLs work fine in the browser).
 */
export async function persistImageLocally(pickerUri: string): Promise<string> {
  if (Platform.OS === 'web') {
    return pickerUri;
  }
  const imageDir = FileSystem.documentDirectory + 'muscle_images/';
  const dirInfo = await FileSystem.getInfoAsync(imageDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(imageDir, { intermediates: true });
  }
  const ext = pickerUri.split('.').pop()?.split('?')[0] || 'jpg';
  const filename = `img_${Date.now()}.${ext}`;
  const dest = imageDir + filename;
  await FileSystem.copyAsync({ from: pickerUri, to: dest });
  return dest;
}
