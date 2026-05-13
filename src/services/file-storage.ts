import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export interface StoredFile {
    filename: string;
    url: string;
    size: number;
    mimetype: string;
}

export interface FileStorage {
    save(buffer: Buffer, originalName: string, mimetype: string): Promise<StoredFile>;
}

export class LocalFileStorage implements FileStorage {
    constructor(
        private readonly uploadDir: string,
        private readonly publicBaseUrl: string,
    ) { }

    async save(
        buffer: Buffer,
        originalName: string,
        mimetype: string,
    ): Promise<StoredFile> {
        await fs.mkdir(this.uploadDir, { recursive: true });
        const ext = path.extname(originalName) || guessExtension(mimetype);
        const filename = `${randomUUID()}${ext}`;
        const target = path.join(this.uploadDir, filename);
        await fs.writeFile(target, buffer);
        return {
            filename,
            url: `${this.publicBaseUrl}/${filename}`,
            size: buffer.length,
            mimetype,
        };
    }
}

function guessExtension(mimetype: string): string {
    if (mimetype.includes('jpeg') || mimetype.includes('jpg')) return '.jpg';
    if (mimetype.includes('png')) return '.png';
    if (mimetype.includes('pdf')) return '.pdf';
    return '';
}
