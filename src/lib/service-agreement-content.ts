export type AgreementFeatureBlock = {
  title: string;
  summary: string;
  bullets: string[];
};

export type AgreementClauseBlock = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

export type AgreementReference = {
  label: string;
  url: string;
  note: string;
};

export type AgreementPlanRow = {
  plan: string;
  year1: string;
  year2Plus: string;
  note?: string;
};

export type AgreementLogoEntry = {
  id: string;
  name: string;
  short: string;
  category: "brand" | "platform" | "infrastructure" | "operation";
  imageSrc?: string;
  accentHex: string;
};

export const SERVICE_AGREEMENT_META = {
  title: "AcostasPool - Service Agreement & Functional Overview",
  subtitle:
    "Documento ejecutivo-comercial para presentacion a clientes que evaluan contratar y operar la plataforma.",
  documentVersion: "v1.0",
  preparedBy: "AcostasPool Operations Team",
  publicationDateLabel: "Fecha de emision",
};

export const SERVICE_AGREEMENT_EXECUTIVE_SUMMARY: string[] = [
  "AcostasPool es una plataforma SaaS para administracion integral de operaciones de servicio de piscinas, con enfoque en trazabilidad, productividad operativa y experiencia del cliente final.",
  "La solucion integra operacion de campo, administracion, facturacion y comunicacion automatizada en un unico entorno web responsivo con soporte para desktop y dispositivos moviles.",
  "Este documento resume funcionalidades, arquitectura de servicio, modelo operativo y clausulas base recomendadas para un acuerdo de prestacion de servicio.",
];

export const SERVICE_AGREEMENT_VALUE_PROPS: string[] = [
  "Control de punta a punta: desde solicitud del cliente hasta evidencia y facturacion.",
  "Reduccion de trabajo manual por automatizacion de rutas, notificaciones y reportes.",
  "Trazabilidad auditable por evento, usuario, estado y fecha.",
  "Escalabilidad operacional para equipos administrativos, tecnicos y clientes.",
];

export const SERVICE_AGREEMENT_LOGOS: AgreementLogoEntry[] = [
  {
    id: "acostaspool-invoice",
    name: "AcostasPool Invoice Brand",
    short: "AP",
    category: "brand",
    imageSrc: "/brand/acostaspool-invoice-lockup.svg",
    accentHex: "#0a2f63",
  },
  {
    id: "wyxloop-dev",
    name: "Wyxloop Dev",
    short: "WX",
    category: "brand",
    imageSrc: "/brand/wyxloop-dev.svg",
    accentHex: "#4f46e5",
  },
  {
    id: "nextjs",
    name: "Next.js",
    short: "NX",
    category: "platform",
    accentHex: "#111827",
  },
  {
    id: "react",
    name: "React",
    short: "RE",
    category: "platform",
    accentHex: "#0891b2",
  },
  {
    id: "typescript",
    name: "TypeScript",
    short: "TS",
    category: "platform",
    accentHex: "#2563eb",
  },
  {
    id: "nodejs",
    name: "Node.js",
    short: "ND",
    category: "platform",
    accentHex: "#15803d",
  },
  {
    id: "prisma",
    name: "Prisma ORM",
    short: "PR",
    category: "platform",
    accentHex: "#0f172a",
  },
  {
    id: "postgres",
    name: "PostgreSQL",
    short: "PG",
    category: "platform",
    accentHex: "#334155",
  },
  {
    id: "tailwind",
    name: "Tailwind CSS",
    short: "TW",
    category: "platform",
    accentHex: "#0284c7",
  },
  {
    id: "pdf-lib",
    name: "PDF-Lib",
    short: "PDF",
    category: "platform",
    accentHex: "#1d4ed8",
  },
  {
    id: "rest-api",
    name: "REST API",
    short: "API",
    category: "platform",
    accentHex: "#1f2937",
  },
  {
    id: "pwa",
    name: "PWA",
    short: "PWA",
    category: "platform",
    accentHex: "#7c3aed",
  },
  {
    id: "service-worker",
    name: "Service Worker",
    short: "SW",
    category: "platform",
    accentHex: "#0f766e",
  },
  {
    id: "aws-s3",
    name: "AWS S3",
    short: "S3",
    category: "infrastructure",
    accentHex: "#b45309",
  },
  {
    id: "cloudflare-r2",
    name: "Cloudflare R2",
    short: "R2",
    category: "infrastructure",
    accentHex: "#ea580c",
  },
  {
    id: "postgres-db",
    name: "PostgreSQL Server",
    short: "DB",
    category: "infrastructure",
    accentHex: "#1e3a8a",
  },
  {
    id: "web-server",
    name: "Web Server",
    short: "WEB",
    category: "infrastructure",
    accentHex: "#0f766e",
  },
  {
    id: "cron-service",
    name: "Cron Service",
    short: "CRN",
    category: "infrastructure",
    accentHex: "#a16207",
  },
  {
    id: "smtp-365",
    name: "SMTP Microsoft 365",
    short: "SMTP",
    category: "infrastructure",
    accentHex: "#1d4ed8",
  },
  {
    id: "google-maps",
    name: "Google Maps",
    short: "MAP",
    category: "operation",
    accentHex: "#dc2626",
  },
  {
    id: "route-assistant",
    name: "Route Assistant",
    short: "RA",
    category: "operation",
    accentHex: "#0f766e",
  },
  {
    id: "notifications-engine",
    name: "Notifications Engine",
    short: "NTF",
    category: "operation",
    accentHex: "#7c3aed",
  },
  {
    id: "customer-portal",
    name: "Customer Portal",
    short: "CP",
    category: "operation",
    accentHex: "#0c4a6e",
  },
];

