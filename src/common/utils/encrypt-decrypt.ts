import crypto from 'crypto';

import { app } from '@/conf/env';
import { EncryptedPayload } from '@/common/types/encryption';

const ALGORITHM = 'aes-256-gcm';

const getKey = (): Buffer => {
	if (!app.encryption_key || app.encryption_key.length !== 64) {
		throw new Error('ENCRYPTION_KEY must be set to a 64-char hex string (32 bytes). Generate one with `openssl rand -hex 32`.');
	}

	return Buffer.from(app.encryption_key, 'hex');
};

export const encryptJson = (value: unknown): EncryptedPayload => {
	const nonce = crypto.randomBytes(12);
	const cipher = crypto.createCipheriv(ALGORITHM, getKey(), nonce);

	const plainText = JSON.stringify(value ?? null);
	const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();

	return {
		cipher_text: encrypted.toString('base64'),
		nonce: nonce.toString('base64'),
		tag: tag.toString('base64'),
	};
};

export const decryptJson = <T = unknown>(payload: EncryptedPayload): T => {
	const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(payload.nonce, 'base64'));
	decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

	const decrypted = Buffer.concat([decipher.update(Buffer.from(payload.cipher_text, 'base64')), decipher.final()]);

	return JSON.parse(decrypted.toString('utf8')) as T;
};
