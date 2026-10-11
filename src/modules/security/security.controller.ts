import { injectable } from 'tsyringe';
import { Request, Response } from 'express';

import { genericResponse } from '@/common/utils/http';
import { PasskeyService } from './services/passkey.service';
import { ApprovalOptionsDto, ApprovalVerifyDto, RegistrationVerifyDto } from './dto/validation.dto';

@injectable()
export class SecurityController {
	constructor(private readonly passkeyService: PasskeyService) {}

	public list = async (_request: Request, response: Response) => {
		const data = await this.passkeyService.listCredentials();
		return genericResponse({ response, data });
	};

	public remove = async (request: Request, response: Response) => {
		const { passkey_id } = request.params;
		const data = await this.passkeyService.removeCredential(passkey_id);
		return genericResponse({ response, data });
	};

	public registrationOptions = async (_request: Request, response: Response) => {
		const data = await this.passkeyService.generateRegistrationOptions();
		return genericResponse({ response, data });
	};

	public registrationVerify = async (request: Request, response: Response) => {
		const { session_id, response: assertion, label } = request.body as RegistrationVerifyDto;
		const data = await this.passkeyService.verifyRegistration(session_id, assertion, label);
		return genericResponse({ response, data });
	};

	public approvalOptions = async (request: Request, response: Response) => {
		const { action } = request.body as ApprovalOptionsDto;
		const data = await this.passkeyService.generateApprovalOptions(action);
		return genericResponse({ response, data });
	};

	public approvalVerify = async (request: Request, response: Response) => {
		const { session_id, response: assertion } = request.body as ApprovalVerifyDto;
		const data = await this.passkeyService.verifyApproval(session_id, assertion);
		return genericResponse({ response, data });
	};
}
