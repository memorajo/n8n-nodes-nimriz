import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	IHttpRequestOptions,
	ILoadOptionsFunctions,
	JsonObject,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

export const NIMRIZ_API_BASE = 'https://api.nimriz.com';

/**
 * Make an authenticated request to the Nimriz API. Authentication (the Bearer
 * header) is injected by the `nimrizApi` credential's `authenticate` block.
 */
export async function nimrizApiRequest(
	this: IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
): Promise<any> {
	const options: IHttpRequestOptions = {
		method,
		url: `${NIMRIZ_API_BASE}${endpoint}`,
		json: true,
	};
	if (Object.keys(body).length > 0) {
		options.body = body;
	}
	if (Object.keys(qs).length > 0) {
		options.qs = qs;
	}
	try {
		return await this.helpers.httpRequestWithAuthentication.call(this, 'nimrizApi', options);
	} catch (error) {
		throw new NodeApiError(this.getNode(), error as JsonObject);
	}
}

/**
 * Like nimrizApiRequest, but does not throw on HTTP error statuses — returns the
 * status code and parsed body so the caller can inspect error bodies. Used by
 * check-slug, which reports availability in the body even on a 403 (taken/reserved).
 */
export async function nimrizApiRequestAllowError(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
): Promise<{ statusCode: number; body: IDataObject }> {
	const options: IHttpRequestOptions = {
		method,
		url: `${NIMRIZ_API_BASE}${endpoint}`,
		json: true,
		returnFullResponse: true,
		ignoreHttpStatusErrors: true,
	};
	if (Object.keys(body).length > 0) {
		options.body = body;
	}
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'nimrizApi', options)) as {
		statusCode: number;
		body: unknown;
	};
	return { statusCode: response.statusCode, body: (response.body ?? {}) as IDataObject };
}

/**
 * Resolve the workspace account id for the authenticated API key. Used by the
 * Connection operations, whose API requires an explicit account id.
 */
export async function getNimrizAccountId(
	this: IExecuteFunctions | ILoadOptionsFunctions,
): Promise<string> {
	const whoami = (await nimrizApiRequest.call(this, 'GET', '/api/v1/whoami')) as IDataObject;
	const accountId = whoami.account_id as string | undefined;
	if (!accountId) {
		throw new NodeOperationError(
			this.getNode(),
			'Could not resolve the workspace account from the provided API key.',
		);
	}
	return accountId;
}
