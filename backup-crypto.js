"use strict";

const BackupCrypto = (() => {
  const FORMAT = "pocket-budget-encrypted-backup";
  const FORMAT_VERSION = 1;
  const DEFAULT_ITERATIONS = 600000;
  const MAX_ALLOWED_ITERATIONS = 2000000;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  function isAvailable() {
    return Boolean(globalThis.isSecureContext && globalThis.crypto?.subtle && globalThis.crypto?.getRandomValues);
  }

  function bytesToBase64(bytes) {
    let binary = "";
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length));
      binary += String.fromCharCode(...chunk);
    }

    return btoa(binary);
  }

  function base64ToBytes(value) {
    if (typeof value !== "string" || value.length === 0) {
      throw new Error("The encrypted backup contains invalid data.");
    }

    let binary;
    try {
      binary = atob(value);
    } catch (_) {
      throw new Error("The encrypted backup contains invalid base64 data.");
    }

    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function validatePassword(password) {
    if (typeof password !== "string" || password.length === 0) {
      throw new Error("A backup password is required.");
    }
    if (password.length > 256) {
      throw new Error("The backup password is too long.");
    }
  }

  function buildAdditionalData(iterations) {
    return encoder.encode([
      "Pocket Budget",
      FORMAT,
      FORMAT_VERSION,
      "PBKDF2",
      "SHA-256",
      iterations,
      "AES-GCM",
      256,
      128
    ].join("|"));
  }

  async function deriveKey(password, salt, iterations) {
    validatePassword(password);

    const passwordMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(password),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt,
        iterations
      },
      passwordMaterial,
      {
        name: "AES-GCM",
        length: 256
      },
      false,
      ["encrypt", "decrypt"]
    );
  }

  function assertAvailable() {
    if (!isAvailable()) {
      throw new Error("Encrypted backups require HTTPS or localhost in a supported browser.");
    }
  }

  async function encryptBackup(data, password) {
    assertAvailable();
    validatePassword(password);

    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("There is no valid Pocket Budget data to encrypt.");
    }

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const iterations = DEFAULT_ITERATIONS;
    const key = await deriveKey(password, salt, iterations);
    const plaintext = encoder.encode(JSON.stringify(data));

    const encrypted = await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv,
        additionalData: buildAdditionalData(iterations),
        tagLength: 128
      },
      key,
      plaintext
    );

    return {
      app: "Pocket Budget",
      format: FORMAT,
      formatVersion: FORMAT_VERSION,
      encryptedAt: new Date().toISOString(),
      keyDerivation: {
        name: "PBKDF2",
        hash: "SHA-256",
        iterations,
        salt: bytesToBase64(salt)
      },
      encryption: {
        name: "AES-GCM",
        keyLength: 256,
        tagLength: 128,
        iv: bytesToBase64(iv)
      },
      ciphertext: bytesToBase64(new Uint8Array(encrypted))
    };
  }

  function validateEncryptedContainer(container) {
    if (!container || typeof container !== "object") {
      throw new Error("This is not a supported encrypted Pocket Budget backup.");
    }

    if (container.format !== FORMAT || Number(container.formatVersion) !== FORMAT_VERSION) {
      throw new Error("This is not a supported encrypted Pocket Budget backup.");
    }

    if (
      container.keyDerivation?.name !== "PBKDF2" ||
      container.keyDerivation?.hash !== "SHA-256" ||
      container.encryption?.name !== "AES-GCM" ||
      Number(container.encryption?.keyLength) !== 256 ||
      Number(container.encryption?.tagLength) !== 128
    ) {
      throw new Error("The backup uses unsupported encryption settings.");
    }

    const iterations = Number(container.keyDerivation?.iterations);
    if (!Number.isInteger(iterations) || iterations < 100000 || iterations > MAX_ALLOWED_ITERATIONS) {
      throw new Error("The backup has invalid password-derivation settings.");
    }

    return iterations;
  }

  async function decryptBackup(container, password) {
    assertAvailable();
    validatePassword(password);

    const iterations = validateEncryptedContainer(container);
    const salt = base64ToBytes(container.keyDerivation.salt);
    const iv = base64ToBytes(container.encryption.iv);
    const ciphertext = base64ToBytes(container.ciphertext);

    if (salt.length !== 16 || iv.length !== 12 || ciphertext.length < 17) {
      throw new Error("The encrypted backup is incomplete or damaged.");
    }

    try {
      const key = await deriveKey(password, salt, iterations);
      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv,
          additionalData: buildAdditionalData(iterations),
          tagLength: 128
        },
        key,
        ciphertext
      );

      const data = JSON.parse(decoder.decode(decrypted));
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("The decrypted backup does not contain valid Pocket Budget data.");
      }
      return data;
    } catch (error) {
      if (error instanceof SyntaxError || /valid Pocket Budget data/.test(String(error?.message || ""))) {
        throw error;
      }
      throw new Error("Unable to decrypt the backup. The password may be incorrect, or the file may be damaged.");
    }
  }

  function isEncryptedBackup(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      value.format === FORMAT &&
      Number(value.formatVersion) === FORMAT_VERSION
    );
  }

  return {
    encryptBackup,
    decryptBackup,
    isEncryptedBackup,
    isAvailable,
    format: FORMAT,
    formatVersion: FORMAT_VERSION
  };
})();