export const SERVICE_AGREEMENT_INITIAL_GUARANTEE = {
  title: "Periodo de Garantia Inicial",
  summary:
    "Una vez entregado oficialmente el sistema, se incluye un (1) mes completo de garantia total sin costo durante los primeros 30 dias posteriores a la entrega del proyecto.",
  supportScope: [
    "Correccion de errores tecnicos detectados.",
    "Ajustes menores de texto o configuracion.",
    "Soporte tecnico general.",
    "Ajustes necesarios para asegurar la estabilidad inicial del sistema.",
  ],
  transitionNote:
    "Este mes forma parte del compromiso de entrega. Finalizado el periodo de garantia, aplican los planes de continuidad operativa definidos en la propuesta.",
};

export const SERVICE_AGREEMENT_INFRASTRUCTURE_PLAN = {
  title: "1) Plan de Infraestructura (Obligatorio)",
  summary:
    "Este plan cubre los costos reales de mantener la plataforma en linea para asegurar operacion continua 24/7.",
  includedInfrastructure: [
    "Servidor web para ejecucion de la aplicacion y acceso de usuarios.",
    "Cron service para conexiones y procesos automaticos internos.",
    "Servidor de base de datos para clientes, servicios e historial operativo.",
    "Servidor de almacenamiento (AWS S3) para imagenes, archivos y documentacion.",
  ],
  importantNote:
    "Durante el primer ano, el dominio y el correo corporativo fueron cubiertos por el proveedor como parte del desarrollo inicial. A partir del segundo ano se incorporan dentro del costo mensual total del sistema.",
};

export const SERVICE_AGREEMENT_PLUS_PLAN = {
  title: "2) Plan Plus - Infraestructura + Mantenimiento",
  summary:
    "El Plan Plus incluye todo lo del plan de infraestructura y agrega mantenimiento tecnico preventivo y correctivo para preservar estabilidad y seguridad en el tiempo.",
  includedServices: [
    "Correccion de errores que aparezcan con el uso del sistema.",
    "Monitoreo tecnico basico.",
    "Copias de seguridad periodicas de la base de datos.",
    "Proteccion y recuperacion de informacion en caso de incidente.",
    "Actualizaciones de seguridad del sistema.",
    "Ajustes tecnicos para mantener la estabilidad.",
  ],
  exclusions: [
    "Nuevos modulos.",
    "Cambios en funcionalidades existentes.",
    "Rediseno del sistema.",
    "Expansiones o desarrollos adicionales.",
    "Cualquier modificacion estructural se cotiza como trabajo adicional.",
  ],
  businessRationale: [
    "La plataforma almacena informacion critica del negocio: datos de clientes, historial de servicios, imagenes de trabajos e informacion operativa.",
    "Sin mantenimiento tecnico, pueden aparecer errores de sistema, problemas de seguridad, perdida de informacion y fallos operativos.",
    "El Plan Plus funciona como una capa de proteccion tecnica para continuidad estable y segura.",
  ],
};

