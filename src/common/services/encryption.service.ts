import { Injectable } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly key = Buffer.from(process.env.AES_KEY_BASE64!, 'base64');

  encrypt(plain: string): { iv: string; ciphertext: string } {
    const KEY_LEN = 32;
    if (!Buffer.isBuffer(this.key)) {
      throw new TypeError(
        `Encryption key must be a Buffer, got ${typeof this.key}`,
      );
    }
    if (this.key.length !== KEY_LEN) {
      throw new Error(
        `Invalid key length: expected ${KEY_LEN} bytes, got ${this.key.length}`,
      );
    }
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    return {
      iv: iv.toString('base64'),
      ciphertext: encrypted.toString('base64'),
    };
  }

  decrypt(ivB64: string, ctB64: string): string {
    const iv = Buffer.from(ivB64, 'base64');
    const ct = Buffer.from(ctB64, 'base64');
    const decipher = createDecipheriv('aes-256-cbc', this.key, iv);
    const decrypted = Buffer.concat([decipher.update(ct), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
