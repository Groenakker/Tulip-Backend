import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_KEY in .env file');
}

// Regular client for public operations (uses anon key)
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin client for server-side operations that bypass RLS (uses service role key)
// Use service role key if available, otherwise fall back to regular key
const supabaseAdmin = supabaseServiceRoleKey 
  ? createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : supabase;

/**
 * Upload a file to Supabase Storage
 * @param {Buffer|string} file - File buffer or base64 string
 * @param {string} fileName - Name of the file
 * @param {string} bucket - Bucket name (default: 'profile-pictures')
 * @param {string} folder - Folder path within bucket (optional)
 * @param {string} mimeType - MIME type of the file (optional, will be inferred if not provided)
 * @returns {Promise<{url: string, path: string}>} Public URL and path of uploaded file
 */
export const uploadFileToSupabase = async (file, fileName, bucket = 'user_media', folder = '', mimeType = null) => {
  try {
    // Generate unique filename to avoid conflicts
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 15);
    const fileExtension = fileName.split('.').pop() || 'jpg';
    const uniqueFileName = `${timestamp}-${randomString}.${fileExtension}`;
    const filePath = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

    // Convert base64 to buffer if needed and extract mimeType
    let fileBuffer;
    let detectedMimeType = mimeType;
    
    if (typeof file === 'string') {
      // Handle base64 string
      const mimeMatch = file.match(/data:([^;]+);base64,/);
      if (mimeMatch) {
        detectedMimeType = mimeMatch[1];
      }
      const base64Data = file.replace(/^data:[^;]+;base64,/, '');
      fileBuffer = Buffer.from(base64Data, 'base64');
    } else {
      fileBuffer = file;
    }

    // Determine content type
    let contentType = detectedMimeType || `image/${fileExtension}`;
    // Normalize common image types
    if (contentType === 'image/jpeg') contentType = 'image/jpeg';
    else if (contentType === 'image/png') contentType = 'image/png';
    else if (contentType === 'image/gif') contentType = 'image/gif';
    else if (contentType === 'image/webp') contentType = 'image/webp';
    else if (!contentType.startsWith('image/')) {
      // Fallback to jpeg if unknown
      contentType = `image/${fileExtension === 'png' ? 'png' : fileExtension === 'gif' ? 'gif' : 'jpeg'}`;
    }

    // Upload file to Supabase Storage using admin client to bypass RLS
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, fileBuffer, {
        contentType: contentType,
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Failed to upload file to Supabase: ${error.message}`);
    }

    // Get public URL (can use regular client for this)
    const { data: urlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL from Supabase');
    }

    return {
      url: urlData.publicUrl,
      path: filePath,
    };
  } catch (error) {
    throw new Error(`Supabase upload error: ${error.message}`);
  }
};

/**
 * Delete a file from Supabase Storage
 * @param {string} filePath - Path of the file to delete
 * @param {string} bucket - Bucket name (default: 'user_media')
 * @returns {Promise<boolean>} Success status
 */
export const deleteFileFromSupabase = async (filePath, bucket = 'user_media') => {
  try {
    // Use admin client to bypass RLS for deletion
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting file from Supabase:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting file from Supabase:', error);
    return false;
  }
};

export default supabase;