export const SERVICE_AGREEMENT_PLAN_PRICING: AgreementPlanRow[] = [
  {
    plan: "Infraestructura (Obligatorio)",
    year1: "$49.99 / mes",
    year2Plus: "$99.99 / mes",
  },
  {
    plan: "Infraestructura + Mantenimiento (Plan Plus)",
    year1: "$105.99 / mes",
    year2Plus: "$155.99 / mes",
  },
];

export const SERVICE_AGREEMENT_FEATURES: AgreementFeatureBlock[] = [
  {
    title: "1. Gestion de Acceso, Seguridad y Roles",
    summary:
      "Autenticacion centralizada con control por perfiles y rutas protegidas.",
    bullets: [
      "Roles nativos: ADMIN, TECH y CUSTOMER con permisos segmentados.",
      "Proteccion de rutas sensibles en middleware por rol.",
      "Recuperacion y restablecimiento seguro de contrasena por email.",
      "Sesion de usuario validada por token y endpoints de perfil.",
    ],
  },
  {
    title: "2. Operacion Administrativa (Admin Console)",
    summary:
      "Panel central para dirigir operacion diaria, supervisar equipo y ejecutar acciones criticas.",
    bullets: [
      "Dashboard ejecutivo con indicadores de trabajos, estado y alertas.",
      "Gestion de clientes, tecnicos, rutas, facturas y configuraciones del sistema.",
      "Centro de notificaciones administrativas y seguimiento de eventos.",
      "Reportes operativos y de facturacion con filtros avanzados.",
    ],
  },
  {
    title: "3. CRM Operativo de Clientes y Propiedades",
    summary:
      "Vista 360 del cliente con propiedades, documentos y actividad historica.",
    bullets: [
      "CRUD de clientes con estado de cuenta y datos de contacto.",
      "Gestion de propiedades con atributos tecnicos de piscina y acceso.",
      "Historial de trabajos e invoices por cliente.",
      "Repositorio de documentos del cliente con explorador de carpetas/archivos.",
    ],
  },
  {
    title: "4. Gestion de Tecnicos y Productividad de Campo",
    summary:
      "Administracion del talento tecnico y su carga operativa diaria.",
    bullets: [
      "Alta de tecnicos con invitacion por correo y activacion controlada.",
      "Perfil tecnico con color de calendario, estado y notas internas.",
      "Historial de trabajos, pendientes y completados por tecnico.",
      "Vista de actividad y desempeno desde modulo administrativo.",
    ],
  },
  {
    title: "5. Planificacion de Rutas y Calendario Operativo",
    summary:
      "Planificacion visual de servicios con control por fecha, prioridad y asignacion.",
    bullets: [
      "Calendario de rutas con edicion de trabajos por dia y tecnico.",
      "Filtros por urgencia, estado, asignacion y rango de fechas.",
      "Reordenamiento y reasignacion de trabajos en flujo de edicion.",
      "Asistente de rutas para proponer distribucion mas eficiente.",
    ],
  },
  {
    title: "6. Ciclo de Vida del Trabajo y Evidencia",
    summary:
      "Control completo del trabajo desde programado hasta completado con respaldo visual.",
    bullets: [
      "Estados operativos: scheduled, pending, on_the_way, in_progress, completed.",
      "Soporte para trabajos ROUTINE y ON_DEMAND.",
      "Carga de evidencia fotografica al cierre de servicio.",
      "Notas operativas y checklist tecnico por trabajo.",
    ],
  },
  {
    title: "7. Facturacion, PDF y Comunicacion Comercial",
    summary:
      "Proceso de factura estandarizado con generacion PDF y envio por email.",
    bullets: [
      "Creacion y edicion de facturas con line items y estados (draft/sent/paid/overdue).",
      "Plantilla configurable para apariencia y datos de invoice.",
      "Generacion de PDF y envio por SMTP con tracking de resultado.",
      "Portal cliente para consulta de facturas e historial.",
    ],
  },
  {
    title: "8. Notificaciones y Trazabilidad de Comunicacion",
    summary:
      "Sistema de notificaciones para eventos operativos y de cliente.",
    bullets: [
      "Eventos de servicio programado, reprogramado, completado, solicitudes y facturas.",
      "Preferencias de notificacion por usuario.",
      "Registro de envios email con estado QUEUED/SENT/FAILED.",
      "Panel administrativo para filtrar y limpiar historial de correos por criterio.",
    ],
  },
  {
    title: "9. Configuracion Empresarial y Contenido Corporativo",
    summary:
      "Herramientas de configuracion para marca, comunicacion y cumplimiento.",
    bullets: [
      "Ajustes de landing page, enlaces sociales y bloques de contenido.",
      "Editor de templates de email con vista previa.",
      "Gestion de contenido de compliance/legal por idioma.",
      "Configuracion SMTP y control de catalogo de servicios.",
    ],
  },
  {
    title: "10. Plataforma Tecnica, Integraciones y Continuidad",
    summary:
      "Base tecnica preparada para crecimiento y operacion continua.",
    bullets: [
      "Stack: Next.js, TypeScript, Prisma, PostgreSQL, Tailwind, pdf-lib.",
      "Integracion con Google Maps para direccionamiento y asistencia de rutas.",
      "Almacenamiento local o S3-compatible para archivos y evidencia.",
      "PWA instalable para operacion movil y pagina offline.",
      "Salud del sistema por endpoints de monitoreo y cron worker.",
    ],
  },
];

