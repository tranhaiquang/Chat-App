import { File } from 'expo-file-system';

import { supabase } from './supabase';

export type AttachmentType = 'image' | 'video' | 'file';

export interface UploadAttachmentPayload {
  type: AttachmentType;
  /** Public URL of the stored object. */
  url: string;
  /** Storage path inside the bucket (needed to delete or replace it). */
  path: string;
  name?: string | null;
  size?: number | null;
}

export const MEDIA_BUCKET = 'chat-media';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'quicktime', 'mkv', 'avi', 'm4v'];

function resolveAttachmentType(fileName: string): AttachmentType {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  if (IMAGE_EXTENSIONS.includes(ext)) return 'image';
  if (VIDEO_EXTENSIONS.includes(ext)) return 'video';
  return 'file';
}

/** Strips path separators and other characters that are unsafe in a key. */
function sanitizeFileName(name: string): string {
  const cleaned = name.replace(/[^\w.\- ]+/g, '_').trim();
  return cleaned.length > 0 ? cleaned : 'file';
}

/**
 * Builds the storage key for an attachment: `{conversationId}/{timestamp}-{fileName}`.
 * The conversation id doubles as the RLS guard — the storage policy only
 * lets members of that conversation write into its folder.
 */
export function buildObjectPath(conversationId: string, fileName: string): string {
  // Timestamp keeps two same-named sends from overwriting each other's object.
  return `${conversationId}/${Date.now()}-${sanitizeFileName(fileName)}`;
}

/**
 * Uploads a local file into the `chat-media` bucket.
 *
 * `localUri` is a `file://` URI produced by expo-image-picker / expo-document-picker.
 * The Supabase SDK attaches the current user's auth token to the request, so the
 * storage RLS policies apply and only conversation members can write here.
 */
export async function uploadAttachment(
  conversationId: string,
  localUri: string,
  fileName: string,
  contentType?: string,
): Promise<UploadAttachmentPayload> {
  const safeName = sanitizeFileName(fileName);
  const objectPath = buildObjectPath(conversationId, safeName);
  const type = resolveAttachmentType(safeName);

  const file = new File(localUri);
  if (!file.exists) {
    throw new Error(`Selected file is no longer available: ${fileName}`);
  }

  const bytes = await file.bytes();
  const size = bytes.byteLength;

  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(objectPath, bytes, {
      contentType: contentType ?? 'application/octet-stream',
      // Overwrite so re-sending the same filename in a conversation works.
      upsert: true,
    });

  if (error) throw error;

  const { data: publicUrl } = supabase.storage
    .from(MEDIA_BUCKET)
    .getPublicUrl(objectPath);

  return {
    type,
    url: publicUrl.publicUrl,
    path: objectPath,
    name: safeName,
    size,
  };
}

/** Removes a previously uploaded object. */
export async function deleteAttachment(objectPath: string): Promise<void> {
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .remove([objectPath]);
  if (error) throw error;
}
