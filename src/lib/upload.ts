import { writeFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

export const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
export const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

export async function saveUploadedFile(file: File): Promise<{ filePath: string; md5: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const md5 = crypto.createHash('md5').update(buffer).digest('hex');

  // 对文件名进行安全处理（不进行URL编码）
  const safeFileName = file.name
    .replace(/[<>:"|?*\\/]/g, '_')  // 移除文件系统不允许的字符
    .replace(/\.{2,}/g, '_')         // 移除连续的点
    .replace(/^\./g, '_');           // 移除开头的点
  
  // Generate unique filename with timestamp
  const filename = `${Date.now()}_${crypto.randomBytes(8).toString('hex')}-${safeFileName}`;
  const filePath = path.join(UPLOAD_DIR, filename);

  // Save file to disk
  await writeFile(filePath, buffer);

  // Return relative path for URL and MD5 hash (对URL进行编码)
  return {
    filePath: `/uploads/${encodeURIComponent(filename)}`,
    md5
  };
}

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: '没有文件上传' };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: `文件大小不能超过 ${MAX_FILE_SIZE / (1024 * 1024)}MB` };
  }

  // 允许的文件类型
  const allowedTypes = [
    'application/zip',
    'application/x-zip-compressed',
    'application/x-rar-compressed',
    'application/octet-stream',
    'application/vnd.android.package-archive', // APK
    'application/x-msdownload', // EXE
    'application/x-apple-diskimage', // DMG
  ];

  const allowedExtensions = ['.zip', '.rar', '.apk', '.exe', '.dmg', '.tar', '.gz', '.7z', '.jar', '.lrj'];
  const ext = path.extname(file.name).toLowerCase();

  if (!allowedExtensions.includes(ext)) {
    return { valid: false, error: `不支持的文件类型: ${ext}` };
  }

  return { valid: true };
}