export const SERVICE_AGREEMENT_CLAUSES: AgreementClauseBlock[] = [
  {
    title: "A. Objeto del Servicio",
    paragraphs: [
      "El Proveedor entrega al Cliente acceso y uso de la plataforma AcostasPool en modalidad SaaS para la gestion de su operacion de servicios de piscinas.",
      "El alcance funcional contratado se define por modulos habilitados, ambientes disponibles y parametros operativos acordados en la propuesta comercial.",
    ],
  },
  {
    title: "B. Definiciones Contractuales Relevantes",
    paragraphs: [
      "Servicio: conjunto de funcionalidades, soporte y disponibilidad de plataforma.",
      "Usuario Autorizado: persona habilitada por el Cliente para operar la plataforma.",
      "Datos del Cliente: informacion ingresada por el Cliente y sus usuarios dentro de la plataforma.",
      "Periodo de Servicio: vigencia comercial durante la cual aplica el acceso y soporte.",
    ],
  },
  {
    title: "C. Alcance Funcional y Entregables",
    paragraphs: [
      "Se incluye acceso a modulos de administracion, operacion de rutas, gestion de trabajos, facturacion, notificaciones, reportes y portal cliente segun configuracion.",
      "Se incluye habilitacion inicial, configuracion base y puesta en marcha operativa.",
    ],
    bullets: [
      "Entregable 1: entorno de produccion operativo.",
      "Entregable 2: perfiles de usuario configurados.",
      "Entregable 3: flujos de trabajo y notificacion activos.",
      "Entregable 4: documentacion de uso para operacion diaria.",
    ],
  },
  {
    title: "D. Responsabilidades del Proveedor",
    paragraphs: [
      "Operar la plataforma con estandares razonables de disponibilidad y seguridad.",
      "Atender incidencias reportadas por canales definidos de soporte.",
      "Mantener continuidad evolutiva del producto segun roadmap tecnico.",
    ],
  },
  {
    title: "E. Responsabilidades del Cliente",
    paragraphs: [
      "Administrar usuarios autorizados y custodiar credenciales de acceso.",
      "Aportar datos veraces y mantener su informacion comercial actualizada.",
      "Usar la plataforma conforme a ley aplicable y politicas operativas del servicio.",
    ],
  },
  {
    title: "F. Tarifas, Facturacion y Pago",
    paragraphs: [
      "El Cliente pagara los cargos de suscripcion y/o implementacion conforme la propuesta economica aceptada.",
      "Cualquier servicio adicional fuera de alcance base se cotizara por separado y requerira aprobacion expresa.",
      "La mora en pagos puede derivar en suspension parcial o total del servicio, conforme a terminos comerciales acordados.",
    ],
  },
  {
    title: "G. Soporte y Niveles de Servicio (SLA Operativo)",
    paragraphs: [
      "El soporte contempla recepcion, diagnostico y seguimiento de incidencias funcionales y operativas.",
      "Se priorizan eventos criticos que afecten continuidad del negocio o seguridad de datos.",
    ],
    bullets: [
      "Severidad alta: impacto operativo mayor.",
      "Severidad media: degradacion funcional sin bloqueo total.",
      "Severidad baja: mejoras o ajustes no criticos.",
    ],
  },
  {
    title: "H. Confidencialidad y Proteccion de Datos",
    paragraphs: [
      "Ambas partes mantendran confidencialidad sobre informacion tecnica, comercial y operativa compartida durante la relacion contractual.",
      "El Proveedor tratara los Datos del Cliente bajo principios de minimizacion, acceso restringido y trazabilidad.",
      "Cada parte cumplira normativa aplicable a privacidad y seguridad segun su jurisdiccion y sector.",
    ],
  },
  {
    title: "I. Propiedad Intelectual",
    paragraphs: [
      "La plataforma, codigo fuente, arquitectura y componentes propietarios pertenecen al Proveedor.",
      "Los Datos del Cliente y sus documentos operativos permanecen bajo titularidad del Cliente.",
      "No se concede cesion de propiedad intelectual del software salvo acuerdo escrito expreso.",
    ],
  },
  {
    title: "J. Vigencia, Renovacion y Terminacion",
    paragraphs: [
      "La vigencia inicia en la Fecha Efectiva definida en el contrato comercial y se renueva segun modalidad acordada.",
      "Cualquiera de las partes podra terminar por incumplimiento material no subsanado en plazo de cura acordado.",
      "Al terminar, se ejecutara plan de salida para entrega o depuracion de datos segun politica vigente.",
    ],
  },
  {
    title: "K. Limitacion de Responsabilidad",
    paragraphs: [
      "La responsabilidad total del Proveedor se limita al monto efectivamente pagado por el Cliente en el periodo contractual definido, salvo dolo o conducta intencional grave segun ley aplicable.",
      "No aplica responsabilidad por danos indirectos, lucro cesante o consecuencias no previsibles fuera del control razonable del Proveedor.",
    ],
  },
  {
    title: "L. Ley Aplicable y Resolucion de Controversias",
    paragraphs: [
      "El acuerdo se regira por la ley definida en la caratula contractual.",
      "Las partes buscaran resolver controversias mediante instancia de negociacion ejecutiva previa a via judicial o arbitral.",
    ],
  },
  {
    title: "M. Garantia Inicial y Planes de Continuidad",
    paragraphs: [
      "El servicio incluye un periodo inicial de garantia total sin costo durante los primeros treinta (30) dias calendario posteriores a la entrega oficial.",
      "Concluido dicho periodo, la continuidad del sistema requiere la contratacion del Plan de Infraestructura (obligatorio), pudiendo el Cliente adicionar el Plan Plus para mantenimiento tecnico continuo.",
      "Los precios vigentes y el detalle de cobertura de cada plan forman parte de la propuesta comercial y se integran como anexo economico del contrato.",
    ],
  },
];

