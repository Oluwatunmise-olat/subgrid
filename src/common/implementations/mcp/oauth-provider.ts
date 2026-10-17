import crypto from "crypto";
import {
  OAuthClientProvider,
  OAuthDiscoveryState,
} from "@modelcontextprotocol/sdk/client/auth.js";
import {
  OAuthClientInformationMixed,
  OAuthClientMetadata,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";

import { OAuthConnectionsRepository } from "@/repositories";
import { OAuthConnectionType } from "@/models/oauth-connection.model";
import { encryptJson, decryptJson } from "@/common/utils/encrypt-decrypt";
import { app } from "@/conf/env";

export class SubgridOAuthProvider implements OAuthClientProvider {
  public capturedAuthorizeUrl: string | null = null;

  constructor(
    private readonly mcpServerId: string,
    private readonly oauthConnectionsRepository: OAuthConnectionsRepository,
  ) {}

  get redirectUrl(): string {
    return `${app.url}/api/v1/mcp-servers/${this.mcpServerId}/oauth/callback`;
  }

  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: "Subgrid",
      redirect_uris: [this.redirectUrl],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "client_secret_post",
    };
  }

  private async getRow(): Promise<OAuthConnectionType> {
    return await this.oauthConnectionsRepository.getOrCreateForServer(
      this.mcpServerId,
    );
  }

  public async state(): Promise<string> {
    const value = crypto.randomBytes(24).toString("base64url");

    const row = await this.getRow();

    await this.oauthConnectionsRepository.update(
      { id: row.id },
      {
        oauth_state: value,
      },
    );

    return value;
  }

  public async clientInformation(): Promise<
    OAuthClientInformationMixed | undefined
  > {
    const row = await this.getRow();

    if (
      !row.client_info_cipher ||
      !row.client_info_nonce ||
      !row.client_info_tag
    )
      return undefined;

    return decryptJson<OAuthClientInformationMixed>({
      cipher_text: row.client_info_cipher,
      nonce: row.client_info_nonce,
      tag: row.client_info_tag,
    });
  }

  public async saveClientInformation(
    clientInformation: OAuthClientInformationMixed,
  ) {
    const encrypted = encryptJson(clientInformation);

    const row = await this.getRow();

    await this.oauthConnectionsRepository.update(
      { id: row.id },
      {
        client_info_cipher: encrypted.cipher_text,
        client_info_nonce: encrypted.nonce,
        client_info_tag: encrypted.tag,
        ...("issuer" in clientInformation && (clientInformation as any).issuer
          ? { issuer: (clientInformation as any).issuer }
          : {}),
      },
    );
  }

  public async tokens() {
    const row = await this.getRow();

    if (!row.tokens_cipher || !row.tokens_nonce || !row.tokens_tag)
      return undefined;

    return decryptJson<OAuthTokens>({
      cipher_text: row.tokens_cipher,
      nonce: row.tokens_nonce,
      tag: row.tokens_tag,
    });
  }

  public async saveTokens(tokens: OAuthTokens) {
    const encrypted = encryptJson(tokens);

    const row = await this.getRow();

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await this.oauthConnectionsRepository.update(
      { id: row.id },
      {
        tokens_cipher: encrypted.cipher_text,
        tokens_nonce: encrypted.nonce,
        tokens_tag: encrypted.tag,
        token_expires_at: expiresAt,
      },
    );
  }

  public redirectToAuthorization(authorizationUrl: URL): void {
    this.capturedAuthorizeUrl = authorizationUrl.toString();
  }

  public async saveCodeVerifier(codeVerifier: string): Promise<void> {
    const row = await this.getRow();

    await this.oauthConnectionsRepository.update(
      { id: row.id },
      { code_verifier: codeVerifier },
    );
  }

  public async codeVerifier(): Promise<string> {
    const row = await this.getRow();

    if (!row.code_verifier) {
      throw new Error(
        "No PKCE code verifier on file - the authorization flow was not started from here",
      );
    }

    return row.code_verifier;
  }

  public async saveDiscoveryState(state: OAuthDiscoveryState): Promise<void> {
    const row = await this.getRow();

    await this.oauthConnectionsRepository.update(
      { id: row.id },
      {
        discovery_state: state as unknown as Record<string, any>,
        issuer: state.authorizationServerUrl,
      },
    );
  }

  public async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    const row = await this.getRow();

    return (row.discovery_state as unknown as OAuthDiscoveryState) || undefined;
  }

  public async clearTransientState(): Promise<void> {
    const row = await this.getRow();

    await this.oauthConnectionsRepository.update(
      { id: row.id },
      {
        code_verifier: null,
        oauth_state: null,
      },
    );
  }

  public async getStoredState(): Promise<string | null> {
    const row = await this.getRow();

    return row.oauth_state;
  }

  public async isConnected(): Promise<boolean> {
    const tokens = await this.tokens();

    return Boolean(tokens?.access_token);
  }

  public async disconnect(): Promise<void> {
    const row = await this.getRow();

    await this.oauthConnectionsRepository.update(
      { id: row.id },
      {
        client_info_cipher: null,
        client_info_nonce: null,
        client_info_tag: null,
        tokens_cipher: null,
        tokens_nonce: null,
        tokens_tag: null,
        token_expires_at: null,
        code_verifier: null,
        oauth_state: null,
        discovery_state: null,
        issuer: null,
      },
    );
  }
}
