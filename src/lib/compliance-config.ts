export const COMPLIANCE_DOC_IDS = [
  "PRIVACY_POLICY",
  "TERMS_OF_SERVICE",
  "COOKIE_POLICY",
  "DATA_RETENTION",
  "SECURITY_POLICY",
  "INCIDENT_RESPONSE",
  "BACKUP_RECOVERY",
  "CALIFORNIA_PRIVACY_NOTICE",
] as const;

export type ComplianceDocId = (typeof COMPLIANCE_DOC_IDS)[number];

export type ComplianceDocContent = {
  title: string;
  summary: string;
  body: string;
  effectiveDate: string;
};

export type ComplianceDocConfig = {
  en: ComplianceDocContent;
  es: ComplianceDocContent;
};

export type ComplianceContentConfig = Record<ComplianceDocId, ComplianceDocConfig>;

type ComplianceDocDefinition = {
  slug: string;
  label: string;
  description: string;
  defaults: ComplianceDocConfig;
};

const DEFAULT_INTRO_EN = "This policy applies to AcostasPool public website and customer portal services.";
const DEFAULT_INTRO_ES = "Esta politica aplica al sitio publico y portal de clientes de AcostasPool.";

export const COMPLIANCE_DOC_DEFINITIONS: Record<ComplianceDocId, ComplianceDocDefinition> = {
  PRIVACY_POLICY: {
    slug: "privacy-policy",
    label: "Privacy Policy",
    description: "How we collect, use, protect, and disclose personal information.",
    defaults: {
      en: {
        title: "Privacy Policy",
        summary: "How AcostasPool collects and uses personal data.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Scope",
          DEFAULT_INTRO_EN,
          "",
          "2. Data We Collect",
          "- Contact data: name, email, phone, address.",
          "- Service data: pool details, schedule preferences, notes, photos.",
          "- Account data: login credentials, role, locale, notification preferences.",
          "- Technical data: IP address, browser metadata, timestamps, audit events.",
          "",
          "3. Why We Use Data",
          "- Provide pool service operations, scheduling, notifications, and invoicing.",
          "- Maintain account security and fraud prevention controls.",
          "- Improve service quality and response times.",
          "- Comply with legal and accounting obligations.",
          "",
          "4. Legal Basis",
          "We process data based on contract performance, legitimate business interests, legal obligations, and user consent when required.",
          "",
          "5. Data Sharing",
          "We do not sell personal data. We may share limited data with hosting, email, storage, and operational providers under confidentiality and security obligations.",
          "",
          "6. Data Security",
          "We apply role-based access controls, password hashing, audit logging, and operational monitoring. No system is fully immune to risk.",
          "",
          "7. Data Retention",
          "We retain data according to operational, legal, and tax requirements. See the Data Retention policy for detailed periods.",
          "",
          "8. User Rights",
          "Users may request access, correction, deletion, or export of personal data, subject to legal exceptions.",
          "",
          "9. Contact",
          "For privacy requests, contact: contact@acostaspool.com",
        ].join("\n"),
      },
      es: {
        title: "Politica de Privacidad",
        summary: "Como AcostasPool recopila y usa datos personales.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Alcance",
          DEFAULT_INTRO_ES,
          "",
          "2. Datos que recopilamos",
          "- Contacto: nombre, email, telefono, direccion.",
          "- Servicio: detalles de piscina, horarios, notas, fotos.",
          "- Cuenta: credenciales, rol, idioma, preferencias.",
          "- Tecnicos: IP, metadatos de navegador, tiempos, auditoria.",
          "",
          "3. Uso de datos",
          "- Operacion de servicios, agenda, notificaciones y facturacion.",
          "- Seguridad de cuenta y prevencion de fraude.",
          "- Mejora de calidad de servicio y tiempos de respuesta.",
          "- Cumplimiento legal y contable.",
          "",
          "4. Base legal",
          "Procesamos datos por ejecucion de contrato, interes legitimo, obligaciones legales y consentimiento cuando aplique.",
          "",
          "5. Comparticion",
          "No vendemos datos personales. Podemos compartir datos limitados con proveedores de hosting, email, storage y operacion bajo obligaciones de seguridad.",
          "",
          "6. Seguridad",
          "Aplicamos control de acceso por roles, hash de contrasenas, audit log y monitoreo operativo. Ningun sistema es inmune al riesgo.",
          "",
          "7. Retencion",
          "Retenemos datos segun obligaciones operativas, legales y fiscales. Ver politica de Retencion para periodos detallados.",
          "",
          "8. Derechos del usuario",
          "El usuario puede solicitar acceso, correccion, eliminacion o exportacion de datos, sujeto a excepciones legales.",
          "",
          "9. Contacto",
          "Solicitudes de privacidad: contact@acostaspool.com",
        ].join("\n"),
      },
    },
  },
  TERMS_OF_SERVICE: {
    slug: "terms-of-service",
    label: "Terms of Service",
    description: "Rules and contractual terms for using our services and platform.",
    defaults: {
      en: {
        title: "Terms of Service",
        summary: "Contractual terms for using AcostasPool services.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Acceptance",
          "By using our website, portal, or booking services, you accept these terms.",
          "",
          "2. Services",
          "AcostasPool provides pool maintenance, diagnostics, communication, and billing workflows.",
          "",
          "3. Accounts",
          "Users are responsible for account credentials and all activity under their account.",
          "",
          "4. Payments",
          "Invoices are due according to stated payment terms. Late balances may affect service continuity.",
          "",
          "5. Service Access",
          "Customer must provide safe and lawful access to service areas and disclose relevant hazards.",
          "",
          "6. Platform Availability",
          "We aim for high availability but do not guarantee uninterrupted service.",
          "",
          "7. Prohibited Use",
          "No unauthorized access attempts, abuse, reverse engineering, or unlawful use is permitted.",
          "",
          "8. Liability",
          "To the maximum extent allowed by law, AcostasPool is not liable for indirect or consequential damages.",
          "",
          "9. Governing Law",
          "These terms are governed by applicable laws in the State of Florida, United States.",
          "",
          "10. Updates",
          "We may update these terms. Effective date will be updated when changes are published.",
        ].join("\n"),
      },
      es: {
        title: "Terminos de Servicio",
        summary: "Terminos contractuales para usar los servicios de AcostasPool.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Aceptacion",
          "Al usar el sitio, portal o servicios, aceptas estos terminos.",
          "",
          "2. Servicios",
          "AcostasPool ofrece mantenimiento de piscinas, diagnostico, comunicacion y facturacion.",
          "",
          "3. Cuentas",
          "El usuario es responsable por sus credenciales y actividad de su cuenta.",
          "",
          "4. Pagos",
          "Las facturas vencen segun terminos indicados. Atrasos pueden afectar continuidad del servicio.",
          "",
          "5. Acceso al servicio",
          "El cliente debe proveer acceso seguro y legal a areas de trabajo e informar riesgos relevantes.",
          "",
          "6. Disponibilidad",
          "Buscamos alta disponibilidad, pero no garantizamos servicio ininterrumpido.",
          "",
          "7. Uso prohibido",
          "No se permite acceso no autorizado, abuso, ingenieria inversa o uso ilegal.",
          "",
          "8. Responsabilidad",
          "En el limite permitido por ley, AcostasPool no responde por danos indirectos o consecuenciales.",
          "",
          "9. Ley aplicable",
          "Estos terminos se rigen por leyes aplicables del Estado de Florida, Estados Unidos.",
          "",
          "10. Cambios",
          "Podemos actualizar estos terminos. La fecha efectiva se actualiza al publicar cambios.",
        ].join("\n"),
      },
    },
  },
  COOKIE_POLICY: {
    slug: "cookie-policy",
    label: "Cookie Policy",
    description: "How cookies and similar technologies are used.",
    defaults: {
      en: {
        title: "Cookie Policy",
        summary: "How we use cookies and similar technologies.",
        effectiveDate: "2026-02-25",
        body: [
          "1. What are cookies",
          "Cookies are small text files stored on your device to remember preferences and session context.",
          "",
          "2. Cookie categories",
          "- Essential cookies: authentication and security sessions.",
          "- Preference cookies: language and interface choices.",
          "- Analytics cookies: aggregate usage metrics, if enabled.",
          "",
          "3. Why we use them",
          "To maintain secure login sessions, improve user experience, and evaluate platform reliability.",
          "",
          "4. Controls",
          "You may adjust browser settings to block cookies. Some features may not function correctly if essential cookies are disabled.",
          "",
          "5. Third-party services",
          "Some infrastructure providers may use technical cookies required for hosting and delivery.",
          "",
          "6. Changes",
          "Cookie practices may be updated as our platform evolves.",
        ].join("\n"),
      },
      es: {
        title: "Politica de Cookies",
        summary: "Como usamos cookies y tecnologias similares.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Que son cookies",
          "Son archivos pequenos de texto que guardan preferencias y contexto de sesion en tu dispositivo.",
          "",
          "2. Categorias",
          "- Esenciales: autenticacion y seguridad.",
          "- Preferencias: idioma y opciones de interfaz.",
          "- Analiticas: metricas agregadas de uso, si aplica.",
          "",
          "3. Para que se usan",
          "Para mantener sesiones seguras, mejorar experiencia y evaluar confiabilidad de la plataforma.",
          "",
          "4. Controles",
          "Puedes bloquear cookies desde el navegador. Algunas funciones pueden fallar si se desactivan cookies esenciales.",
          "",
          "5. Terceros",
          "Proveedores de infraestructura pueden usar cookies tecnicas necesarias para hosting y entrega.",
          "",
          "6. Cambios",
          "La practica de cookies puede actualizarse conforme evolucione la plataforma.",
        ].join("\n"),
      },
    },
  },
  DATA_RETENTION: {
    slug: "data-retention",
    label: "Data Retention",
    description: "Retention windows and deletion guidelines by data category.",
    defaults: {
      en: {
        title: "Data Retention Policy",
        summary: "How long we retain operational and customer data.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Objective",
          "Define retention periods that balance service continuity, legal compliance, and minimization principles.",
          "",
          "2. Standard retention windows",
          "- Account and profile data: active lifecycle plus legal retention period.",
          "- Job records and photos: minimum 24 months for operational history.",
          "- Invoices and billing records: minimum 7 years for tax compliance.",
          "- Audit and security logs: minimum 12 months, extended when required.",
          "- Password reset and invitation tokens: short-term, expiring automatically.",
          "",
          "3. Deletion and anonymization",
          "When data is no longer required, records are deleted or anonymized based on legal and operational constraints.",
          "",
          "4. Legal hold",
          "Data under investigation, dispute, or legal obligation may be retained beyond standard windows.",
          "",
          "5. Review cadence",
          "Retention configuration is reviewed periodically and updated as regulations change.",
        ].join("\n"),
      },
      es: {
        title: "Politica de Retencion de Datos",
        summary: "Cuanto tiempo retenemos datos operativos y de clientes.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Objetivo",
          "Definir periodos de retencion equilibrando continuidad operativa, cumplimiento legal y minimizacion.",
          "",
          "2. Periodos estandar",
          "- Cuenta y perfil: ciclo activo mas periodo legal aplicable.",
          "- Jobs y fotos: minimo 24 meses para historial operativo.",
          "- Facturas y registros de cobro: minimo 7 anos por cumplimiento fiscal.",
          "- Logs de auditoria y seguridad: minimo 12 meses, extensible si aplica.",
          "- Tokens de reset e invitacion: corto plazo, expiran automaticamente.",
          "",
          "3. Eliminacion y anonimizado",
          "Cuando el dato deja de ser requerido, se elimina o anonimiza segun limites legales y operativos.",
          "",
          "4. Conservacion legal",
          "Datos bajo investigacion, disputa o requerimiento legal pueden retenerse mas tiempo.",
          "",
          "5. Revision",
          "La configuracion de retencion se revisa periodicamente y se actualiza con cambios regulatorios.",
        ].join("\n"),
      },
    },
  },
  SECURITY_POLICY: {
    slug: "security-policy",
    label: "Security Policy",
    description: "Technical and organizational safeguards for platform security.",
    defaults: {
      en: {
        title: "Security Policy",
        summary: "Controls used to protect the AcostasPool platform and data.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Access control",
          "Role-based access controls are enforced for ADMIN, TECH, CUSTOMER, and DEVELOPER-sensitive areas.",
          "",
          "2. Authentication",
          "Passwords are hashed. Session cookies are secured. Reset flows are tokenized and rate-limited.",
          "",
          "3. Infrastructure security",
          "Production services require HTTPS, managed database access controls, and secret management.",
          "",
          "4. Monitoring",
          "Operational errors, failed notifications, and audit events are monitored for anomaly detection.",
          "",
          "5. Vulnerability management",
          "Dependencies and configurations are reviewed and patched as part of regular maintenance.",
          "",
          "6. Least privilege",
          "Administrative privileges are limited to required users and reviewed routinely.",
          "",
          "7. Secure development",
          "Changes to critical workflows require review and testing before production deployment.",
        ].join("\n"),
      },
      es: {
        title: "Politica de Seguridad",
        summary: "Controles tecnicos y organizativos para proteger plataforma y datos.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Control de acceso",
          "Se aplican permisos por rol para ADMIN, TECH, CUSTOMER y zonas sensibles de DEVELOPER.",
          "",
          "2. Autenticacion",
          "Contrasenas con hash, cookies de sesion seguras, reset con tokens y rate limiting.",
          "",
          "3. Seguridad de infraestructura",
          "Produccion requiere HTTPS, control de acceso a base de datos y gestion de secretos.",
          "",
          "4. Monitoreo",
          "Se monitorean errores operativos, notificaciones fallidas y eventos de auditoria.",
          "",
          "5. Vulnerabilidades",
          "Dependencias y configuraciones se revisan y actualizan como mantenimiento regular.",
          "",
          "6. Minimo privilegio",
          "Permisos administrativos limitados a usuarios requeridos y revisados periodicamente.",
          "",
          "7. Desarrollo seguro",
          "Cambios en flujos criticos requieren revision y pruebas antes de produccion.",
        ].join("\n"),
      },
    },
  },
  INCIDENT_RESPONSE: {
    slug: "incident-response",
    label: "Incident Response",
    description: "How security and service incidents are detected, contained, and resolved.",
    defaults: {
      en: {
        title: "Incident Response Policy",
        summary: "Operational playbook for security and service incidents.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Detection",
          "Incidents may be identified through monitoring alerts, user reports, or audit reviews.",
          "",
          "2. Classification",
          "Incidents are triaged by severity: low, medium, high, critical.",
          "",
          "3. Containment",
          "Immediate actions may include credential revocation, route isolation, feature disablement, or traffic restrictions.",
          "",
          "4. Eradication and recovery",
          "Root cause is removed, systems are restored, and validation checks are executed before normal operation resumes.",
          "",
          "5. Communication",
          "Stakeholders are informed according to impact level and legal notification requirements.",
          "",
          "6. Post-incident review",
          "A retrospective documents timeline, impact, cause, corrective actions, and prevention tasks.",
        ].join("\n"),
      },
      es: {
        title: "Politica de Respuesta a Incidentes",
        summary: "Procedimiento operativo ante incidentes de seguridad y servicio.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Deteccion",
          "Incidentes pueden detectarse por alertas, reportes de usuarios o revision de auditoria.",
          "",
          "2. Clasificacion",
          "Se priorizan por severidad: baja, media, alta, critica.",
          "",
          "3. Contencion",
          "Se puede revocar credenciales, aislar rutas, desactivar funciones o restringir trafico.",
          "",
          "4. Erradicacion y recuperacion",
          "Se elimina causa raiz, se restauran sistemas y se validan controles antes de normalizar operacion.",
          "",
          "5. Comunicacion",
          "Se informa a interesados segun impacto y requerimientos legales de notificacion.",
          "",
          "6. Revision posterior",
          "Se documenta cronologia, impacto, causa, acciones correctivas y tareas preventivas.",
        ].join("\n"),
      },
    },
  },
  BACKUP_RECOVERY: {
    slug: "backup-recovery",
    label: "Backup and Disaster Recovery",
    description: "Backup cadence, restore expectations, and continuity controls.",
    defaults: {
      en: {
        title: "Backup and Disaster Recovery Policy",
        summary: "Data protection and restoration strategy.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Backup strategy",
          "Production data is backed up on a scheduled basis using managed database and storage capabilities.",
          "",
          "2. Restore testing",
          "Restore procedures are tested periodically to verify backup integrity and recovery readiness.",
          "",
          "3. Recovery objectives",
          "Target recovery metrics are defined for uptime impact and acceptable data loss windows.",
          "",
          "4. Disaster scenarios",
          "Plans cover database failure, storage corruption, credential compromise, and deployment regressions.",
          "",
          "5. Change control",
          "Critical production changes are performed with rollback planning and deployment validation.",
          "",
          "6. Ownership",
          "Operational owners are assigned for backup monitoring, restore execution, and post-incident reporting.",
        ].join("\n"),
      },
      es: {
        title: "Politica de Backup y Recuperacion",
        summary: "Estrategia de proteccion y restauracion de datos.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Estrategia de backup",
          "Los datos de produccion se respaldan en forma programada usando capacidades gestionadas de base de datos y storage.",
          "",
          "2. Pruebas de restauracion",
          "Los procedimientos de restore se prueban periodicamente para validar integridad y preparacion.",
          "",
          "3. Objetivos de recuperacion",
          "Se definen objetivos de impacto de disponibilidad y ventana aceptable de perdida de datos.",
          "",
          "4. Escenarios de desastre",
          "Se cubren fallas de base de datos, corrupcion de storage, compromiso de credenciales y regresiones de despliegue.",
          "",
          "5. Control de cambios",
          "Cambios criticos en produccion se ejecutan con plan de rollback y validacion.",
          "",
          "6. Responsables",
          "Se asignan responsables para monitoreo de backups, ejecucion de restore y reporte posterior.",
        ].join("\n"),
      },
    },
  },
  CALIFORNIA_PRIVACY_NOTICE: {
    slug: "california-privacy-notice",
    label: "California Privacy Notice",
    description: "Additional disclosures for California residents.",
    defaults: {
      en: {
        title: "California Privacy Notice",
        summary: "Additional notice for California residents under applicable privacy laws.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Scope",
          "This notice supplements the Privacy Policy for California residents.",
          "",
          "2. Categories collected",
          "Identifiers, contact data, service records, account credentials, and internet activity logs as described in our Privacy Policy.",
          "",
          "3. Purposes",
          "To provide services, maintain security, process billing, and meet legal obligations.",
          "",
          "4. Sale or sharing",
          "AcostasPool does not sell personal information.",
          "",
          "5. Rights",
          "California residents may request access, deletion, correction, and information regarding data use, subject to legal exceptions.",
          "",
          "6. Requests",
          "Submit privacy rights requests by email: contact@acostaspool.com",
        ].join("\n"),
      },
      es: {
        title: "Aviso de Privacidad de California",
        summary: "Aviso adicional para residentes de California bajo leyes de privacidad aplicables.",
        effectiveDate: "2026-02-25",
        body: [
          "1. Alcance",
          "Este aviso complementa la Politica de Privacidad para residentes de California.",
          "",
          "2. Categorias recopiladas",
          "Identificadores, contacto, registros de servicio, credenciales de cuenta y actividad tecnica segun la Politica de Privacidad.",
          "",
          "3. Finalidades",
          "Prestar servicios, mantener seguridad, procesar facturacion y cumplir obligaciones legales.",
          "",
          "4. Venta o comparticion",
          "AcostasPool no vende informacion personal.",
          "",
          "5. Derechos",
          "Residentes de California pueden solicitar acceso, eliminacion, correccion e informacion de uso, sujeto a excepciones legales.",
          "",
          "6. Solicitudes",
          "Solicitudes de derechos de privacidad: contact@acostaspool.com",
        ].join("\n"),
      },
    },
  },
};

