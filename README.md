# n8n-nodes-nimriz

This is an n8n community node. It lets you use [Nimriz](https://nimriz.com) in your n8n workflows.

Nimriz is a link management platform for creating and managing short links, tracking clicks and QR scans, and forwarding link events to your analytics and automation stack.

[Installation](#installation) · [Credentials](#credentials) · [Operations](#operations) · [Triggers](#triggers) · [Resources](#resources)

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

On self-hosted n8n you can install it from **Settings → Community Nodes** using the package name `n8n-nodes-nimriz`, or with npm in your n8n root:

```bash
npm install n8n-nodes-nimriz
```

Restart your n8n instance. The **Nimriz** and **Nimriz Trigger** nodes then appear in the nodes panel.

## Credentials

Authentication can use Nimriz OAuth2 or a Nimriz **Workspace API key**.

- For OAuth2, add a **Nimriz OAuth2 API** credential and enter the Client ID and Client Secret supplied for your n8n callback URL.
- For API-key auth, create a key in your Nimriz dashboard under **Settings → Integrations → API access**, then add a **Nimriz API** credential in n8n and paste the key.

Use the **Test** button to confirm the credential is valid. The credential is checked against `GET /api/v1/whoami`.

## Operations

### Link

- **Create** - create a short link.
- **Get** - get a single link by ID.
- **Find** - find a link by its short URL.
- **List** - list recent links in the workspace.
- **Update Slug** - change a link's slug.
- **Update Destination** - change a link's destination URL.
- **Update Password** - set or remove a link's password.
- **Update Expiration** - set, change, or remove a link's expiration.
- **Check Slug** - check whether a slug is available on a domain.
- **Get Analytics** - get click and scan analytics for a link.

### Connection

Manage outbound integration connections (analytics/CDP/webhook destinations).

- **Create**, **List**, **Get**, **Update**, **Delete**, **Test** - manage and test-send outbound connections.

## Triggers

The **Nimriz Trigger** node starts a workflow when a Nimriz event fires. It registers a webhook in your workspace for the selected event:

- **Link Created**
- **Link Updated**
- **Link Takedown Updated**
- **Domain Verification Updated**
- **Link Clicked**
- **QR Code Scanned**

## Resources

- [Nimriz n8n integration docs](https://nimriz.com/docs/integrations/n8n)
- [n8n community nodes documentation](https://docs.n8n.io/integrations/#community-nodes)

## License

[MIT](LICENSE.md)
