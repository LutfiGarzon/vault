export interface CloudKmsProvider {
  /** Human-readable name for error messages */
  readonly name: string;

  /**
   * Decrypt a ciphertext using the OIDC JWT as authentication.
   * Each implementation reads its required configuration from environment variables.
   */
  decrypt(jwt: string): Promise<Uint8Array>;
}
