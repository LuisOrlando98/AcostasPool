/**
 * User-facing texts accepted by the suite. Every pattern matches both locales
 * (src/i18n/messages/en.json and es.json) because seeded users are stored with
 * locale "ES" while anonymous visitors get the default "en".
 */
export const HEADINGS = {
  legalIndex: /Legal and compliance policies|Politicas legales y de cumplimiento/,
  loginHero: /Pool service|Gestión de servicios/,
  offline: /No internet connection|No hay conexion a internet/,
  unauthorized: /You don't have access|No tienes permisos/,
  adminDashboard: /Administration dashboard|Panel de administracion/,
  adminCustomers: /^(Customers|Clientes)$/,
  adminCustomerDetail: /^(Customer|Cliente): Cliente Demo$/,
  adminRoutes: /Routes & calendar|Rutas y calendario/,
  adminRouteAssistant: /Route assistant/,
  /** Encabezados propios del asistente de rutas (routes-assistant.spec.ts). */
  routeAssistant: {
    proposal: /^(Step 2 · Proposal|Paso 2 · Propuesta)$/,
    result: /^(Result|Resultado)$/,
    changes: /^(Changes to apply|Cambios a aplicar)$/,
  },
  adminInvoices: /^Billing$/,
  adminTechnicians: /^(Technicians|Tecnicos)$/,
  adminReports: /^(Reports|Reportes)$/,
  adminNotifications: /^(Notifications|Notificaciones)$/,
  adminSettings: /^(Settings|Ajustes)$/,
  adminHelp: /Help center|Centro de ayuda/,
  adminAgreement: /Service agreement|Acuerdo de servicio/,
  account: /My account|Mi cuenta/,
  techHome: /Technician route|Ruta del tecnico/,
  techHistory: /Technician history|Historial del tecnico/,
  techCalendar: /My calendar|Mi calendario/,
  techJobDetail: /Complete job|Completar trabajo/,
  clientHome: /Client portal|Portal del cliente/,
  clientInvoices: /^(Invoices|Facturas)$/,
  clientProperties: /My properties|Mis propiedades/,
  clientProfile: /My profile|Mi perfil/,
  clientRequest: /Quick service request|Solicitud de servicio rapido/,
  jobDetail: /Job details|Detalle del trabajo/,
} as const;

export const ACTIONS = {
  newCustomer: /New customer|Nuevo cliente/i,
  createCustomer: /Create customer|Crear cliente/i,
  newInvoice: /New invoice|Nueva factura/i,
  createInvoice: /Create invoice|Crear factura/i,
} as const;

export const LABELS = {
  description: /^(Description|Descripcion)$/i,
  quantity: /^(Qty|Cantidad)$/i,
  unitPrice: /^(Price|Precio)$/i,
} as const;

export const FEEDBACK = {
  customerCreated: /Customer saved successfully|Cliente guardado correctamente/,
  loginError: /incorrectos|Unable to sign in|No se pudo iniciar sesion/,
} as const;
