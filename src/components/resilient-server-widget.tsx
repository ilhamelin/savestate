import 'server-only';
import type { ReactNode } from 'react';

/** Handles optional loader failures. Descendant render failures belong to the stream boundary. */
export async function ResilientServerWidget({ load, widgetName }: {
  load: () => ReactNode | Promise<ReactNode>;
  widgetName: string;
}) {
  try { return await load(); }
  catch {
    console.warn('Optional game widget unavailable:', widgetName);
    return null;
  }
}
