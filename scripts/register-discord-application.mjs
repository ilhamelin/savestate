import { registerDiscordApplication } from '../src/integrations/discord/application.ts';
try {
  const result = await registerDiscordApplication(
    process.env.DISCORD_APPLICATION_ID ?? '',
    process.env.DISCORD_BOT_TOKEN ?? '',
  );
  console.log(`Discord configurado: ${result.commands} comandos, ${result.metadata} metadatos.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'No se pudo configurar Discord.');
  process.exitCode = 1;
}
