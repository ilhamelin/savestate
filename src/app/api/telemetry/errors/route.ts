import { knownDependencyFailure } from '@/domain/dependency-monitor';
import { getSystemHealthReport } from '@/services/dependency-monitor-service';
import { body, sameOrigin, errorResponse, AppError } from '@/lib/http';
import { uuid, object } from '@/domain/validation';
import { authenticatedAdmin } from '@/lib/session';
import { sanitizeTelemetry, sanitizeSupportTicket } from '@/services/support-sanitize';
import { supportStore, claimSupportAttempt } from '@/services/support-store';
import { createSupportTicket, retrySupportQueue } from '@/services/jira-support-service';
export const runtime = 'nodejs';
export const maxDuration = 40;
export async function GET() {
  try {
    await authenticatedAdmin();
    const [events, tickets] = await Promise.all([supportStore.events(), supportStore.list()]);
    return Response.json(
      {
        events: events.map((event) => {
          const ticket = tickets.find((row) => row.telemetry_id === event.id);
          return {
            ...event,
            escalatedToJira: Boolean(ticket),
            jiraIssueKey: ticket?.jira_issue_key ?? null,
          };
        }),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const raw = object(await body(request, 16000));
    if (raw.action === 'retry' || raw.action === 'escalate') {
      await authenticatedAdmin();
      await claimSupportAttempt(request, 'support');
      if (raw.action === 'retry')
        return Response.json(await retrySupportQueue(), {
          headers: { 'Cache-Control': 'no-store' },
        });
      const id = uuid(raw.id);
      const event = (await supportStore.events()).find((item) => item.id === id);
      if (!event) throw new AppError('Este incidente ya no está en el buffer.', 404);
      const outage = knownDependencyFailure(event.message, await getSystemHealthReport(false));
      if (outage)
        throw new AppError(
          'La sonda de ' +
            outage +
            ' indica una incidencia externa. El evento permanece en la bitácora; reintenta la escalada cuando se restablezca.',
          409,
        );
      const input = sanitizeSupportTicket({
        type: 'bug',
        title: ('Error web: ' + event.message).slice(0, 200),
        description: [
          event.message,
          event.stack,
          'Ruta: ' + event.pathname,
          'Detectado: ' + event.timestamp,
          'Navegador: ' + event.userAgent,
        ]
          .filter(Boolean)
          .join('\n\n'),
        pageUrl: event.pathname,
      });
      return Response.json(
        { data: await createSupportTicket(input, id) },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    if (raw.action !== undefined) throw new AppError('Acción no válida.', 400);
    await claimSupportAttempt(request, 'telemetry');
    await supportStore.record(sanitizeTelemetry(raw));
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return errorResponse(error);
  }
}
