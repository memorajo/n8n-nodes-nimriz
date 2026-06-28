import type { ICredentialType, INodeProperties } from 'n8n-workflow';

const NIMRIZ_API_BASE = 'https://api.nimriz.com';

export class NimrizOAuth2Api implements ICredentialType {
	name = 'nimrizOAuth2Api';

	extends = ['oAuth2Api'];

	displayName = 'Nimriz OAuth2 API';

	documentationUrl = 'https://nimriz.com/docs/integrations/n8n';

	properties: INodeProperties[] = [
		{
			displayName: 'Grant Type',
			name: 'grantType',
			type: 'hidden',
			default: 'authorizationCode',
		},
		{
			displayName: 'Authorization URL',
			name: 'authUrl',
			type: 'hidden',
			default: `${NIMRIZ_API_BASE}/oauth/authorize`,
		},
		{
			displayName: 'Access Token URL',
			name: 'accessTokenUrl',
			type: 'hidden',
			default: `${NIMRIZ_API_BASE}/oauth/token`,
		},
		{
			displayName: 'Scope',
			name: 'scope',
			type: 'hidden',
			default:
				'links:read links:write domains:read analytics:read webhooks:read webhooks:write connections:read connections:write',
		},
		{
			displayName: 'Auth URI Query Parameters',
			name: 'authQueryParameters',
			type: 'hidden',
			default: 'resource=https%3A%2F%2Fapi.nimriz.com&code_challenge_method=S256',
		},
		{
			displayName: 'Authentication',
			name: 'authentication',
			type: 'hidden',
			default: 'body',
		},
		{
			displayName: 'Use PKCE',
			name: 'pkce',
			type: 'hidden',
			default: true,
		},
	];
}
