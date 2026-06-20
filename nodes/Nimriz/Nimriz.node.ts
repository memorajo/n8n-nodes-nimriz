import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

import {
	getNimrizAccountId,
	nimrizApiRequest,
	nimrizApiRequestAllowError,
} from './GenericFunctions';

export class Nimriz implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Nimriz',
		name: 'nimriz',
		icon: 'file:nimriz.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Manage Nimriz short links and outbound connections',
		defaults: { name: 'Nimriz' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'nimrizApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				default: 'link',
				options: [
					{ name: 'Connection', value: 'connection' },
					{ name: 'Link', value: 'link' },
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['link'] } },
				default: 'create',
				options: [
					{
						name: 'Check Slug',
						value: 'checkSlug',
						action: 'Check slug availability',
						description: 'Check whether a slug is available on a domain',
					},
					{
						name: 'Create',
						value: 'create',
						action: 'Create a short link',
						description: 'Create a new short link',
					},
					{
						name: 'Find',
						value: 'find',
						action: 'Find a link by short URL',
						description: 'Find a link by its short URL',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a link',
						description: 'Get a single link by ID',
					},
					{
						name: 'Get Analytics',
						value: 'getAnalytics',
						action: 'Get link analytics',
						description: 'Get click and scan analytics for a link',
					},
					{
						name: 'List',
						value: 'list',
						action: 'List links',
						description: 'List recent links in the workspace',
					},
					{
						name: 'Update Destination',
						value: 'updateDestination',
						action: 'Update a link destination',
						description: 'Update the destination URL of a link',
					},
					{
						name: 'Update Expiration',
						value: 'updateExpiration',
						action: 'Update a link expiration',
						description: 'Set or remove the expiration on a link',
					},
					{
						name: 'Update Password',
						value: 'updatePassword',
						action: 'Update a link password',
						description: 'Set or remove the password on a link',
					},
					{
						name: 'Update Slug',
						value: 'updateSlug',
						action: 'Update a link slug',
						description: 'Update the slug of a link',
					},
				],
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['connection'] } },
				default: 'create',
				options: [
					{
						name: 'Create',
						value: 'create',
						action: 'Create a connection',
						description: 'Create a new outbound connection',
					},
					{
						name: 'Delete',
						value: 'delete',
						action: 'Delete a connection',
						description: 'Delete an outbound connection',
					},
					{
						name: 'Get',
						value: 'get',
						action: 'Get a connection',
						description: 'Get a single outbound connection by ID',
					},
					{
						name: 'List',
						value: 'list',
						action: 'List connections',
						description: 'List outbound connections in the workspace',
					},
					{
						name: 'Test',
						value: 'test',
						action: 'Test a connection',
						description: 'Send a test event to an outbound connection',
					},
					{
						name: 'Update',
						value: 'update',
						action: 'Update a connection',
						description: 'Update an outbound connection',
					},
				],
			},

			// Link fields
			{
				displayName: 'Domain Name or ID',
				name: 'domainId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDomains' },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['create', 'checkSlug'] } },
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Destination URL',
				name: 'longUrl',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'https://example.com/page',
				displayOptions: { show: { resource: ['link'], operation: ['create'] } },
				description: 'The destination URL the short link points to, including the https:// scheme',
			},
			{
				displayName: 'Custom Slug',
				name: 'customSlug',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['link'], operation: ['create'] } },
				description: 'Optional custom slug. Leave blank to auto-generate.',
			},
			{
				displayName: 'Expires At',
				name: 'expiresAt',
				type: 'dateTime',
				default: '',
				displayOptions: { show: { resource: ['link'], operation: ['create', 'updateExpiration'] } },
				description: 'When the link should expire. Leave blank for no expiration, or to remove it.',
			},
			{
				displayName: 'Redirect Status',
				name: 'redirectStatusCode',
				type: 'options',
				default: 302,
				displayOptions: { show: { resource: ['link'], operation: ['create'] } },
				options: [
					{ name: '301 (Permanent)', value: 301 },
					{ name: '302 (Temporary)', value: 302 },
				],
				description: 'The HTTP redirect status code for the link',
			},
			{
				displayName: 'Link Name or ID',
				name: 'linkId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getLinks' },
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['link'],
						operation: [
							'get',
							'getAnalytics',
							'updateSlug',
							'updateDestination',
							'updatePassword',
							'updateExpiration',
						],
					},
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Find By',
				name: 'findBy',
				type: 'options',
				default: 'shortUrl',
				displayOptions: { show: { resource: ['link'], operation: ['find'] } },
				options: [
					{ name: 'Domain and Short Code', value: 'domainAndCode' },
					{ name: 'Short URL', value: 'shortUrl' },
				],
				description: 'How to look up the link',
			},
			{
				displayName: 'Short URL',
				name: 'shortUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['find'], findBy: ['shortUrl'] } },
				description: 'The full short URL to look up, for example https://go.example.com/launch',
			},
			{
				displayName: 'Domain Name or ID',
				name: 'findDomainId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getDomains' },
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['find'], findBy: ['domainAndCode'] } },
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Short Code',
				name: 'findShortCode',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['find'], findBy: ['domainAndCode'] } },
				description: 'The short code (slug) on the domain',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['link'], operation: ['list'] } },
				description: 'Max number of results to return',
			},
			{
				displayName: 'New Slug',
				name: 'newSlug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['updateSlug'] } },
				description: 'The new slug for the link',
			},
			{
				displayName: 'New Destination URL',
				name: 'newLongUrl',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['updateDestination'] } },
				description: 'The new destination URL for the link',
			},
			{
				displayName: 'Password',
				name: 'password',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: { show: { resource: ['link'], operation: ['updatePassword'] } },
				description: 'The new password for the link. Leave blank to remove password protection.',
			},
			{
				displayName: 'Slug',
				name: 'slug',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['link'], operation: ['checkSlug'] } },
				description: 'The slug to check for availability',
			},
			{
				displayName: 'Range (Days)',
				name: 'rangeDays',
				type: 'number',
				default: 30,
				typeOptions: { minValue: 1 },
				displayOptions: { show: { resource: ['link'], operation: ['getAnalytics'] } },
				description: 'Number of days of analytics to return, ending now',
			},
			{
				displayName: 'Touch Type',
				name: 'touchType',
				type: 'options',
				default: 'short_link_click',
				displayOptions: { show: { resource: ['link'], operation: ['getAnalytics'] } },
				options: [
					{ name: 'Link Click', value: 'short_link_click' },
					{ name: 'QR Scan', value: 'qr_scan' },
				],
				description: 'Which touch type to summarize',
			},
			{
				displayName: 'Include Bots',
				name: 'includeBots',
				type: 'boolean',
				default: false,
				displayOptions: { show: { resource: ['link'], operation: ['getAnalytics'] } },
				description: 'Whether to include bot traffic in the analytics totals',
			},

			// Connection fields
			{
				displayName: 'Connection Name or ID',
				name: 'connectionId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getConnections' },
				default: '',
				required: true,
				displayOptions: {
					show: { resource: ['connection'], operation: ['get', 'update', 'delete', 'test'] },
				},
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Name',
				name: 'connectionName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['connection'], operation: ['create', 'update'] } },
				description: 'A label for the connection',
			},
			{
				displayName: 'Type',
				name: 'connectionType',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { resource: ['connection'], operation: ['create', 'update'] } },
				description: 'The connection type to deliver events to',
			},
			{
				displayName: 'Credentials (JSON)',
				name: 'connectionCredentials',
				type: 'json',
				default: '{}',
				displayOptions: { show: { resource: ['connection'], operation: ['create', 'update'] } },
				description:
					'Connection credentials as a JSON object. Keys depend on the connection type; for example, a generic_http connection requires an endpoint_url key.',
			},
			{
				displayName: 'Property Mapping (JSON)',
				name: 'propertyMapping',
				type: 'json',
				default: '{}',
				displayOptions: { show: { resource: ['connection'], operation: ['create', 'update'] } },
				description: 'Optional property mapping overrides as a JSON object',
			},
			{
				displayName: 'Event Filter (JSON)',
				name: 'eventFilter',
				type: 'json',
				default: '{}',
				displayOptions: { show: { resource: ['connection'], operation: ['create', 'update'] } },
				description: 'Optional event filter as a JSON object',
			},
			{
				displayName: 'Enabled',
				name: 'connectionEnabled',
				type: 'boolean',
				default: true,
				displayOptions: { show: { resource: ['connection'], operation: ['create', 'update'] } },
				description: 'Whether the connection is enabled',
			},
			{
				displayName: 'Action ID',
				name: 'actionId',
				type: 'string',
				default: '',
				displayOptions: { show: { resource: ['connection'], operation: ['test'] } },
				description: 'Optional action ID to test. Defaults to the primary action.',
			},
		],
	};

	methods = {
		loadOptions: {
			async getDomains(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const data = (await nimrizApiRequest.call(this, 'GET', '/api/v1/domains')) as IDataObject;
				const domains = (data.domains as IDataObject[]) ?? [];
				return domains.map((domain) => ({
					name: String(domain.domain_name ?? domain.id),
					value: String(domain.id),
				}));
			},
			async getLinks(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const data = (await nimrizApiRequest.call(this, 'GET', '/api/v1/links', {}, { limit: 100 })) as IDataObject;
				const links = (data.links as IDataObject[]) ?? [];
				return links.map((link) => {
					const code = String(link.short_code ?? link.id);
					const host = link.destination_host ? ` → ${String(link.destination_host)}` : '';
					return { name: `${code}${host}`, value: String(link.id) };
				});
			},
			async getConnections(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const accountId = await getNimrizAccountId.call(this);
				const data = (await nimrizApiRequest.call(
					this,
					'GET',
					'/api/integrations/destinations',
					{},
					{ account_id: accountId },
				)) as IDataObject;
				const destinations = (data.destinations as IDataObject[]) ?? [];
				return destinations.map((destination) => {
					const label = String(destination.name ?? destination.id);
					const type = destination.type ? ` (${String(destination.type)})` : '';
					return { name: `${label}${type}`, value: String(destination.id) };
				});
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		const toJson = (value: unknown, label: string, itemIndex: number): IDataObject => {
			if (value === undefined || value === null || value === '') {
				return {};
			}
			if (typeof value === 'object') {
				return value as IDataObject;
			}
			try {
				return JSON.parse(value as string) as IDataObject;
			} catch {
				throw new NodeOperationError(this.getNode(), `Parameter "${label}" must be valid JSON.`, {
					itemIndex,
				});
			}
		};

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: IDataObject | IDataObject[] = {};

				if (resource === 'link') {
					if (operation === 'create') {
						const body: IDataObject = {
							domain_id: this.getNodeParameter('domainId', i) as string,
							long_url: this.getNodeParameter('longUrl', i) as string,
							redirect_status_code: this.getNodeParameter('redirectStatusCode', i, 302) as number,
						};
						const customSlug = this.getNodeParameter('customSlug', i, '') as string;
						if (customSlug) {
							body.custom_slug = customSlug;
						}
						const expiresAt = this.getNodeParameter('expiresAt', i, '') as string;
						if (expiresAt) {
							body.expires_at = expiresAt;
						}
						responseData = (await nimrizApiRequest.call(this, 'POST', '/api/shorten', body)) as IDataObject;
					} else if (operation === 'find') {
						const findBy = this.getNodeParameter('findBy', i, 'shortUrl') as string;
						const findQs: IDataObject = {};
						if (findBy === 'domainAndCode') {
							findQs.domain_id = this.getNodeParameter('findDomainId', i) as string;
							findQs.short_code = this.getNodeParameter('findShortCode', i) as string;
						} else {
							findQs.short_url = this.getNodeParameter('shortUrl', i) as string;
						}
						responseData = (await nimrizApiRequest.call(
							this,
							'GET',
							'/api/v1/links/find',
							{},
							findQs,
						)) as IDataObject;
					} else if (operation === 'get') {
						const linkId = this.getNodeParameter('linkId', i) as string;
						const data = (await nimrizApiRequest.call(
							this,
							'GET',
							`/api/v1/links/${encodeURIComponent(linkId)}`,
						)) as IDataObject;
						responseData = (data.link as IDataObject) ?? data;
					} else if (operation === 'list') {
						const limit = this.getNodeParameter('limit', i, 50) as number;
						const data = (await nimrizApiRequest.call(
							this,
							'GET',
							'/api/v1/links',
							{},
							{ limit },
						)) as IDataObject;
						responseData = (data.links as IDataObject[]) ?? [];
					} else if (operation === 'updateSlug') {
						const body: IDataObject = {
							url_id: this.getNodeParameter('linkId', i) as string,
							new_slug: this.getNodeParameter('newSlug', i) as string,
						};
						responseData = (await nimrizApiRequest.call(
							this,
							'PUT',
							'/api/update-slug',
							body,
						)) as IDataObject;
					} else if (operation === 'updateDestination') {
						const body: IDataObject = {
							url_id: this.getNodeParameter('linkId', i) as string,
							long_url: this.getNodeParameter('newLongUrl', i) as string,
						};
						responseData = (await nimrizApiRequest.call(
							this,
							'PUT',
							'/api/update-destination',
							body,
						)) as IDataObject;
					} else if (operation === 'updatePassword') {
						const password = this.getNodeParameter('password', i, '') as string;
						const body: IDataObject = {
							url_id: this.getNodeParameter('linkId', i) as string,
							password: password === '' ? null : password,
						};
						responseData = (await nimrizApiRequest.call(
							this,
							'PUT',
							'/api/update-password',
							body,
						)) as IDataObject;
					} else if (operation === 'updateExpiration') {
						const expiresAt = this.getNodeParameter('expiresAt', i, '') as string;
						const body: IDataObject = {
							url_id: this.getNodeParameter('linkId', i) as string,
							expires_at: expiresAt === '' ? null : expiresAt,
						};
						responseData = (await nimrizApiRequest.call(
							this,
							'PUT',
							'/api/update-expiration',
							body,
						)) as IDataObject;
					} else if (operation === 'checkSlug') {
						const result = await nimrizApiRequestAllowError.call(this, 'POST', '/api/check-slug', {
							domain_id: this.getNodeParameter('domainId', i) as string,
							slug: this.getNodeParameter('slug', i) as string,
						});
						// check-slug reports availability in the body even when the HTTP status is
						// an error (e.g. 403 for a taken or reserved slug). Surface that as normal
						// output so a workflow can branch on `available`, and only throw on genuine
						// errors that carry no availability information.
						if (typeof result.body.available === 'boolean') {
							responseData = result.body;
						} else if (result.statusCode >= 400) {
							throw new NodeApiError(this.getNode(), result.body as JsonObject, { itemIndex: i });
						} else {
							responseData = result.body;
						}
					} else if (operation === 'getAnalytics') {
						const linkId = this.getNodeParameter('linkId', i) as string;
						const qs: IDataObject = {
							range_days: this.getNodeParameter('rangeDays', i, 30) as number,
							touch_type: this.getNodeParameter('touchType', i, 'short_link_click') as string,
							include_bots: (this.getNodeParameter('includeBots', i, false) as boolean) ? '1' : '0',
						};
						responseData = (await nimrizApiRequest.call(
							this,
							'GET',
							`/api/v1/links/${encodeURIComponent(linkId)}/analytics`,
							{},
							qs,
						)) as IDataObject;
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`Unsupported operation "${operation}" for resource "link".`,
							{ itemIndex: i },
						);
					}
				} else if (resource === 'connection') {
					if (operation === 'create') {
						const accountId = await getNimrizAccountId.call(this);
						const body: IDataObject = {
							account_id: accountId,
							name: this.getNodeParameter('connectionName', i) as string,
							type: this.getNodeParameter('connectionType', i) as string,
							credentials: toJson(
								this.getNodeParameter('connectionCredentials', i, '{}'),
								'Credentials (JSON)',
								i,
							),
							enabled: this.getNodeParameter('connectionEnabled', i, true) as boolean,
						};
						const propertyMapping = toJson(
							this.getNodeParameter('propertyMapping', i, '{}'),
							'Property Mapping (JSON)',
							i,
						);
						if (Object.keys(propertyMapping).length > 0) {
							body.property_mapping = propertyMapping;
						}
						const eventFilter = toJson(
							this.getNodeParameter('eventFilter', i, '{}'),
							'Event Filter (JSON)',
							i,
						);
						if (Object.keys(eventFilter).length > 0) {
							body.event_filter = eventFilter;
						}
						const conn = (await nimrizApiRequest.call(
							this,
							'POST',
							'/api/integrations/destinations',
							body,
						)) as IDataObject;
						responseData = (conn.destination as IDataObject) ?? conn;
					} else if (operation === 'list') {
						const accountId = await getNimrizAccountId.call(this);
						const data = (await nimrizApiRequest.call(
							this,
							'GET',
							'/api/integrations/destinations',
							{},
							{ account_id: accountId },
						)) as IDataObject;
						responseData = (data.destinations as IDataObject[]) ?? [];
					} else if (operation === 'get') {
						const connectionId = this.getNodeParameter('connectionId', i) as string;
						const conn = (await nimrizApiRequest.call(
							this,
							'GET',
							`/api/integrations/destinations/${encodeURIComponent(connectionId)}`,
						)) as IDataObject;
						responseData = (conn.destination as IDataObject) ?? conn;
					} else if (operation === 'update') {
						const connectionId = this.getNodeParameter('connectionId', i) as string;
						const body: IDataObject = {
							name: this.getNodeParameter('connectionName', i) as string,
							type: this.getNodeParameter('connectionType', i) as string,
							credentials: toJson(
								this.getNodeParameter('connectionCredentials', i, '{}'),
								'Credentials (JSON)',
								i,
							),
							enabled: this.getNodeParameter('connectionEnabled', i, true) as boolean,
						};
						const propertyMapping = toJson(
							this.getNodeParameter('propertyMapping', i, '{}'),
							'Property Mapping (JSON)',
							i,
						);
						if (Object.keys(propertyMapping).length > 0) {
							body.property_mapping = propertyMapping;
						}
						const eventFilter = toJson(
							this.getNodeParameter('eventFilter', i, '{}'),
							'Event Filter (JSON)',
							i,
						);
						if (Object.keys(eventFilter).length > 0) {
							body.event_filter = eventFilter;
						}
						const conn = (await nimrizApiRequest.call(
							this,
							'PUT',
							`/api/integrations/destinations/${encodeURIComponent(connectionId)}`,
							body,
						)) as IDataObject;
						responseData = (conn.destination as IDataObject) ?? conn;
					} else if (operation === 'delete') {
						const connectionId = this.getNodeParameter('connectionId', i) as string;
						await nimrizApiRequest.call(
							this,
							'DELETE',
							`/api/integrations/destinations/${encodeURIComponent(connectionId)}`,
						);
						responseData = { success: true, id: connectionId };
					} else if (operation === 'test') {
						const connectionId = this.getNodeParameter('connectionId', i) as string;
						const actionId = this.getNodeParameter('actionId', i, '') as string;
						const body: IDataObject = {};
						if (actionId) {
							body.action_id = actionId;
						}
						responseData = (await nimrizApiRequest.call(
							this,
							'POST',
							`/api/integrations/destinations/${encodeURIComponent(connectionId)}/test-send`,
							body,
						)) as IDataObject;
					} else {
						throw new NodeOperationError(
							this.getNode(),
							`Unsupported operation "${operation}" for resource "connection".`,
							{ itemIndex: i },
						);
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unsupported resource "${resource}".`, {
						itemIndex: i,
					});
				}

				if (Array.isArray(responseData)) {
					for (const entry of responseData) {
						returnData.push({ json: entry, pairedItem: { item: i } });
					}
				} else {
					returnData.push({ json: responseData, pairedItem: { item: i } });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
