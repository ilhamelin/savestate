import Link from 'next/link';
import { LegalContact } from '@/components/legal-contact';

export const metadata = { title: 'Términos de Servicio y Safe Harbor · SaveState' };
export default function TermsPage() {
  return (
    <article className="legal-page legal-container">
      <header>
        <p className="eyebrow">SAVESTATE // LEGAL PROTOCOL</p>
        <h1>Términos de Servicio y Política de Uso Aceptable</h1>
        <p>
          Vigencia: <time dateTime="2026-10-14">14 de octubre de 2026</time>. Marco principal:
          República de Chile; referencias internacionales DMCA cuando correspondan.
        </p>
      </header>
      <section className="legal-section" aria-labelledby="terms-accounts">
        <h2 id="terms-accounts">1. Aceptación y cuentas</h2>
        <p>
          Al utilizar SaveState aceptas estas condiciones. Es un proyecto comunitario gratuito de
          carácter no comercial para registrar partidas y participar en conversaciones. Debes
          proporcionar datos de cuenta legítimos, custodiar tus credenciales y avisar de accesos no
          autorizados. No compartas tokens ni suplantes identidades.
        </p>
        <p>
          Las integraciones de terceros mantienen sus propias condiciones. Podemos limitar cuentas
          que incumplan estas reglas, con revisión de los antecedentes y sin afectar derechos
          irrenunciables.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="terms-content">
        <h2 id="terms-content">2. Contenido generado por el usuario</h2>
        <p>
          Eres responsable del texto, imágenes, GIFs y enlaces que publiques en Chat Global, foros,
          Momentos y demás espacios. Debes tener los derechos o autorizaciones necesarios. Conservas
          tus derechos y otorgas a SaveState una licencia limitada, no exclusiva y gratuita para
          alojar, reproducir técnicamente y mostrar ese contenido al público o destinatarios que
          elijas, durante el tiempo necesario para prestar el servicio.
        </p>
        <p>
          El chat enlazado a Discord transmite mensajes y archivos al canal seleccionado. Los
          espacios públicos pueden ser vistos y copiados por otras personas; una eliminación en
          SaveState no garantiza borrar copias externas.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="terms-aup">
        <h2 id="terms-aup">3. Política de Uso Aceptable (AUP)</h2>
        <p>
          Se prohíbe publicar material ilícito o que infrinja derechos de autor; amenazas,
          difamación, acoso o discriminación; datos privados de otras personas sin autorización
          (doxxing); malware, phishing, credenciales, spam y contenido de explotación sexual. No
          eludas controles de acceso ni ataques la infraestructura o las cuentas de otros usuarios.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="terms-takedown">
        <h2 id="terms-takedown">4. Notificación y retirada · Safe Harbor</h2>
        <p>
          SaveState facilita alojamiento y comunicación como intermediario técnico. Revisaremos con
          prontitud los reportes de contenido presuntamente infractor y, cuando corresponda,
          retiraremos o inhabilitaremos su acceso. Cumpliremos las resoluciones de autoridades
          competentes y las obligaciones aplicables.
        </p>
        <p>
          La Ley N° 20.435 modificó la Ley N° 17.336, incluidos sus artículos 85 L y siguientes. La
          DMCA, Título 17 U.S.C. § 512, contempla un régimen distinto sujeto a requisitos
          específicos. Esta política de Notice and Takedown no afirma un registro de agente DMCA ni
          garantiza por sí sola protección Safe Harbor o una exención general de responsabilidad.
        </p>
        <LegalContact />
        <p>
          Para reportar, identifica la obra o derecho afectado, las URLs concretas del contenido, el
          motivo de la reclamación, tu calidad de titular o representante y un medio de respuesta.
          Incluye una declaración de buena fe, exactitud y firma. No adjuntes datos personales
          innecesarios. Podemos solicitar aclaraciones, conservar evidencia necesaria y comunicar la
          medida al autor, que podrá pedir revisión y aportar autorización o antecedentes. La
          eventual restitución se evaluará conforme al régimen aplicable; los reportes abusivos
          también pueden revisarse.
        </p>
        <p>
          Consulta las fuentes oficiales:{' '}
          <a
            href="https://www.bcn.cl/leychile/navegar?idNorma=1012827"
            target="_blank"
            rel="noopener noreferrer"
          >
            Ley 20.435
          </a>{' '}
          y{' '}
          <a href="https://www.copyright.gov/512/" target="_blank" rel="noopener noreferrer">
            DMCA § 512
          </a>
          .
        </p>
      </section>
      <section className="legal-section" aria-labelledby="terms-ip">
        <h2 id="terms-ip">5. Propiedad intelectual y marcas de terceros</h2>
        <p>
          Los nombres de juegos, logos, carátulas, personajes y marcas pertenecen a sus respectivos
          titulares, incluidos Riot Games, Valve Corporation, Nintendo, Sony, Microsoft,
          Take-Two/Rockstar Games y Disney/Marvel. SaveState no está afiliado, respaldado ni
          patrocinado por esas compañías.
        </p>
        <p>
          Las referencias tienen finalidad informativa y cultural de identificación nominativa. El
          uso legítimo nominativo y el Fair Use dependen del caso y de la legislación aplicable; no
          constituyen una autorización universal para reutilizar obras. Deben respetarse las
          licencias, políticas de API y derechos de sus titulares.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="terms-liability">
        <h2 id="terms-liability">6. Garantías y jurisdicción</h2>
        <p>
          El servicio se ofrece según disponibilidad. No garantizamos continuidad, exactitud de
          estadísticas, tipos de cambio, ofertas ni disponibilidad de contenido de terceros. Las
          limitaciones de responsabilidad rigen únicamente hasta donde lo permita la ley y no
          excluyen obligaciones ni derechos irrenunciables.
        </p>
        <p>
          Se aplican las leyes de la República de Chile. Las controversias corresponderán a los
          tribunales ordinarios de Santiago cuando resulte legalmente procedente, sin desconocer
          reglas imperativas de competencia o protección de las personas usuarias.
        </p>
      </section>
      <Link href="/privacy">Consultar Política de Privacidad →</Link>
    </article>
  );
}
