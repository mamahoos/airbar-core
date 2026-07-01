import { randomUUID } from 'node:crypto';
import path from 'node:path';

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';

import { APP_CONFIG } from '../../bootstrap/config/index.js';

import type { AppConfig } from '../../bootstrap/config/index.js';
import type { ObjectStoragePort } from '../../domain/storage/object-storage.port.js';

@Injectable()
export class MinioObjectStorage implements ObjectStoragePort, OnModuleInit {
  private readonly client: Minio.Client;
  private readonly bucket: string;
  private readonly useSsl: boolean;
  private readonly endpoint: string;
  private readonly port: number;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.bucket = config.minioBucket;
    this.useSsl = config.minioUseSsl;
    this.endpoint = config.minioEndpoint;
    this.port = config.minioPort;
    this.client = new Minio.Client({
      endPoint: config.minioEndpoint,
      port: config.minioPort,
      useSSL: config.minioUseSsl,
      accessKey: config.minioAccessKey,
      secretKey: config.minioSecretKey,
    });
  }

  async onModuleInit(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucket);
    if (!exists) {
      await this.client.makeBucket(this.bucket);
    }
  }

  async upload(
    file: Buffer,
    originalName: string,
    folder: string,
    isPublic = false,
  ): Promise<string> {
    const ext = path.extname(originalName);
    const objectName = `${isPublic ? 'public/' : 'private/'}${folder}/${randomUUID()}${ext}`;
    await this.client.putObject(this.bucket, objectName, file, file.length);
    return objectName;
  }

  getPublicUrl(objectName: string): string {
    const protocol = this.useSsl ? 'https' : 'http';
    return `${protocol}://${this.endpoint}:${this.port}/${this.bucket}/${objectName}`;
  }

  async getSignedUrl(objectName: string, expirySeconds = 3600): Promise<string> {
    const maxExpiry = 7 * 24 * 3600;
    const expiry = Math.min(expirySeconds, maxExpiry);
    return this.client.presignedGetObject(this.bucket, objectName, expiry);
  }
}
