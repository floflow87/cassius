import { createClient, SupabaseClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'patient-documents';
const SIGNED_URL_EXPIRY = 3600; // 1 hour in seconds

let supabaseClient: SupabaseClient | null = null;

function isValidHttpUrl(str: string | undefined): boolean {
  if (!str) return false;
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Normalize Supabase URL - remove .storage if present
 * The Supabase client needs the project URL (xxx.supabase.co), not the storage URL (xxx.storage.supabase.co)
 */
function normalizeSupabaseUrl(url: string): string {
  // Remove .storage from URL if present (e.g., xxx.storage.supabase.co -> xxx.supabase.co)
  return url.replace('.storage.supabase.co', '.supabase.co');
}

function getSupabaseClient(): SupabaseClient {
  if (supabaseClient) {
    return supabaseClient;
  }

  // Support both standard names and Render production names
  // IMPORTANT: URL and key must come from the SAME Supabase project
  let supabaseUrl: string | undefined;
  let supabaseServiceRoleKey: string | undefined;
  let source: string = 'NONE';

  // Try production pair first (both must be valid)
  if (isValidHttpUrl(process.env.SUPABASE_API_URL_PROD) && process.env.SUPABASE_API_SERVICE_ROLE_KEY_PROD) {
    supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_API_URL_PROD!);
    supabaseServiceRoleKey = process.env.SUPABASE_API_SERVICE_ROLE_KEY_PROD;
    source = 'PROD';
  } 
  // Fall back to standard pair
  else if (isValidHttpUrl(process.env.SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL!);
    supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    source = 'STANDARD';
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('[STORAGE] Missing Supabase config. Need matching URL+KEY pair.',
      'SUPABASE_URL valid:', isValidHttpUrl(process.env.SUPABASE_URL),
      'SUPABASE_API_URL_PROD valid:', isValidHttpUrl(process.env.SUPABASE_API_URL_PROD));
    throw new Error('Valid SUPABASE_URL and matching SUPABASE_SERVICE_ROLE_KEY are required for file storage');
  }

  console.log('[STORAGE] Using Supabase config from:', source, '| URL:', supabaseUrl.substring(0, 30) + '...');

  supabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Generate storage path for a radiograph
 * Format: org/{orgId}/patients/{patientId}/radiographies/{docId}/{filename}
 */
export function generateFilePath(
  organisationId: string,
  patientId: string,
  documentId: string,
  fileName: string
): string {
  // Sanitize filename
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `org/${organisationId}/patients/${patientId}/radiographies/${documentId}/${sanitizedFileName}`;
}

/**
 * Upload a file to Supabase Storage
 */
export async function uploadFile(
  filePath: string,
  fileBuffer: Buffer,
  mimeType: string
): Promise<{ path: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(filePath, fileBuffer, {
      contentType: mimeType,
      upsert: false,
    });

  if (error) {
    console.error('[STORAGE] Upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }

  return { path: data.path };
}

/**
 * Create a signed upload URL for client-side upload
 */
export async function createSignedUploadUrl(
  filePath: string
): Promise<{ signedUrl: string; token: string; path: string }> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(filePath);

  if (error) {
    console.error('[STORAGE] Create signed upload URL error:', error);
    throw new Error(`Failed to create upload URL: ${error.message}`);
  }

  return {
    signedUrl: data.signedUrl,
    token: data.token,
    path: data.path,
  };
}

/**
 * Get a signed URL for viewing/downloading a file
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = SIGNED_URL_EXPIRY
): Promise<string> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, expiresIn);

  if (error) {
    console.error('[STORAGE] Get signed URL error:', error);
    throw new Error(`Failed to get signed URL: ${error.message}`);
  }

  return data.signedUrl;
}

/**
 * Get signed URLs for multiple files
 */
export async function getSignedUrls(
  filePaths: string[],
  expiresIn: number = SIGNED_URL_EXPIRY
): Promise<Map<string, string>> {
  const supabase = getSupabaseClient();
  const result = new Map<string, string>();

  if (filePaths.length === 0) {
    return result;
  }

  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrls(filePaths, expiresIn);

  if (error) {
    console.error('[STORAGE] Get signed URLs error:', error);
    throw new Error(`Failed to get signed URLs: ${error.message}`);
  }

  for (const item of data) {
    if (item.signedUrl && item.path) {
      result.set(item.path, item.signedUrl);
    }
  }

  return result;
}

/**
 * Delete a file from Supabase Storage
 */
export async function deleteFile(filePath: string): Promise<void> {
  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove([filePath]);

  if (error) {
    console.error('[STORAGE] Delete error:', error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
}

/**
 * Delete multiple files from Supabase Storage
 */
export async function deleteFiles(filePaths: string[]): Promise<void> {
  if (filePaths.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  const { error } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(filePaths);

  if (error) {
    console.error('[STORAGE] Bulk delete error:', error);
    throw new Error(`Failed to delete files: ${error.message}`);
  }
}

/**
 * Check if Supabase Storage is configured
 */
export function isStorageConfigured(): boolean {
  // Check for either standard or production variable pairs
  const hasStandard = !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const hasProd = !!(isValidHttpUrl(process.env.SUPABASE_API_URL_PROD) && process.env.SUPABASE_API_SERVICE_ROLE_KEY_PROD);
  return hasStandard || hasProd;
}

/**
 * Initialize bucket if it doesn't exist (should be called on startup in production)
 */
export async function initializeBucket(): Promise<void> {
  if (!isStorageConfigured()) {
    console.warn('[STORAGE] Supabase Storage not configured - skipping bucket initialization');
    return;
  }

  const supabase = getSupabaseClient();

  // Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('[STORAGE] Error listing buckets:', listError);
    return;
  }

  const bucketExists = buckets.some((b) => b.name === BUCKET_NAME);

  if (!bucketExists) {
    console.log('[STORAGE] Creating bucket:', BUCKET_NAME);
    const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB limit
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'],
    });

    if (createError) {
      console.error('[STORAGE] Error creating bucket:', createError);
      throw new Error(`Failed to create bucket: ${createError.message}`);
    }

    console.log('[STORAGE] Bucket created successfully');
  } else {
    console.log('[STORAGE] Bucket already exists:', BUCKET_NAME);
  }
}
