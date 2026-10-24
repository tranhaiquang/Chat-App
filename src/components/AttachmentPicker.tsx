import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';

export interface PickedAttachment {
  localUri: string;
  fileName: string;
  mimeType?: string;
  size?: number;
  type: 'image' | 'video' | 'file';
}

/**
 * Opens the photo library and returns the chosen image or video.
 * Returns null when the user cancels.
 */
export async function pickMedia(): Promise<PickedAttachment | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Photo library permission is required to attach media.');
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    allowsEditing: false,
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const isVideo = asset.type === 'video';

  return {
    localUri: asset.uri,
    fileName: asset.fileName ?? (isVideo ? 'video.mp4' : 'image.jpg'),
    mimeType: isVideo ? 'video/mp4' : 'image/jpeg',
    size: asset.fileSize,
    type: isVideo ? 'video' : 'image',
  };
}

/**
 * Opens the document picker and returns the chosen file.
 * Returns null when the user cancels.
 */
export async function pickDocument(): Promise<PickedAttachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];

  return {
    localUri: asset.uri,
    fileName: asset.name,
    mimeType: asset.mimeType,
    size: asset.size,
    type: 'file',
  };
}
