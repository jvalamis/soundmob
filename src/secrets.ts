export type SecretBinding = { get(): Promise<string> };

export type SecretBindings = {
  youtubeApiKey: string | SecretBinding;
  sessionSecret: string | SecretBinding;
  oauthClientId?: string | SecretBinding;
  oauthClientSecret?: string | SecretBinding;
  operatorEmail?: string | SecretBinding;
};

export async function readSecret(
  binding: string | SecretBinding | undefined,
): Promise<string> {
  if (!binding) return "";
  if (typeof binding === "string") return binding;
  try {
    const value = await binding.get();
    if (typeof value === "string") return value;
    if (value == null) return "";
    return String(value);
  } catch {
    return "";
  }
}

export async function loadSecrets(bindings: SecretBindings) {
  const [
    youtubeApiKey,
    sessionSecret,
    oauthClientId,
    oauthClientSecret,
    operatorEmail,
  ] = await Promise.all([
    readSecret(bindings.youtubeApiKey),
    readSecret(bindings.sessionSecret),
    readSecret(bindings.oauthClientId),
    readSecret(bindings.oauthClientSecret),
    readSecret(bindings.operatorEmail),
  ]);

  return {
    youtubeApiKey,
    sessionSecret,
    oauthClientId,
    oauthClientSecret,
    operatorEmail,
  };
}
