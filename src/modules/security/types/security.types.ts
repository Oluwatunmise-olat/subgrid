export interface PendingChallenge {
	challenge: string;
	type: 'registration' | 'approval';
	action?: string;
	expiresAt: number;
}
