import {
	BUCKET_PATTERN,
	DOMAIN_PATTERN,
	EMAIL_PATTERN,
	PROJECT_PATTERN,
	RECORD_PATTERN,
} from './entity-extraction.constants';
import { RequestEntities } from '../types/entities';

export const extractEntities = (message: string): RequestEntities => {
	const entities: RequestEntities = {};

	const bucket = message.match(BUCKET_PATTERN);
	if (bucket) entities.bucket = bucket[1];

	const email = message.match(EMAIL_PATTERN);
	if (email) entities.recipient = email[1];

	const record = message.match(RECORD_PATTERN);
	if (record) entities.record = record[1];

	const project = message.match(PROJECT_PATTERN);
	if (project) entities.project = project[1];

	const domain = message.match(DOMAIN_PATTERN);
	if (domain && !(email && email[1].endsWith(domain[1]))) {
		entities.domain = domain[1];
		entities.zone = domain[1];
	}

	return entities;
};
