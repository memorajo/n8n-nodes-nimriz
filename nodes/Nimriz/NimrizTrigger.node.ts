import type {
	IDataObject,
	IHookFunctions,
	INodeType,
	INodeTypeDescription,
	IWebhookFunctions,
	IWebhookResponseData,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError } from 'n8n-workflow';

import { nimrizApiRequest, nimrizApiRequestAllowError } from './GenericFunctions';

export class NimrizTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nimriz Trigger',
		name: 'nimrizTrigger',
		icon: 'file:nimriz.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Starts a workflow when a Nimriz event occurs',
		defaults: { name: 'Nimriz Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'nimrizApi',
				required: true,
				displayOptions: { show: { authentication: ['apiKey'] } },
			},
			{
				name: 'nimrizOAuth2Api',
				required: true,
				displayOptions: { show: { authentication: ['oauth2'] } },
			},
		],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Authentication',
				name: 'authentication',
				type: 'options',
				noDataExpression: true,
				default: 'apiKey',
				options: [
					{ name: 'API Key', value: 'apiKey' },
					{ name: 'OAuth2', value: 'oauth2' },
				],
			},
			{
				displayName: 'Event',
				name: 'event',
				type: 'options',
				noDataExpression: true,
				default: 'link.created',
				options: [
					{ name: 'Domain Verification Updated', value: 'domain.verification_updated' },
					{ name: 'Link Clicked', value: 'link.clicked' },
					{ name: 'Link Created', value: 'link.created' },
					{ name: 'Link Takedown Updated', value: 'link.takedown_updated' },
					{ name: 'Link Updated', value: 'link.updated' },
					{ name: 'QR Code Scanned', value: 'link.qr_scanned' },
				],
				description:
					'The Nimriz event to subscribe to. Subscribing registers a webhook in your workspace, which requires n8n to be reachable at a public HTTPS URL — on a local n8n, start it with the --tunnel option.',
			},
		],
	};

	webhookMethods = {
		default: {
			async checkExists(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				return webhookData.endpointId !== undefined;
			},

			async create(this: IHookFunctions): Promise<boolean> {
				const webhookUrl = this.getNodeWebhookUrl('default') as string;
				const event = this.getNodeParameter('event') as string;
				const response = (await nimrizApiRequest.call(this, 'POST', '/api/webhooks/endpoints', {
					endpoint_url: webhookUrl,
					name: `n8n: ${event}`,
					subscriptions: [event],
				})) as IDataObject;
				const endpoint = response.endpoint as IDataObject | undefined;
				const endpointId = endpoint?.id;
				if (endpointId === undefined) {
					return false;
				}
				const webhookData = this.getWorkflowStaticData('node');
				webhookData.endpointId = endpointId;
				return true;
			},

			async delete(this: IHookFunctions): Promise<boolean> {
				const webhookData = this.getWorkflowStaticData('node');
				const endpointId = webhookData.endpointId as string | undefined;
				if (endpointId === undefined) {
					return true;
				}
				// Use the non-throwing request so an already-removed endpoint (404) is
				// treated as a successful unsubscribe, while any other failure (auth,
				// network, server) is surfaced as a NodeApiError instead of swallowed.
				const result = await nimrizApiRequestAllowError.call(
					this,
					'DELETE',
					`/api/webhooks/endpoints/${encodeURIComponent(endpointId)}`,
				);
				if (result.statusCode >= 300 && result.statusCode !== 404) {
					throw new NodeApiError(this.getNode(), result.body as JsonObject, {
						message: `Could not remove the Nimriz webhook subscription (HTTP ${result.statusCode}).`,
					});
				}
				delete webhookData.endpointId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const body = this.getBodyData();
		return { workflowData: [this.helpers.returnJsonArray(body as IDataObject)] };
	}
}
