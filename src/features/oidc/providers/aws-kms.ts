import { CloudKmsProvider } from './types.js';
import { decryptWithAwsKms } from './aws.js';

export class AwsKmsProvider implements CloudKmsProvider {
  readonly name = 'aws';

  /**
   * @param roleArn - The ARN of the IAM role to assume (VAULT_AWS_ROLE_ARN)
   * @param ciphertextBase64 - The base64-encoded KMS ciphertext (VAULT_KMS_CIPHERTEXT)
   */
  constructor(
    private readonly roleArn: string,
    private readonly ciphertextBase64: string
  ) {}

  async decrypt(jwt: string): Promise<Uint8Array> {
    return decryptWithAwsKms(jwt, this.roleArn, this.ciphertextBase64);
  }
}
