import type {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class NimrizApi implements ICredentialType {
	name = 'nimrizApi';

	displayName = 'Nimriz API';

	documentationUrl = 'https://nimriz.com/docs/integrations/n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description:
				'Your Nimriz workspace API key, created under Settings → Integrations → API access. The key is scoped to a single workspace.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: 'https://api.nimriz.com',
			url: '/api/v1/whoami',
			method: 'GET',
		},
	};
}
