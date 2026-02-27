export const COMPLIANCE_DOC_IDS = [
  "PRIVACY_POLICY",
  "TERMS_OF_SERVICE",
  "PAYMENT_CANCELLATION_POLICY",
  "DISCLAIMER_LIMITATION_OF_LIABILITY",
  "COOKIE_NOTICE",
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

const EFFECTIVE_DATE = "2026-02-27";

export const COMPLIANCE_DOC_DEFINITIONS: Record<ComplianceDocId, ComplianceDocDefinition> = {
  PRIVACY_POLICY: {
    slug: "privacy-policy",
    label: "Privacy Policy",
    description: "How AcostasPool collects, uses, stores, and protects personal information.",
    defaults: {
      en: {
        title: "Privacy Policy",
        summary:
          "Explains what personal information we collect, why we collect it, and how customers can request access, correction, or deletion.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Scope",
          "This Privacy Policy applies to AcostasPool website forms, quotes, scheduling workflows, customer portal, and payment-related communications.",
          "",
          "2. Information We Collect",
          "We may collect and process the following information:",
          "- Name",
          "- Email address",
          "- Phone number",
          "- Property address and service location details",
          "- Information submitted through contact, estimate, or booking forms",
          "- Service history, notes, and media related to completed visits",
          "",
          "3. How We Use Your Information",
          "We use collected information to:",
          "- Provide estimates and proposals",
          "- Schedule and perform pool maintenance services",
          "- Communicate updates, confirmations, and service notes",
          "- Process invoices and payments",
          "- Improve service quality and customer support",
          "",
          "4. Sharing and Disclosure",
          "We do not sell or rent personal information. We may share limited information with trusted providers (for hosting, communications, storage, and payment processing) when necessary to operate our services.",
          "",
          "5. Cookies and Analytics",
          "We may use cookies and analytics tools, such as Google Analytics, to understand usage patterns and improve website performance.",
          "",
          "6. Data Security",
          "We implement reasonable administrative, technical, and organizational safeguards to protect personal information. No internet-based system can be guaranteed 100 percent secure.",
          "",
          "7. Data Retention",
          "We retain records only as long as necessary for service delivery, legal compliance, tax requirements, and dispute resolution.",
          "",
          "8. Your Rights",
          "You may request access, correction, or deletion of your personal data, subject to legal and operational requirements.",
          "",
          "9. Contact",
          "For privacy requests, contact us at: contact@acostaspool.com",
        ].join("\n"),
      },
      es: {
        title: "Politica de Privacidad",
        summary:
          "Explica que informacion personal recopilamos, para que la usamos y como puedes solicitar acceso, correccion o eliminacion.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Alcance",
          "Esta Politica de Privacidad aplica a formularios del sitio web de AcostasPool, cotizaciones, agenda de servicios, portal de clientes y comunicaciones relacionadas con pagos.",
          "",
          "2. Informacion que recopilamos",
          "Podemos recopilar y procesar la siguiente informacion:",
          "- Nombre",
          "- Correo electronico",
          "- Telefono",
          "- Direccion de la propiedad y detalles del servicio",
          "- Informacion enviada por formularios de contacto, cotizacion o reserva",
          "- Historial de servicios, notas y evidencias de visitas completadas",
          "",
          "3. Como usamos tu informacion",
          "Usamos la informacion para:",
          "- Preparar cotizaciones y propuestas",
          "- Programar y ejecutar servicios de mantenimiento de piscinas",
          "- Enviar confirmaciones, actualizaciones y notas de servicio",
          "- Procesar facturas y pagos",
          "- Mejorar la calidad del servicio y soporte",
          "",
          "4. Comparticion y divulgacion",
          "No vendemos ni alquilamos informacion personal. Podemos compartir informacion limitada con proveedores confiables (hosting, comunicaciones, almacenamiento y pagos) cuando sea necesario para operar el servicio.",
          "",
          "5. Cookies y analitica",
          "Podemos usar cookies y herramientas de analitica, como Google Analytics, para entender el uso del sitio y mejorar su rendimiento.",
          "",
          "6. Seguridad de datos",
          "Aplicamos medidas administrativas, tecnicas y organizativas razonables para proteger la informacion. Ningun sistema en internet puede garantizar seguridad total.",
          "",
          "7. Retencion de datos",
          "Conservamos registros solo el tiempo necesario para prestar servicios, cumplir obligaciones legales y fiscales, y resolver disputas.",
          "",
          "8. Tus derechos",
          "Puedes solicitar acceso, correccion o eliminacion de tus datos personales, sujeto a requisitos legales y operativos.",
          "",
          "9. Contacto",
          "Para solicitudes de privacidad, escribenos a: contact@acostaspool.com",
        ].join("\n"),
      },
    },
  },
  TERMS_OF_SERVICE: {
    slug: "terms-of-service",
    label: "Terms of Service",
    description: "Contract terms that govern estimates, scheduling, on-site services, and customer responsibilities.",
    defaults: {
      en: {
        title: "Terms of Service",
        summary:
          "Defines service scope, customer responsibilities, scheduling conditions, and legal limitations for AcostasPool services.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Services Provided",
          "AcostasPool provides residential pool cleaning, maintenance, chemical balancing, diagnostics, and related field services.",
          "",
          "2. Estimates and Scheduling",
          "Quotes are based on information provided by the customer and may be adjusted after on-site assessment. Service dates are subject to route availability and weather conditions.",
          "",
          "3. Service Access and Site Readiness",
          "The customer agrees to provide safe and clear access to the pool area on scheduled dates. If access is blocked or unsafe, the visit may be skipped and may still be billable.",
          "",
          "4. Pre-Existing Conditions",
          "We are not responsible for pre-existing equipment damage, structural defects, underground plumbing leaks, manufacturer defects, or hidden conditions not observable during regular service.",
          "",
          "5. Weather and Force Majeure",
          "Service schedules may be delayed or adjusted due to storms, hurricanes, severe weather, or other events beyond reasonable control.",
          "",
          "6. Chemical Treatment and Safety",
          "We use industry-standard pool chemicals. Customers are responsible for keeping people and pets out of treated water during recommended waiting periods.",
          "",
          "7. Customer Responsibilities",
          "Customers must disclose known hazards, maintain lawful service access, and ensure on-site conditions meet basic safety expectations for field technicians.",
          "",
          "8. Hold Harmless",
          "Customer agrees to hold AcostasPool harmless from claims arising from pre-existing conditions, faulty equipment, structural pool issues, or customer-provided instructions that conflict with standard safety practices.",
          "",
          "9. Limitation of Liability",
          "To the maximum extent allowed by law, liability for any claim is limited to the amount paid for the most recent related service visit. We are not liable for indirect, incidental, special, or consequential damages.",
          "",
          "10. Governing Law",
          "These terms are governed by the laws of the State of Florida, United States.",
          "",
          "11. Updates to Terms",
          "We may update these terms from time to time. Updated versions are effective on the published Effective Date.",
        ].join("\n"),
      },
      es: {
        title: "Terminos de Servicio",
        summary:
          "Define el alcance del servicio, responsabilidades del cliente, condiciones de agenda y limitaciones legales de AcostasPool.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Servicios ofrecidos",
          "AcostasPool ofrece limpieza residencial de piscinas, mantenimiento, balance quimico, diagnostico y servicios relacionados en propiedad.",
          "",
          "2. Cotizaciones y agenda",
          "Las cotizaciones se basan en la informacion entregada por el cliente y pueden ajustarse luego de la evaluacion en sitio. Las fechas estan sujetas a disponibilidad de ruta y condiciones del clima.",
          "",
          "3. Acceso y condiciones del area",
          "El cliente se compromete a proveer acceso seguro y despejado al area de la piscina en la fecha programada. Si el acceso esta bloqueado o es inseguro, la visita puede omitirse y puede ser facturable.",
          "",
          "4. Condiciones preexistentes",
          "No somos responsables por danos preexistentes en equipos, defectos estructurales, fugas subterraneas, defectos de fabricante o condiciones ocultas no visibles durante el servicio regular.",
          "",
          "5. Clima y fuerza mayor",
          "La agenda puede retrasarse o ajustarse por tormentas, huracanes, clima severo u otros eventos fuera de control razonable.",
          "",
          "6. Quimicos y seguridad",
          "Usamos quimicos estandar de la industria. El cliente es responsable de mantener personas y mascotas fuera del agua tratada durante los tiempos de espera recomendados.",
          "",
          "7. Responsabilidades del cliente",
          "El cliente debe informar riesgos conocidos, mantener acceso legal al area de servicio y asegurar condiciones basicas de seguridad para el tecnico.",
          "",
          "8. Hold Harmless",
          "El cliente acepta mantener indemne a AcostasPool frente a reclamos derivados de condiciones preexistentes, equipos defectuosos, problemas estructurales o instrucciones del cliente que contradigan practicas estandar de seguridad.",
          "",
          "9. Limitacion de responsabilidad",
          "En el maximo permitido por ley, la responsabilidad por cualquier reclamo se limita al monto pagado por la visita de servicio mas reciente relacionada. No respondemos por danos indirectos, incidentales, especiales o consecuenciales.",
          "",
          "10. Ley aplicable",
          "Estos terminos se rigen por las leyes del Estado de Florida, Estados Unidos.",
          "",
          "11. Cambios de terminos",
          "Podemos actualizar estos terminos periodicamente. Las versiones nuevas entran en vigor en la fecha publicada como Effective Date.",
        ].join("\n"),
      },
    },
  },
  PAYMENT_CANCELLATION_POLICY: {
    slug: "payment-cancellation-policy",
    label: "Payment and Cancellation Policy",
    description: "Billing terms, accepted payment methods, cancellation windows, and no-access rules.",
    defaults: {
      en: {
        title: "Payment and Cancellation Policy",
        summary:
          "Outlines payment due dates, accepted payment methods, late-payment handling, and cancellation requirements.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Payment Terms",
          "Payment is due upon invoice receipt unless another written agreement applies.",
          "",
          "2. Accepted Methods",
          "We currently accept: cash, Zelle, PayPal, and bank transfer.",
          "",
          "3. Late Payments",
          "Late balances may result in paused service, delayed scheduling, or account restrictions until payment is received.",
          "",
          "4. Cancellations",
          "Customers must provide at least 24 hours notice to cancel a scheduled visit.",
          "",
          "5. Same-Day Cancellation and No Access",
          "Same-day cancellations, no-shows, or blocked access may be subject to a service fee to cover reserved route time and technician dispatch.",
          "",
          "6. Rescheduling",
          "We will make reasonable efforts to reschedule canceled visits based on route availability.",
          "",
          "7. Refunds",
          "Refund requests are reviewed case-by-case based on service records and work already performed.",
          "",
          "8. Chargebacks",
          "If a chargeback is filed for a valid completed service, we reserve the right to provide service records and suspend service while the claim is reviewed.",
        ].join("\n"),
      },
      es: {
        title: "Politica de Pago y Cancelacion",
        summary:
          "Establece fechas de pago, metodos aceptados, manejo de mora y condiciones de cancelacion.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Terminos de pago",
          "El pago vence al recibir la factura, salvo acuerdo escrito diferente.",
          "",
          "2. Metodos aceptados",
          "Actualmente aceptamos: efectivo, Zelle, PayPal y transferencia bancaria.",
          "",
          "3. Pagos tardios",
          "Los saldos vencidos pueden generar pausa del servicio, retraso de agenda o restricciones de cuenta hasta recibir el pago.",
          "",
          "4. Cancelaciones",
          "El cliente debe notificar la cancelacion con al menos 24 horas de anticipacion.",
          "",
          "5. Cancelacion el mismo dia y sin acceso",
          "Cancelaciones del mismo dia, ausencias o falta de acceso pueden generar un cargo por visita para cubrir el tiempo de ruta reservado y salida del tecnico.",
          "",
          "6. Reprogramacion",
          "Haremos esfuerzos razonables para reprogramar visitas canceladas segun disponibilidad de ruta.",
          "",
          "7. Reembolsos",
          "Las solicitudes de reembolso se revisan caso por caso segun registros de servicio y trabajo ya ejecutado.",
          "",
          "8. Contracargos",
          "Si se presenta un contracargo sobre un servicio valido y completado, nos reservamos el derecho de aportar registros del servicio y pausar la cuenta mientras se revisa el reclamo.",
        ].join("\n"),
      },
    },
  },
  DISCLAIMER_LIMITATION_OF_LIABILITY: {
    slug: "disclaimer-limitation-of-liability",
    label: "Disclaimer and Limitation of Liability",
    description: "Legal disclaimer for pool-service risks, service outcomes, and liability limits.",
    defaults: {
      en: {
        title: "Disclaimer and Limitation of Liability",
        summary:
          "Clarifies service risk boundaries, no-warranty scope, and legal limitations for pool maintenance outcomes.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Service Nature",
          "Pool maintenance involves chemical treatment, mechanical systems, and environmental variables.",
          "",
          "2. No Absolute Guarantee",
          "While we use reasonable care and industry-standard procedures, we cannot guarantee against equipment failure, sudden algae growth, water discoloration from environmental conditions, or issues caused by improper construction or third-party work.",
          "",
          "3. As-Is Service Disclaimer",
          "Services are provided as-is and as-available, without warranties beyond generally accepted industry practices and any mandatory rights under applicable law.",
          "",
          "4. Third-Party Equipment and Manufacturer Defects",
          "We are not responsible for failures caused by manufacturer defects, aging equipment, hidden leaks, or conditions outside our service control.",
          "",
          "5. Limitation of Damages",
          "To the maximum extent permitted by law, AcostasPool is not liable for indirect, incidental, punitive, special, or consequential damages, including property-use interruption, loss of enjoyment, or secondary costs.",
          "",
          "6. Maximum Liability",
          "If liability is established, total liability is limited to the amount paid for the most recent related service visit.",
          "",
          "7. Customer Indemnity and Hold Harmless",
          "Customer agrees to defend, indemnify, and hold AcostasPool harmless from third-party claims related to pre-existing defects, unsafe property conditions, undisclosed hazards, or customer-directed actions.",
        ].join("\n"),
      },
      es: {
        title: "Descargo y Limitacion de Responsabilidad",
        summary:
          "Aclara limites de riesgo, alcance sin garantia absoluta y limitaciones legales para resultados de mantenimiento de piscina.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Naturaleza del servicio",
          "El mantenimiento de piscinas involucra tratamiento quimico, sistemas mecanicos y variables ambientales.",
          "",
          "2. Sin garantia absoluta",
          "Aunque aplicamos cuidado razonable y practicas estandar de la industria, no podemos garantizar contra fallas de equipo, crecimiento repentino de algas, decoloracion del agua por factores ambientales o danos por construccion inadecuada o trabajo de terceros.",
          "",
          "3. Servicio as-is",
          "Los servicios se prestan en condicion as-is y as-available, sin garantias adicionales a las practicas normales de la industria y a los derechos obligatorios que aplique la ley.",
          "",
          "4. Equipos de terceros y defectos de fabricante",
          "No somos responsables por fallas causadas por defectos de fabricante, equipos envejecidos, fugas ocultas o condiciones fuera de nuestro control operativo.",
          "",
          "5. Limitacion de danos",
          "En el maximo permitido por ley, AcostasPool no responde por danos indirectos, incidentales, punitivos, especiales o consecuenciales, incluyendo interrupcion de uso de la propiedad, perdida de disfrute o costos secundarios.",
          "",
          "6. Responsabilidad maxima",
          "Si existe responsabilidad comprobada, la responsabilidad total se limita al monto pagado por la visita de servicio relacionada mas reciente.",
          "",
          "7. Indemnizacion y Hold Harmless",
          "El cliente acepta defender, indemnizar y mantener indemne a AcostasPool frente a reclamos de terceros derivados de defectos preexistentes, condiciones inseguras de la propiedad, riesgos no informados o acciones solicitadas por el cliente.",
        ].join("\n"),
      },
    },
  },
  COOKIE_NOTICE: {
    slug: "cookie-notice",
    label: "Cookie Notice",
    description: "Explains cookie usage for essential sessions and optional analytics.",
    defaults: {
      en: {
        title: "Cookie Notice",
        summary:
          "Describes how cookies support secure login sessions, preferences, and optional analytics on our website.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. What Are Cookies",
          "Cookies are small text files stored on your device to remember settings and improve browsing performance.",
          "",
          "2. How We Use Cookies",
          "- Essential cookies: authentication and session security",
          "- Preference cookies: language and interface settings",
          "- Analytics cookies: aggregated traffic insights when analytics tools are enabled",
          "",
          "3. Third-Party Tools",
          "If analytics tools such as Google Analytics are active, those providers may place cookies subject to their own policies.",
          "",
          "4. Managing Cookies",
          "You can control or delete cookies through your browser settings. Blocking essential cookies may affect site functionality.",
          "",
          "5. Continued Use",
          "By continuing to use our website, you acknowledge this Cookie Notice and consent to applicable cookie use.",
        ].join("\n"),
      },
      es: {
        title: "Aviso de Cookies",
        summary:
          "Describe como usamos cookies para sesiones seguras, preferencias del usuario y analitica opcional en el sitio web.",
        effectiveDate: EFFECTIVE_DATE,
        body: [
          "1. Que son las cookies",
          "Las cookies son pequenos archivos de texto almacenados en tu dispositivo para recordar ajustes y mejorar la navegacion.",
          "",
          "2. Como usamos las cookies",
          "- Cookies esenciales: autenticacion y seguridad de sesion",
          "- Cookies de preferencia: idioma y configuracion de interfaz",
          "- Cookies de analitica: datos agregados de trafico cuando hay herramientas de analitica activas",
          "",
          "3. Herramientas de terceros",
          "Si herramientas como Google Analytics estan activas, esos proveedores pueden colocar cookies segun sus propias politicas.",
          "",
          "4. Gestion de cookies",
          "Puedes controlar o eliminar cookies desde la configuracion del navegador. Bloquear cookies esenciales puede afectar funciones del sitio.",
          "",
          "5. Uso continuo",
          "Al continuar usando nuestro sitio web, reconoces este Aviso de Cookies y aceptas el uso de cookies aplicable.",
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

