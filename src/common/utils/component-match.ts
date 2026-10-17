const MIN_TOKEN_LENGTH = 5;

const tokenize = (value: string): string[] =>
	value
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.toLowerCase()
		.match(/[a-z0-9]+/g) || [];

const editBudget = (token: string) => (token.length >= 8 ? 2 : 1);

const boundedDistance = (a: string, b: string, limit: number): number => {
	if (Math.abs(a.length - b.length) > limit) return limit + 1;

	let previous = Array.from({ length: b.length + 1 }, (_, index) => index);

	for (let i = 1; i <= a.length; i++) {
		const current: number[] = [i];

		for (let j = 1; j <= b.length; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1;

			current.push(Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost));
		}

		previous = current;
	}

	return previous[b.length];
};

const nearMatch = (word: string, token: string): boolean => {
	if (word.length !== token.length && Math.abs(word.length - token.length) > editBudget(token)) return false;
	if (word.length < MIN_TOKEN_LENGTH || token.length < MIN_TOKEN_LENGTH) return false;
	if (word[0] !== token[0]) return false;

	return boundedDistance(word, token, editBudget(token)) <= editBudget(token);
};

export const mentionsComponent = (message: string, serverName: string): boolean => {
	const messageLower = message.toLowerCase();
	const tokens = tokenize(serverName).filter((token) => token.length >= 4);

	if (tokens.find((token) => messageLower.includes(token)) !== undefined) return true;

	for (const word of tokenize(message)) {
		if (tokens.find((token) => nearMatch(word, token)) !== undefined) return true;
	}

	return false;
};
