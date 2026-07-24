export type ServiceContractLocale = "en" | "es";

export type ServiceContractCopy = {
  headerLabel: string;
  documentTitle: string;
  intro: string;
  sections: {
    parties: string;
    propertyAndScope: string;
    paymentTerms: string;
    poolCondition: string;
    durationAndLiability: string;
    signatures: string;
  };
  fields: {
    company: string;
    address: string;
    contact: string;
    client: string;
    email: string;
    phone: string;
    clientAddress: string;
    propertyAddress: string;
    poolType: string;
    plan: string;
    servicePrice: string;
    startDate: string;
    paymentDay: string;
    paymentMethod: string;
    paymentType: string;
  };
  scopeParagraph: string;
  planServicesIntro: string;
  noPlanServices: string;
  paymentOverdueNote: string;
  durationBullets: string[];
  poolConditionEmpty: string;
  signatureCompany: string;
  signatureClient: string;
  signedOnLabel: string;
  closingNote: string;
  notAvailable: string;
};

export const SERVICE_CONTRACT_CONTENT: Record<ServiceContractLocale, ServiceContractCopy> = {
  en: {
    headerLabel: "SERVICE CONTRACT",
    documentTitle: "Pool Maintenance Service Contract",
    intro:
      "Document generated on {{date}}. This contract describes the terms of the pool maintenance service agreed between the parties below.",
    sections: {
      parties: "Parties to the contract",
      propertyAndScope: "Property and scope of service",
      paymentTerms: "Payment terms",
      poolCondition: "Pool condition",
      durationAndLiability: "Duration, cancellation, and liability",
      signatures: "Signatures",
    },
    fields: {
      company: "Company:",
      address: "Address:",
      contact: "Contact:",
      client: "Client:",
      email: "Email:",
      phone: "Phone:",
      clientAddress: "Client address:",
      propertyAddress: "Property address:",
      poolType: "Pool type:",
      plan: "Contracted plan/package:",
      servicePrice: "Service amount:",
      startDate: "Start date:",
      paymentDay: "Payment day:",
      paymentMethod: "Payment method:",
      paymentType: "Payment term:",
    },
    scopeParagraph:
      "The service includes routine pool cleaning and maintenance per the contracted plan, water chemical balancing, inspection of core equipment (pump, filter), and a condition report after each visit.",
    planServicesIntro: "Services included in this plan:",
    noPlanServices: "No plan checklist on file for this customer.",
    paymentOverdueNote:
      "Failure to pay within the agreed terms may result in temporary suspension of service until the account is brought current.",
    durationBullets: [
      "This contract renews automatically on a monthly basis unless either party gives notice of cancellation.",
      "The full applicable payment and cancellation policy is available at /legal/payment-cancellation-policy.",
      "The applicable disclaimer and limitation of liability is available at /legal/disclaimer-limitation-of-liability.",
      "The platform's general terms of service are available at /legal/terms-of-service.",
    ],
    poolConditionEmpty: "No pool condition assessment on file for this property.",
    signatureCompany: "AcostasPool Representative",
    signatureClient: "Client",
    signedOnLabel: "Signed on {{date}}",
    closingNote:
      "This document was generated electronically. Once signed by both parties, it constitutes a binding agreement between them. Please retain a copy for your records.",
    notAvailable: "N/A",
  },
  es: {
    headerLabel: "CONTRATO DE SERVICIO",
    documentTitle: "Contrato de Servicio de Mantenimiento de Piscina",
    intro:
      "Documento generado el {{date}}. Este contrato describe los terminos del servicio de mantenimiento de piscina acordado entre las partes indicadas a continuacion.",
    sections: {
      parties: "Partes del contrato",
      propertyAndScope: "Propiedad y alcance del servicio",
      paymentTerms: "Condiciones de pago",
      poolCondition: "Condicion de la piscina",
      durationAndLiability: "Duracion, cancelacion y responsabilidad",
      signatures: "Firmas",
    },
    fields: {
      company: "Empresa:",
      address: "Direccion:",
      contact: "Contacto:",
      client: "Cliente:",
      email: "Correo:",
      phone: "Telefono:",
      clientAddress: "Direccion del cliente:",
      propertyAddress: "Direccion de la propiedad:",
      poolType: "Tipo de piscina:",
      plan: "Paquete / plan contratado:",
      servicePrice: "Monto del servicio:",
      startDate: "Fecha de inicio:",
      paymentDay: "Dia de pago:",
      paymentMethod: "Metodo de pago:",
      paymentType: "Plazo de pago:",
    },
    scopeParagraph:
      "El servicio incluye limpieza y mantenimiento rutinario de la piscina segun el paquete contratado, balance quimico del agua, revision de equipo principal (bomba, filtro) y reporte de condicion tras cada visita.",
    planServicesIntro: "Servicios incluidos en este plan:",
    noPlanServices: "Este cliente no tiene un checklist de plan registrado.",
    paymentOverdueNote:
      "El incumplimiento de pago dentro de los terminos acordados puede resultar en la suspension temporal del servicio hasta regularizar la cuenta.",
    durationBullets: [
      "Este contrato se renueva automaticamente de forma mensual salvo notificacion de cancelacion por cualquiera de las partes.",
      "Las politicas completas de pago y cancelacion aplicables se encuentran en /legal/payment-cancellation-policy.",
      "El descargo de responsabilidad y limite de responsabilidad aplicable se encuentra en /legal/disclaimer-limitation-of-liability.",
      "Los terminos generales de servicio de la plataforma se encuentran en /legal/terms-of-service.",
    ],
    poolConditionEmpty: "Esta propiedad no tiene una evaluacion de condicion de piscina registrada.",
    signatureCompany: "Representante AcostasPool",
    signatureClient: "Cliente",
    signedOnLabel: "Firmado el {{date}}",
    closingNote:
      "Este documento fue generado electronicamente. Una vez firmado por ambas partes, constituye un acuerdo vinculante entre ellas. Por favor conserva una copia para tus registros.",
    notAvailable: "N/A",
  },
};
