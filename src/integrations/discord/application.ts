import { DISCORD_SLASH_COMMANDS } from '../../domain/discord-commands.ts';
import { DISCORD_ROLE_METADATA } from '../../domain/discord-linked-roles.ts';
export async function registerDiscordApplication(id: string, token: string) {
  if (!/^\d{16,22}$/.test(id) || !token)
    throw new Error('Configura DISCORD_APPLICATION_ID y DISCORD_BOT_TOKEN.');
  const request = async (path: string, method = 'GET', body?: unknown) => {
    const response = await fetch(`https://discord.com/api/v10/${path}`, {
      method,
      headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(7000),
      redirect: 'error',
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Discord rechazó la configuración (${response.status}).`);
    return (await response.json()) as unknown;
  };
  const application = (await request('oauth2/applications/@me')) as { id?: string };
  if (application.id !== id)
    throw new Error('El token del bot no corresponde a la aplicación configurada.');
  const [existingCommands, existingMetadata] = await Promise.all([
    request(`applications/${id}/commands`),
    request(`applications/${id}/role-connections/metadata`),
  ]);
  if (!Array.isArray(existingCommands) || !Array.isArray(existingMetadata))
    throw new Error('Discord devolvió una configuración inválida.');
  const commandNames = new Set(DISCORD_SLASH_COMMANDS.map((command) => command.name));
  const commands = [
    ...existingCommands
      .filter(
        (command) =>
          command &&
          typeof command === 'object' &&
          (!commandNames.has(command.name) || command.type !== 1),
      )
      .map((command) =>
        Object.fromEntries(
          Object.entries(command).filter(([key]) =>
            [
              'id',
              'name',
              'type',
              'description',
              'options',
              'default_member_permissions',
              'nsfw',
              'contexts',
              'integration_types',
              'name_localizations',
              'description_localizations',
            ].includes(key),
          ),
        ),
      ),
    ...DISCORD_SLASH_COMMANDS,
  ];
  const keys = new Set(DISCORD_ROLE_METADATA.map((metadata) => metadata.key));
  const metadata = [
    ...existingMetadata.filter(
      (entry) => entry && typeof entry === 'object' && !keys.has(entry.key),
    ),
    ...DISCORD_ROLE_METADATA,
  ];
  if (metadata.length > 5)
    throw new Error(
      'La aplicación ya tiene metadatos adicionales; Discord admite hasta cinco. Revisa la configuración antes de reemplazarlos.',
    );
  await request(`applications/${id}/role-connections/metadata`, 'PUT', metadata);
  await request(`applications/${id}/commands`, 'PUT', commands);
  return { commands: commands.length, metadata: metadata.length };
}
