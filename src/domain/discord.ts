import { createPublicKey, verify } from 'node:crypto';
export * from './discord-client.ts';
export * from './discord-linked-roles.ts';
export function verifyDiscordInteractionSignature(
  rawBody: string,
  signature: string,
  timestamp: string,
  publicKeyHex: string,
): boolean {
  if (
    !/^[a-f0-9]{128}$/i.test(signature) ||
    !/^[a-f0-9]{64}$/i.test(publicKeyHex) ||
    !timestamp ||
    timestamp.length > 64
  )
    return false;
  try {
    const key = createPublicKey({
      key: Buffer.from('302a300506032b6570032100' + publicKeyHex, 'hex'),
      format: 'der',
      type: 'spki',
    });
    return verify(
      null,
      Buffer.from(timestamp + rawBody, 'utf8'),
      key,
      Buffer.from(signature, 'hex'),
    );
  } catch {
    return false;
  }
}
