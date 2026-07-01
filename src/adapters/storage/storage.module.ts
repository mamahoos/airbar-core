import { Module } from '@nestjs/common';

import { OBJECT_STORAGE } from '../../domain/storage/object-storage.port.js';

import { MinioObjectStorage } from './minio-object.storage.js';

@Module({
  providers: [{ provide: OBJECT_STORAGE, useClass: MinioObjectStorage }],
  exports: [OBJECT_STORAGE],
})
export class StorageModule {}
