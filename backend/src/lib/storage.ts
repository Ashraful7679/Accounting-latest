import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Readable } from 'stream';

interface StorageProvider {
  save(fileName: string, data: Buffer | Readable, mimeType: string): Promise<{ filePath: string; hash: string; fileSize: number }>;
  get(filePath: string): Promise<{ stream: Readable; mimeType: string } | null>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string): Promise<boolean>;
}

let provider: StorageProvider | null = null;

async function getStorageProvider(): Promise<StorageProvider> {
  if (provider) return provider;

  const s3Bucket = process.env.S3_BUCKET;
  const s3Region = process.env.S3_REGION;
  const s3AccessKey = process.env.S3_ACCESS_KEY;
  const s3SecretKey = process.env.S3_SECRET_KEY;

  if (s3Bucket && s3Region && s3AccessKey && s3AccessKey !== '') {
    // S3 support is available when @aws-sdk/client-s3 is installed and env vars are set
    // Use require() to avoid TypeScript compilation error when package is not installed
    try {
      const s3Module = require('@aws-sdk/client-s3');
      const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = s3Module;
      const s3 = new S3Client({
        region: s3Region,
        credentials: { accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey },
      });

      provider = {
        async save(fileName, data, mimeType) {
          const buf = data instanceof Buffer ? data : await new Promise<Buffer>((resolve, reject) => {
            const chunks: Buffer[] = [];
            (data as Readable).on('data', (c: Buffer) => chunks.push(c));
            (data as Readable).on('end', () => resolve(Buffer.concat(chunks)));
            (data as Readable).on('error', reject);
          });
          const hash = crypto.createHash('sha256').update(buf).digest('hex');
          await s3.send(new PutObjectCommand({
            Bucket: s3Bucket,
            Key: fileName,
            Body: buf,
            ContentType: mimeType,
          }));
          return { filePath: fileName, hash, fileSize: buf.length };
        },

        async get(filePath) {
          try {
            const result = await s3.send(new GetObjectCommand({ Bucket: s3Bucket, Key: filePath }));
            const stream = result.Body as Readable;
            return { stream, mimeType: result.ContentType || 'application/octet-stream' };
          } catch {
            return null;
          }
        },

        async delete(filePath) {
          await s3.send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: filePath }));
        },

        async exists(filePath) {
          try {
            await s3.send(new HeadObjectCommand({ Bucket: s3Bucket, Key: filePath }));
            return true;
          } catch {
            return false;
          }
        },
      };
    } catch {
      console.warn('[Storage] S3 SDK not installed, falling back to local filesystem');
    }
  }

  if (!provider) {
    const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(UPLOAD_DIR)) {
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    }

    provider = {
      async save(fileName, data, _mimeType) {
        const filePath = path.join(UPLOAD_DIR, fileName);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const hash = crypto.createHash('sha256');
        const writeStream = fs.createWriteStream(filePath);
        let fileSize = 0;

        if (data instanceof Buffer) {
          hash.update(data);
          writeStream.write(data);
          fileSize = data.length;
        } else {
          for await (const chunk of data) {
            fileSize += chunk.length;
            hash.update(chunk);
            writeStream.write(chunk);
          }
        }
        writeStream.end();

        return { filePath: fileName, hash: hash.digest('hex'), fileSize };
      },

      async get(filePath) {
        const fullPath = path.join(UPLOAD_DIR, filePath);
        if (!fs.existsSync(fullPath)) return null;
        const ext = path.extname(filePath).toLowerCase();
        const mimeMap: Record<string, string> = {
          '.pdf': 'application/pdf',
          '.jpg': 'image/jpeg',
          '.jpeg': 'image/jpeg',
          '.png': 'image/png',
          '.doc': 'application/msword',
          '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '.xls': 'application/vnd.ms-excel',
          '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        };
        return { stream: fs.createReadStream(fullPath), mimeType: mimeMap[ext] || 'application/octet-stream' };
      },

      async delete(filePath) {
        const fullPath = path.join(UPLOAD_DIR, filePath);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      },

      async exists(filePath) {
        return fs.existsSync(path.join(UPLOAD_DIR, filePath));
      },
    };
  }

  return provider;
}

export async function saveFile(fileName: string, data: Buffer | Readable, mimeType: string) {
  const p = await getStorageProvider();
  return p.save(fileName, data, mimeType);
}

export async function getFile(filePath: string) {
  const p = await getStorageProvider();
  return p.get(filePath);
}

export async function deleteFile(filePath: string) {
  const p = await getStorageProvider();
  return p.delete(filePath);
}

export async function fileExists(filePath: string) {
  const p = await getStorageProvider();
  return p.exists(filePath);
}