export const SERVICE_AGREEMENT_REFERENCES: AgreementReference[] = [
  {
    label: "SEC Exhibit 10.1 - License Agreement (estructura contractual)",
    url: "https://www.sec.gov/Archives/edgar/data/1145328/000101041211000534/equityagmtacnev8k.htm",
    note: "Referencia de formato legal con definiciones, grant, pagos, cumplimiento, confidencialidad y terminos.",
  },
  {
    label: "SEC Exhibit 10.1 - Transitional Services Agreement (estructura de servicios)",
    url: "https://www.sec.gov/Archives/edgar/data/1439288/000110465921123204/tm2129251d1_ex10-1.htm",
    note: "Referencia para secciones de alcance del servicio, facturacion, term, terminacion y cooperacion operativa.",
  },
  {
    label: "NIST SP 800-145 - Definicion de Cloud/SaaS",
    url: "https://csrc.nist.gov/pubs/sp/800/145/final",
    note: "Marco publico para definicion del modelo SaaS usado en la propuesta del servicio.",
  },
];

export const SERVICE_AGREEMENT_INTERNAL_SOURCES: AgreementReference[] = [
  {
    label: "PRD interno de plataforma",
    url: "/docs/PRD.md",
    note: "Objetivos, alcance y requerimientos funcionales de V1.",
  },
  {
    label: "Scope funcional V1",
    url: "/docs/Scope-V1.md",
    note: "Modulos funcionales, estados de trabajo y alcance operativo.",
  },
  {
    label: "Arquitectura y stack tecnico",
    url: "/docs/Architecture.md",
    note: "Fundamentos tecnologicos para operacion y escalabilidad.",
  },
  {
    label: "Modelo de datos",
    url: "/docs/DataModel.md",
    note: "Entidades principales y relaciones de negocio.",
  },
];
