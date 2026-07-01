export interface ObjectStoragePort {
  upload(
    file: Buffer,
    originalName: string,
    folder: string,
    isPublic?: boolean,
  ): Promise<string>;
  getPublicUrl(objectName: string): string;
}

export const OBJECT_STORAGE = Symbol('OBJECT_STORAGE');
