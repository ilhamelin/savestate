export function LegalContact() {
  const email = 'savestate.contacto@proton.me';
  return (
    <p className="legal-highlight-box">
      Contacto de la administración de SaveState para privacidad y retirada de contenido:{' '}
      <a href={`mailto:${email}`}>{email}</a>. Indica «Privacidad / ARCO» o «Reporte de contenido»
      en el asunto. No envíes contraseñas, claves API ni documentos de identidad en una publicación
      pública.
    </p>
  );
}
