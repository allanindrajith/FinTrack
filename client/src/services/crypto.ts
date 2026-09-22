/**
 * Zero-Knowledge Client-Side Encryption Layer for FinTrack
 *
 * Uses W3C WebCrypto API (window.crypto.subtle) for hardware-accelerated
 * AES-256-GCM encryption and PBKDF2 key derivation.
 * The server never sees the user's encryption key or plaintext financial data.
 */

export interface EncryptedPayload {
  iv: string; // Base64
  data: string; // Base64
}

export interface PlaintextTransactionData {
  description: string;
  original_description?: string;
  amount: number;
  type: 'debit' | 'credit';
  category_id?: number;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
  raw_data?: string;
  notes?: string;
}

export interface DerivedVaultKeys {
  encryptionKey: CryptoKey;
  authKey: CryptoKey;
  keyFingerprint: string;
}

// In-memory session key cache
let activeVaultKeys: DerivedVaultKeys | null = null;
let activePassphraseCache: string | null = null;

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export const cryptoService = {
  /**
   * Check if the user's encryption vault is currently unlocked in this browser session.
   */
  isVaultUnlocked(): boolean {
    return activeVaultKeys !== null;
  },

  isUnlocked(): boolean {
    return activeVaultKeys !== null;
  },

  getActiveKeys(): DerivedVaultKeys | null {
    return activeVaultKeys;
  },

  getCachedPassphrase(): string | null {
    return activePassphraseCache;
  },

  lockVault(): void {
    activeVaultKeys = null;
    activePassphraseCache = null;
    sessionStorage.removeItem('fintrack_vault_unlocked');
  },

  /**
   * Helper to derive vault keys with deterministic salt based on user email
   */
  async deriveKeyFromPassphrase(passphrase: string, emailOrSalt: string): Promise<DerivedVaultKeys> {
    const enc = new TextEncoder();
    const digest = await window.crypto.subtle.digest('SHA-256', enc.encode(emailOrSalt));
    const saltHex = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return this.deriveKeys(passphrase, saltHex);
  },

  /**
   * Derive AES-256-GCM encryption key and HMAC-SHA256 authentication key
   * using PBKDF2 with 600,000 iterations (OWASP recommendation).
   */
  async deriveKeys(passphrase: string, saltHex: string): Promise<DerivedVaultKeys> {
    const enc = new TextEncoder();
    const passphraseKey = await window.crypto.subtle.importKey(
      'raw',
      enc.encode(passphrase),
      { name: 'PBKDF2' },
      false,
      ['deriveKey', 'deriveBits']
    );

    const saltBytes = hexToBytes(saltHex);

    // 1. Derive 256-bit AES-GCM encryption key
    const encryptionKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes as unknown as BufferSource,
        iterations: 600000,
        hash: 'SHA-256',
      },
      passphraseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    // 2. Derive HMAC key for deterministic blind deduplication hashes
    const authKey = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: saltBytes as unknown as BufferSource,
        iterations: 600000,
        hash: 'SHA-256',
      },
      passphraseKey,
      { name: 'HMAC', hash: 'SHA-256', length: 256 },
      false,
      ['sign']
    );

    // Generate non-sensitive key fingerprint for validation
    const rawFingerprint = await window.crypto.subtle.digest(
      'SHA-256',
      enc.encode(`${passphrase}:${saltHex}:fingerprint`)
    );
    const fingerprintBytes = new Uint8Array(rawFingerprint).slice(0, 8);
    const keyFingerprint = Array.from(fingerprintBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    const keys: DerivedVaultKeys = {
      encryptionKey,
      authKey,
      keyFingerprint,
    };

    activeVaultKeys = keys;
    activePassphraseCache = passphrase;
    sessionStorage.setItem('fintrack_vault_unlocked', 'true');

    return keys;
  },

  /**
   * Encrypt a transaction payload on the client with AES-256-GCM.
   * Returns a compact serialized string: `${iv_base64}:${ciphertext_base64}`
   */
  async encryptTransaction(data: PlaintextTransactionData, key?: CryptoKey): Promise<string> {
    const activeKey = key || activeVaultKeys?.encryptionKey;
    if (!activeKey) {
      throw new Error('Encryption vault is locked. Please unlock with your passphrase.');
    }

    const enc = new TextEncoder();
    const plaintextBytes = enc.encode(JSON.stringify(data));

    // 12-byte random initialization vector
    const iv = window.crypto.getRandomValues(new Uint8Array(12));

    const ciphertextBuffer = await window.crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      activeKey,
      plaintextBytes
    );

    const ivB64 = bufferToBase64(iv);
    const dataB64 = bufferToBase64(ciphertextBuffer);

    return `${ivB64}:${dataB64}`;
  },

  /**
   * Decrypt an encrypted transaction blob with AES-256-GCM.
   */
  async decryptTransaction(
    encryptedBlob: string,
    key?: CryptoKey
  ): Promise<PlaintextTransactionData> {
    const activeKey = key || activeVaultKeys?.encryptionKey;
    if (!activeKey) {
      throw new Error('Encryption vault is locked. Please unlock with your passphrase.');
    }

    const parts = encryptedBlob.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted payload format');
    }

    const [ivB64, dataB64] = parts;
    const iv = base64ToBuffer(ivB64);
    const ciphertext = base64ToBuffer(dataB64);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
      },
      activeKey,
      ciphertext as unknown as BufferSource
    );

    const dec = new TextDecoder();
    const jsonStr = dec.decode(decryptedBuffer);
    return JSON.parse(jsonStr) as PlaintextTransactionData;
  },

  /**
   * High-performance chunked batch decryption.
   * Decrypts encrypted records in concurrent chunks with event-loop yielding
   * to guarantee 60fps UI responsiveness without blocking the main thread.
   */
  async decryptTransactionsBatch<T extends { encrypted_blob: string }>(
    items: T[],
    key?: CryptoKey,
    chunkSize = 50
  ): Promise<Array<{ item: T; plaintext: PlaintextTransactionData | null }>> {
    const activeKey = key || activeVaultKeys?.encryptionKey;
    if (!activeKey) {
      throw new Error('Encryption vault is locked. Please unlock with your passphrase.');
    }

    const results: Array<{ item: T; plaintext: PlaintextTransactionData | null }> = [];

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const chunkResults = await Promise.all(
        chunk.map(async (item) => {
          try {
            if (!item.encrypted_blob) return { item, plaintext: null };
            const plaintext = await this.decryptTransaction(item.encrypted_blob, activeKey);
            return { item, plaintext };
          } catch {
            return { item, plaintext: null };
          }
        })
      );
      results.push(...chunkResults);

      // Yield briefly to event loop between chunks if dataset is large
      if (items.length > chunkSize && i + chunkSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return results;
  },

  /**
   * Compute a deterministic blind deduplication hash via HMAC-SHA256:
   * HMAC(authKey, date + '|' + amount + '|' + normalized_description)
   * The server compares this hash to skip duplicates without knowing the amount or description!
   */
  async computeBlindHash(
    date: string,
    amount: number,
    description: string,
    key?: CryptoKey
  ): Promise<string> {
    const authKey = key || activeVaultKeys?.authKey;
    if (!authKey) {
      throw new Error('Encryption vault is locked.');
    }

    const normalizedDesc = description.trim().toUpperCase().replace(/\s+/g, ' ');
    const rawInput = `${date}|${amount.toFixed(2)}|${normalizedDesc}`;

    const enc = new TextEncoder();
    const signatureBuffer = await window.crypto.subtle.sign(
      'HMAC',
      authKey,
      enc.encode(rawInput)
    );

    const bytes = new Uint8Array(signatureBuffer);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  },
};
