import 'server-only';
import DOMPurify from 'isomorphic-dompurify';
import { object, text } from '@/domain/validation';
import { validateSupportTicket, validateTelemetry } from '@/domain/support-ticket';

export function cleanSupportText(value: unknown, max: number): string {
  return DOMPurify.sanitize(text(value, 'Texto', max, 0), {
    ALLOWED_TAGS: [], ALLOWED_ATTR: [],
  }).trim();
}
export function sanitizeSupportTicket(raw: unknown) {
  const data = object(raw);
  const context = data.systemContext === undefined ? null : object(data.systemContext);
  return validateSupportTicket({
    ...data,
    title: cleanSupportText(data.title, 2000),
    description: cleanSupportText(data.description, 16000),
    contactEmail: data.contactEmail ? cleanSupportText(data.contactEmail, 500) : null,
    // A public report cannot impersonate a SaveState account.
    username: null,
    systemContext: context ? {
      userAgent: cleanSupportText(context.userAgent, 600),
      ...(context.screenResolution === undefined ? {} : {
        screenResolution: cleanSupportText(context.screenResolution, 60),
      }),
      ...(context.theme === undefined ? {} : { theme: cleanSupportText(context.theme, 60) }),
    } : undefined,
  });
}
export function sanitizeTelemetry(raw: unknown) {
  const data = object(raw);
  return validateTelemetry({
    ...data,
    message: cleanSupportText(data.message, 2000),
    ...(data.stack === undefined ? {} : { stack: cleanSupportText(data.stack, 6000) }),
    userAgent: cleanSupportText(data.userAgent ?? '', 600),
  });
}
