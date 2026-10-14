# Especificación Técnica: Implementación de Términos de Servicio, Política de Privacidad y Pie Legal en SaveState

## 1. Resumen y Objetivos

Implementar la cobertura legal integral de SaveState para cumplir con los requerimientos normativos de **Chile** (Ley N° 17.336 de Propiedad Intelectual, Leyes N° 19.628 y N° 21.696 de Protección de Datos Personales, Ley N° 20.435 de Proveedores de Internet) y las políticas contractuales de **Riot Games** y **Valve Corporation**:

1. **Página de Términos de Servicio (`/terms`)**:
   - Condiciones de uso de la plataforma y cuentas de usuario.
   - Política de Uso Aceptable (AUP) para el Chat Global y Foros.
   - Régimen de Puerto Seguro (*Safe Harbor*) bajo la Ley N° 20.435 y la DMCA (17 U.S.C. § 512).
   - Procedimiento de Notificación y Retirada (*Notice and Takedown*) con canal de contacto oficial para reportes de propiedad intelectual.
   - Declaración de uso legítimo nominativo (*Fair Use*) de marcas y artes de terceros.
2. **Página de Política de Privacidad (`/privacy`)**:
   - Marco de protección de datos conforme a la Ley N° 19.628 y Ley N° 21.696 (Chile) y principios del GDPR.
   - Transparencia total sobre los datos recopilados (correo, usuario, identificadores de juego, contraseñas hasheadas).
   - Compromiso formal de no venta ni cesión de datos personales a terceros con fines comerciales o de marketing.
   - Explicación de proveedores de infraestructura (Supabase, Vercel) y seguridad técnica activa (Row Level Security en PostgreSQL).
   - Mecanismos para el ejercicio de los Derechos ARCO (Acceso, Rectificación, Cancelación y Oposición) y eliminación permanente de cuenta.
3. **Pie de Página Global (`src/app/layout.tsx` y `src/app/globals.css`)**:
   - Enlaces directos a `/terms` y `/privacy` en la navegación de pie de página.
   - Inclusión obligatoria del descargo contractual de Riot Games ("Legal Jibber Jabber").
   - Inclusión obligatoria del descargo de marcas y no afiliación de Valve / Steam.
   - Cláusula de uso nominativo de marcas registradas de terceros (Nintendo, PlayStation, Xbox, Take-Two, Disney/Marvel).

---

## 2. Archivos Involucrados

| Archivo | Acción | Descripción |
|---|---|---|
| `src/app/terms/page.tsx` | Crear | Página completa de Términos de Servicio, AUP y mecanismo DMCA / Ley 20.435. |
| `src/app/privacy/page.tsx` | Crear | Página de Política de Privacidad, tratamiento de datos y derechos ARCO. |
| `src/app/layout.tsx` | Modificar | Incorporar navegación legal y descargos oficiales de Riot, Valve y marcas en el pie de página. |
| `src/app/globals.css` | Modificar | Estilos ciberpunk sobrios para las páginas legales y el banner de descargos del footer. |
| `tests/unit/legal-pages.test.ts` | Crear | Pruebas unitarias que validen la renderización y consistencia de los textos legales. |

---

## 3. Detalle de Contenidos Legales

### 3.1. Descargos Contractuales Mandatarios en Footer
- **Riot Games**:
  > *"SaveState isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc."*
- **Valve / Steam**:
  > *"Steam y el logotipo de Steam son marcas comerciales y/o registradas de Valve Corporation en EE. UU. y otros países. SaveState no está afiliado, respaldado ni patrocinado por Valve Corporation."*
- **Marcas de Terceros**:
  > *"Todas las marcas comerciales, logotipos y artes promocionales (incluyendo Nintendo, PlayStation, Xbox, Take-Two/Rockstar Games y Disney/Marvel) pertenecen a sus respectivos dueños y se muestran bajo los principios de uso legítimo nominativo sin fines de lucro."*

---

## 4. Verificación y Calidad
- Rutas públicas accesibles sin requerir autenticación (`/terms` y `/privacy`).
- Cumplimiento de accesibilidad (`aria-label`, contraste, estructura semántica HTML5).
- Suite completa de tests pasando al 100%.
