import Link from 'next/link';
import { LegalContact } from '@/components/legal-contact';

export const metadata = { title: 'Política de Privacidad y Datos · SaveState' };
export default function PrivacyPage() {
  return (
    <article className="legal-page legal-container">
      <header>
        <p className="eyebrow">SAVESTATE // DATA PRIVACY</p>
        <h1>Política de Privacidad y Protección de Datos Personales</h1>
        <p>
          Actualizada: <time dateTime="2026-10-14">14 de octubre de 2026</time>. La administración
          de SaveState gestiona el tratamiento descrito en esta política.
        </p>
        <p>
          Marco chileno vigente: Ley N° 19.628. La reforma es la Ley N° 21.719, publicada en 2024,
          con entrada en vigor el 1 de diciembre de 2026. Tomamos como referencia principios de
          minimización, transparencia y seguridad del GDPR, que se aplica cuando corresponda por su
          ámbito territorial; no afirmamos una certificación de cumplimiento.
        </p>
      </header>
      <section className="legal-section" aria-labelledby="privacy-data">
        <h2 id="privacy-data">1. Datos que recopilamos</h2>
        <p>
          Tratamos correo electrónico, nombre de usuario, perfil y los datos que entregues
          voluntariamente. Supabase Auth gestiona la autenticación y el hash de la contraseña cuando
          usas ese método; SaveState no necesita leer tu contraseña en texto claro. Al vincular o
          consultar cuentas podemos tratar SteamID64, Discord ID, Riot PUUID, PSN ID, Gamertag y
          estadísticas públicas de esas plataformas.
        </p>
        <p>
          La bitácora incluye juegos, sesiones, horas, reseñas, listas, progreso de cine y series y
          seguimiento de estrenos. Los espacios comunitarios contienen los mensajes, enlaces y
          archivos que publiques. La infraestructura puede procesar datos técnicos necesarios para
          atender solicitudes, proteger el servicio y diagnosticar errores.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="privacy-purpose">
        <h2 id="privacy-purpose">2. Finalidad y destinatarios</h2>
        <p>
          Usamos estos datos para autenticarte, mantener tu bitácora, mostrar telemetría, gestionar
          amistades y permitir comunicación comunitaria. Las vinculaciones y funciones opcionales se
          activan a tu solicitud. Debes evitar compartir datos de otras personas sin autorización.
        </p>
        <div className="legal-highlight-box">
          SaveState NO comercializa, vende, arrienda ni cede datos personales a terceros para
          publicidad o marketing.
        </div>
        <p>
          Supabase y Vercel procesan información para operar la plataforma y pueden hacerlo fuera de
          Chile. Las integraciones elegidas, como Discord, reciben los datos necesarios para la
          acción: publicar en el chat transmite el mensaje y adjuntos; sincronizar Roles Vinculados
          comunica usuario y conteos, incluso de biblioteca privada, según el aviso de esa función.
        </p>
        <p>
          El nombre y avatar del perfil y las publicaciones públicas pueden ser visibles para otros.
          Los controles de privacidad limitan las secciones correspondientes; las notas privadas de
          Screen y el acceso al canal privado tienen controles específicos. No confundas un enlace
          externo o un mensaje público de Discord con almacenamiento privado.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="privacy-security">
        <h2 id="privacy-security">3. Infraestructura, conservación y seguridad</h2>
        <p>
          Supabase proporciona autenticación, PostgreSQL y almacenamiento; Vercel aloja la
          aplicación. Usamos políticas Row Level Security (RLS), validación de sesiones, controles
          de permisos y credenciales de integración confinadas al servidor (server-only). Las
          comunicaciones usan HTTPS/TLS según la configuración de cada proveedor; no garantizamos
          una versión TLS única en todos los clientes o servicios externos.
        </p>
        <p>
          Conservamos los datos mientras sean necesarios para la cuenta y las funciones solicitadas.
          Al tramitar una supresión eliminaremos o anonimizaremos lo que corresponda, salvo
          conservación legal o de seguridad justificada. Las copias de respaldo y los mensajes ya
          entregados a terceros pueden estar sujetos a ciclos y políticas propios. Ningún sistema
          elimina por completo el riesgo de acceso no autorizado.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="privacy-rights">
        <h2 id="privacy-rights">4. Derechos ARCO y eliminación de cuenta</h2>
        <p>
          Puedes solicitar Acceso, Rectificación, Cancelación y Oposición (derechos ARCO), incluida
          la supresión de tu cuenta y sus datos asociados conforme a la ley. Para rectificar tu
          perfil utiliza <Link href="/settings">Ajustes</Link>. La eliminación completa se solicita
          al contacto de la administración; actualmente no existe un botón automático de eliminación
          de cuenta en Ajustes.
        </p>
        <LegalContact />
        <p>
          Indica tu usuario, el derecho solicitado y los datos afectados. Verificaremos tu identidad
          de forma proporcional, preferentemente mediante el correo de la cuenta; nunca necesitamos
          tu contraseña. Informaremos de la gestión, de las limitaciones legales que procedan y de
          los recursos aplicables. No publiques la solicitud ni documentos personales en el chat
          público.
        </p>
      </section>
      <section className="legal-section" aria-labelledby="privacy-cookies">
        <h2 id="privacy-cookies">5. Cookies, preferencias y servicios externos</h2>
        <p>
          La aplicación utiliza cookies técnicas de sesión y almacenamiento local para preferencias
          como vista de biblioteca, aspecto, cuentas recientes y paneles contraídos. Puedes borrar
          esos datos desde el navegador; puede ser necesario volver a iniciar sesión o configurar
          tus preferencias. SaveState no incorpora cookies propias de rastreo publicitario.
        </p>
        <p>
          Al cargar imágenes remotas, videos o embeds de YouTube, Twitch, Instagram o X/Twitter, tu
          navegador se comunica con sus servidores. Esos proveedores pueden recibir IP y datos
          técnicos o utilizar sus propias cookies conforme a sus políticas. El modo youtube-nocookie
          reduce ciertas cookies del reproductor, pero no garantiza ausencia total de tratamiento
          externo. Abrir ofertas o enlaces también te lleva a servicios con políticas
          independientes.
        </p>
      </section>
      <p className="legal-section">
        Referencias oficiales:{' '}
        <a
          href="https://www.bcn.cl/leychile/navegar?idNorma=141599"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ley 19.628
        </a>{' '}
        y{' '}
        <a
          href="https://www.bcn.cl/leychile/navegar?idNorma=1209272"
          target="_blank"
          rel="noopener noreferrer"
        >
          Ley 21.719
        </a>
        .
      </p>
      <Link href="/terms">Consultar Términos de Servicio →</Link>
    </article>
  );
}