export function getComplianceDefaults(): ComplianceContentConfig {
  return COMPLIANCE_DOC_IDS.reduce((acc, docId) => {
    acc[docId] = COMPLIANCE_DOC_DEFINITIONS[docId].defaults;
    return acc;
  }, {} as ComplianceContentConfig);
}

export function normalizeComplianceDocContent(
  value: unknown,
  fallback: ComplianceDocContent
): ComplianceDocContent {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    title: String(input.title ?? fallback.title),
    summary: String(input.summary ?? fallback.summary),
    body: String(input.body ?? fallback.body),
    effectiveDate: String(input.effectiveDate ?? fallback.effectiveDate),
  };
}

export function normalizeComplianceContent(value: unknown): ComplianceContentConfig {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const defaults = getComplianceDefaults();

  return COMPLIANCE_DOC_IDS.reduce((acc, docId) => {
    const docInput =
      input[docId] && typeof input[docId] === "object"
        ? (input[docId] as Record<string, unknown>)
        : {};
    acc[docId] = {
      en: normalizeComplianceDocContent(docInput.en, defaults[docId].en),
      es: normalizeComplianceDocContent(docInput.es, defaults[docId].es),
    };
    return acc;
  }, {} as ComplianceContentConfig);
}

export function isComplianceDocId(value: string | null | undefined): value is ComplianceDocId {
  return COMPLIANCE_DOC_IDS.some((docId) => docId === value);
}

export function getComplianceDocBySlug(slug: string) {
  const match = COMPLIANCE_DOC_IDS.find(
    (docId) => COMPLIANCE_DOC_DEFINITIONS[docId].slug === slug
  );
  return match ?? null;
}

