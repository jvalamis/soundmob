export type SecretBinding = { get(): Promise<string> };

export type SecretBindings = {
  youtubeApiKey: string | SecretBinding;
  sessionSecret: string | SecretBinding;
  oauthClientId?: string | SecretBinding;
  oauthClientSecret?: string | SecretBinding;
};

export async function readSecret(
  binding: string | SecretBinding | undefined,
): Promise<string> {
  if (!binding) return "";
  if (typeof binding === "string") return binding;
  const value = await binding.get();
  return value ?? "";
}

export async function loadSecrets(bindings: SecretBindings) {
  const [youtubeApiKey, sessionSecret, oauthClientId, oauthClientSecret] =
    await Promise.all([
      readSecret(bindings.youtubeApiKey),
      readSecret(bindings.sessionSecret),
      readSecret(bindings.oauthClientId),
      readSecret(bindings.oauthClientSecret),
    ]);

  return { youtubeApiKey, sessionSecret, oauthClientId, oauthClientSecret };
}
