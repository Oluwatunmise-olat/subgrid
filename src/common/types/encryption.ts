export interface EncryptedPayload {
	cipher_text: string;
	nonce: string;
	tag: string;
}
