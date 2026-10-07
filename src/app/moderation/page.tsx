import { serverClient } from '@/integrations/supabase/server';
import { currentUser } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { SetupNotice } from '@/components/setup-notice';
import { dbCheck } from '@/lib/http';
import { redirect, notFound } from 'next/navigation';
import { ModerateReview } from '@/components/notification-button';
import { sanitizeHtml } from '@/services/markdown';
export default async function Moderation() {
  if (!isConfigured()) return <SetupNotice />;
  if (!(await currentUser())) redirect('/login');
  const db = await serverClient();
  const { data: claims } = await db.auth.getClaims();
  if (!['admin', 'moderator'].includes(claims?.claims.app_metadata?.role)) notFound();
  const [reports, suggestions] = await Promise.all([
    db.from('reports').select('*').order('created_at', { ascending: false }).limit(100),
    db.from('game_suggestions').select('*').order('created_at', { ascending: false }).limit(100),
  ]);
  dbCheck(reports.error);
  dbCheck(suggestions.error);
  const { data: reportedReviews, error: reviewError } = reports.data?.length
    ? await db
        .from('reviews')
        .select('*')
        .in(
          'id',
          reports.data.map((report) => report.review_id),
        )
    : { data: [], error: null };
  dbCheck(reviewError);
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">MODERATION TERMINAL</p>
          <h1>Integridad de la comunidad.</h1>
        </div>
      </div>
      <section className="panel">
        <h2>Reportes</h2>
        {reports.data?.map((report) => (
          <div className="player-row" key={report.id}>
            <p>
              {report.reason}
              <br />
              <code className="muted">{report.review_id}</code>
            </p>
            <ModerateReview id={report.review_id} />
            <details>
              <summary>Ver contenido reportado · puede contener spoilers</summary>
              <div
                className="review-body"
                dangerouslySetInnerHTML={{
                  __html: sanitizeHtml(
                    reportedReviews?.find((review) => review.id === report.review_id)?.content ??
                      '',
                  ),
                }}
              />
            </details>
          </div>
        ))}
        {!reports.data?.length ? <p className="muted">Sin reportes.</p> : null}
      </section>
      <section className="panel">
        <h2>Sugerencias de catálogo</h2>
        {suggestions.data?.map((suggestion) => (
          <div className="log-entry" key={suggestion.id}>
            <strong>{suggestion.title}</strong>
            <p>{suggestion.details}</p>
          </div>
        ))}
        {!suggestions.data?.length ? <p className="muted">Sin sugerencias.</p> : null}
      </section>
    </>
  );
}
