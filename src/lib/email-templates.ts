export const EMAIL_TEMPLATE_IDS = [
  "CUSTOMER_INVITE",
  "TECH_ACCOUNT_INVITE",
  "PASSWORD_RESET",
  "INVOICE_SENT",
  "QUOTE_REQUEST",
  "CUSTOMER_SERVICE_SCHEDULED",
  "CUSTOMER_SERVICE_RESCHEDULED",
  "CUSTOMER_JOB_COMPLETED",
  "TECH_DAILY_DIGEST",
  "TECH_CHANGE_DIGEST",
  "CONTRACT_READY_TO_SIGN",
  "MEMBERSHIP_START_INVITE",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export type EmailTemplateContent = {
  subject: string;
  text: string;
  html: string;
};

export type EmailTemplatesConfig = Record<EmailTemplateId, EmailTemplateContent>;
export type EmailTemplateLocale = "EN" | "ES";
export type LocalizedEmailTemplatesConfig = Record<
  EmailTemplateId,
  Record<EmailTemplateLocale, EmailTemplateContent>
>;

type EmailTemplateDefinition = {
  label: string;
  description: string;
  placeholders: string[];
  defaults: EmailTemplateContent;
  previewValues: Record<string, string>;
};

export const EMAIL_TEMPLATE_DEFINITIONS: Record<EmailTemplateId, EmailTemplateDefinition> = {
  CUSTOMER_INVITE: {
    label: "Customer invite",
    description: "Invitation email used when creating portal access for a customer.",
    placeholders: [
      "{{customer_name}}",
      "{{customer_name_html}}",
      "{{invite_link}}",
      "{{invite_hours}}",
    ],
    defaults: {
      subject: "Welcome to AcostasPool - Complete your profile",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your client portal is ready. Complete your profile and create your password.",
        "Use this secure access link:",
        "{{invite_link}}",
        "",
        "This invitation expires in {{invite_hours}} hours.",
        "If you need help, reply to this message and our team will assist you.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<p style="margin:0 0 14px;color:#0b1f35;">Hi {{customer_name_html}},</p>',
        '<p style="margin:0 0 14px;color:#334155;">We invited you to complete your profile and set your password.</p>',
        '<p style="margin:0 0 14px;"><a href="{{invite_link}}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">Complete profile</a></p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">This link expires in {{invite_hours}} hours.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Alex Rivera",
      customer_name_html: "Alex Rivera",
      invite_link: "https://app.example.com/complete-profile?token=abc123",
      invite_hours: "48",
    },
  },
  TECH_ACCOUNT_INVITE: {
    label: "Technician account invite",
    description: "Invitation email used when creating portal access for a technician.",
    placeholders: [
      "{{tech_name}}",
      "{{tech_name_html}}",
      "{{invite_link}}",
      "{{invite_hours}}",
    ],
    defaults: {
      subject: "Welcome to AcostasPool - Complete your technician account",
      text: [
        "Hi {{tech_name}},",
        "",
        "Your technician account is ready. Review your details and create your password.",
        "Use this secure access link:",
        "{{invite_link}}",
        "",
        "This invitation expires in {{invite_hours}} hours.",
        "If you need help, reply to this message and our admin team will assist you.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<p style="margin:0 0 14px;color:#0b1f35;">Hi {{tech_name_html}},</p>',
        '<p style="margin:0 0 14px;color:#334155;">Your technician account is ready. Complete your profile and set your password.</p>',
        '<p style="margin:0 0 14px;"><a href="{{invite_link}}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">Complete profile</a></p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">This link expires in {{invite_hours}} hours.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      tech_name: "Carlos Diaz",
      tech_name_html: "Carlos Diaz",
      invite_link: "https://app.example.com/complete-profile?token=abc123",
      invite_hours: "48",
    },
  },
  PASSWORD_RESET: {
    label: "Password reset",
    description: "Email sent when a user requests to reset the account password.",
    placeholders: [
      "{{recipient_name}}",
      "{{recipient_name_html}}",
      "{{reset_link}}",
      "{{reset_hours}}",
    ],
    defaults: {
      subject: "Reset your AcostasPool password",
      text: [
        "Hi {{recipient_name}},",
        "",
        "We received a request to reset your password.",
        "Use this secure link: {{reset_link}}",
        "",
        "This link expires in {{reset_hours}} hours.",
        "If you didn't request this, you can ignore this message.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h3 style="margin:0 0 10px;color:#0b1f35;">Password reset request</h3>',
        '<p style="margin:0 0 12px;color:#334155;">Hi {{recipient_name_html}}, we received a request to reset your password.</p>',
        '<p style="margin:0 0 14px;"><a href="{{reset_link}}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">Reset password</a></p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">This link expires in {{reset_hours}} hours. If this was not you, ignore this email.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      recipient_name: "Alex Rivera",
      recipient_name_html: "Alex Rivera",
      reset_link: "https://app.example.com/reset?token=abc123",
      reset_hours: "2",
    },
  },
  INVOICE_SENT: {
    label: "Invoice sent",
    description: "Email sent to customers with the invoice PDF attached, with a direct pay link.",
    placeholders: [
      "{{customer_name}}",
      "{{customer_name_html}}",
      "{{invoice_number}}",
      "{{invoice_total}}",
      "{{pay_link}}",
      "{{portal_link}}",
    ],
    defaults: {
      subject: "Your AcostasPool invoice {{invoice_number}}",
      text: [
        "Hi {{customer_name}},",
        "",
        "You have received a new invoice from AcostasPool - {{invoice_number}} for {{invoice_total}}.",
        "It's attached to this email as a PDF.",
        "",
        "Pay it now:",
        "{{pay_link}}",
        "",
        "You can also pay it anytime from your customer portal:",
        "{{portal_link}}",
        "",
        "Thank you for choosing AcostasPool.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h2 style="margin:0 0 10px;color:#0b1f35;">Invoice {{invoice_number}}</h2>',
        '<p style="margin:0 0 14px;color:#334155;">Hi {{customer_name_html}}, you have received a new invoice for <strong>{{invoice_total}}</strong>. It\'s attached to this email as a PDF.</p>',
        '<p style="margin:0 0 14px;"><a href="{{pay_link}}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">Pay invoice now</a></p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">You can also pay it anytime from your <a href="{{portal_link}}" style="color:#0c4a6e;">customer portal</a>. Thank you for choosing AcostasPool.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Alex Rivera",
      customer_name_html: "Alex Rivera",
      invoice_number: "INV-1042",
      invoice_total: "$103.00",
      pay_link: "https://app.example.com/api/client/invoices/inv_123/checkout",
      portal_link: "https://app.example.com/client/invoices",
    },
  },
  QUOTE_REQUEST: {
    label: "Landing quote request",
    description: "Internal email sent to admin inbox when a lead submits the quote form.",
    placeholders: [
      "{{name}}",
      "{{name_html}}",
      "{{email}}",
      "{{email_html}}",
      "{{phone}}",
      "{{phone_html}}",
      "{{city}}",
      "{{city_html}}",
      "{{service}}",
      "{{service_html}}",
      "{{frequency}}",
      "{{frequency_html}}",
      "{{source}}",
      "{{source_html}}",
      "{{notes}}",
      "{{notes_html}}",
    ],
    defaults: {
      subject: "New quote request - {{city}} - {{name}}",
      text: [
        "New quote request received from landing form",
        "",
        "Name: {{name}}",
        "Email: {{email}}",
        "Phone: {{phone}}",
        "City: {{city}}",
        "Service: {{service}}",
        "Frequency: {{frequency}}",
        "Source: {{source}}",
        "",
        "Notes:",
        "{{notes}}",
        "",
        "Please follow up within the internal SLA window.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h2 style="margin:0 0 14px;color:#0b1f35;">New quote request received</h2>',
        '<p style="margin:0 0 8px;"><strong>Name:</strong> {{name_html}}</p>',
        '<p style="margin:0 0 8px;"><strong>Email:</strong> {{email_html}}</p>',
        '<p style="margin:0 0 8px;"><strong>Phone:</strong> {{phone_html}}</p>',
        '<p style="margin:0 0 8px;"><strong>City:</strong> {{city_html}}</p>',
        '<p style="margin:0 0 8px;"><strong>Service:</strong> {{service_html}}</p>',
        '<p style="margin:0 0 8px;"><strong>Frequency:</strong> {{frequency_html}}</p>',
        '<p style="margin:0 0 8px;"><strong>Source:</strong> {{source_html}}</p>',
        '<p style="margin:0;"><strong>Notes:</strong><br/>{{notes_html}}</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      name: "Jordan Miles",
      name_html: "Jordan Miles",
      email: "jordan@example.com",
      email_html: "jordan@example.com",
      phone: "+1 786 555 0199",
      phone_html: "+1 786 555 0199",
      city: "Doral",
      city_html: "Doral",
      service: "Regular maintenance",
      service_html: "Regular maintenance",
      frequency: "Weekly",
      frequency_html: "Weekly",
      source: "landing",
      source_html: "landing",
      notes: "Need service before Saturday.",
      notes_html: "Need service before Saturday.",
    },
  },
  CUSTOMER_SERVICE_SCHEDULED: {
    label: "Customer service scheduled",
    description: "Notification email when a service is scheduled for a customer.",
    placeholders: [
      "{{customer_name}}",
      "{{customer_name_html}}",
      "{{scheduled_label}}",
      "{{scheduled_label_html}}",
      "{{job_address}}",
      "{{job_address_html}}",
    ],
    defaults: {
      subject: "Servicio confirmado - {{scheduled_label}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu servicio ha sido confirmado para {{scheduled_label}}.",
        "Nuestro equipo llegara dentro del rango planificado.",
        "Si necesitas cambiar la fecha, por favor contactanos.",
        "",
        "Direccion: {{job_address}}",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h3 style="margin:0 0 10px;color:#0b1f35;">Servicio programado</h3>',
        '<p style="margin:0 0 10px;color:#334155;">Hola {{customer_name_html}}, tu servicio esta programado para <strong>{{scheduled_label_html}}</strong>.</p>',
        '<p style="margin:0;color:#64748b;">Direccion: {{job_address_html}}</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Cliente",
      customer_name_html: "Cliente",
      scheduled_label: "Mar 01, 2026 09:30 AM",
      scheduled_label_html: "Mar 01, 2026 09:30 AM",
      job_address: "123 Palm Ave, Miami, FL",
      job_address_html: "123 Palm Ave, Miami, FL",
    },
  },
  CUSTOMER_SERVICE_RESCHEDULED: {
    label: "Customer service rescheduled",
    description: "Notification email when a customer service is rescheduled.",
    placeholders: [
      "{{customer_name}}",
      "{{customer_name_html}}",
      "{{scheduled_label}}",
      "{{scheduled_label_html}}",
      "{{job_address}}",
      "{{job_address_html}}",
    ],
    defaults: {
      subject: "Servicio reprogramado - {{scheduled_label}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu servicio ha sido reprogramado para {{scheduled_label}}.",
        "Lamentamos el cambio y agradecemos tu comprension.",
        "Si tienes dudas, por favor responde a este correo.",
        "",
        "Direccion: {{job_address}}",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h3 style="margin:0 0 10px;color:#0b1f35;">Servicio reprogramado</h3>',
        '<p style="margin:0 0 10px;color:#334155;">Hola {{customer_name_html}}, tu servicio ha sido reprogramado para <strong>{{scheduled_label_html}}</strong>.</p>',
        '<p style="margin:0;color:#64748b;">Direccion: {{job_address_html}}</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Cliente",
      customer_name_html: "Cliente",
      scheduled_label: "Mar 02, 2026 02:00 PM",
      scheduled_label_html: "Mar 02, 2026 02:00 PM",
      job_address: "123 Palm Ave, Miami, FL",
      job_address_html: "123 Palm Ave, Miami, FL",
    },
  },
  CUSTOMER_JOB_COMPLETED: {
    label: "Customer job completed",
    description: "Notification email when a technician completes a service with evidence.",
    placeholders: [
      "{{customer_name}}",
      "{{customer_name_html}}",
      "{{technician_name}}",
      "{{technician_name_html}}",
      "{{completed_label}}",
      "{{completed_label_html}}",
      "{{job_address}}",
      "{{job_address_html}}",
    ],
    defaults: {
      subject: "Servicio completado - {{completed_label}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu servicio fue completado por {{technician_name}}.",
        "Hora de finalizacion: {{completed_label}}.",
        "",
        "Direccion: {{job_address}}",
        "Puedes revisar las evidencias en tu portal de cliente.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h3 style="margin:0 0 10px;color:#0b1f35;">Servicio completado</h3>',
        '<p style="margin:0 0 10px;color:#334155;">Hola {{customer_name_html}}, tu servicio fue completado por <strong>{{technician_name_html}}</strong>.</p>',
        '<p style="margin:0 0 10px;color:#334155;">Hora de finalizacion: <strong>{{completed_label_html}}</strong>.</p>',
        '<p style="margin:0;color:#64748b;">Direccion: {{job_address_html}}</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Cliente",
      customer_name_html: "Cliente",
      technician_name: "Carlos Diaz",
      technician_name_html: "Carlos Diaz",
      completed_label: "Mar 04, 2026 03:10 PM",
      completed_label_html: "Mar 04, 2026 03:10 PM",
      job_address: "123 Palm Ave, Miami, FL",
      job_address_html: "123 Palm Ave, Miami, FL",
    },
  },
  TECH_DAILY_DIGEST: {
    label: "Tech daily route digest",
    description: "Morning route digest sent to technicians.",
    placeholders: ["{{tech_name}}", "{{tech_name_html}}", "{{route_date}}", "{{lines_text}}", "{{lines_html}}"],
    defaults: {
      subject: "Ruta diaria confirmada - {{tech_name}} - {{route_date}}",
      text: [
        "Hola {{tech_name}},",
        "",
        "Esta es tu ruta para hoy ({{route_date}}):",
        "{{lines_text}}",
        "",
        "Recibiras actualizaciones durante el dia si hay cambios.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h3 style="margin:0 0 10px;color:#0b1f35;">Ruta diaria</h3>',
        '<p style="margin:0 0 10px;color:#334155;">Hola {{tech_name_html}}, esta es tu ruta para hoy ({{route_date}}):</p>',
        "<ol style=\"margin:0 0 12px;padding-left:20px;color:#334155;\">{{lines_html}}</ol>",
        '<p style="margin:0;color:#64748b;">Recibiras actualizaciones a las 12:00pm y 9:00pm si hay cambios.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      tech_name: "Carlos Diaz",
      tech_name_html: "Carlos Diaz",
      route_date: "03/01/2026",
      lines_text:
        "1. Mar 01, 2026 09:00 AM - Cliente 1 - 123 Palm Ave\n2. Mar 01, 2026 11:00 AM - Cliente 2 - 77 Ocean Dr",
      lines_html:
        "<li>Mar 01, 2026 09:00 AM - Cliente 1 - 123 Palm Ave</li><li>Mar 01, 2026 11:00 AM - Cliente 2 - 77 Ocean Dr</li>",
    },
  },
  TECH_CHANGE_DIGEST: {
    label: "Tech route changes digest",
    description: "Midday/evening digest when route changes are detected.",
    placeholders: ["{{tech_name}}", "{{tech_name_html}}", "{{route_date}}", "{{lines_text}}", "{{lines_html}}"],
    defaults: {
      subject: "Actualizacion de ruta - {{tech_name}} - {{route_date}}",
      text: [
        "Hola {{tech_name}},",
        "",
        "Cambios detectados en tu ruta del {{route_date}}:",
        "{{lines_text}}",
        "",
        "Si necesitas aclaraciones, contacta al administrador de operaciones.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:620px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h3 style="margin:0 0 10px;color:#0b1f35;">Cambios de ruta</h3>',
        '<p style="margin:0 0 10px;color:#334155;">Hola {{tech_name_html}}, estos son los cambios detectados en tu ruta del {{route_date}}:</p>',
        "<ol style=\"margin:0 0 12px;padding-left:20px;color:#334155;\">{{lines_html}}</ol>",
        '<p style="margin:0;color:#64748b;">Si necesitas aclaraciones, contacta al administrador.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      tech_name: "Carlos Diaz",
      tech_name_html: "Carlos Diaz",
      route_date: "03/01/2026",
      lines_text:
        "1. Reprogramado: Cliente 1 - 123 Palm Ave (09:00 AM -> 11:00 AM)\n2. Trabajo asignado: Cliente 3 - 44 Lake Rd (01:30 PM)",
      lines_html:
        "<li>Reprogramado: Cliente 1 - 123 Palm Ave (09:00 AM -> 11:00 AM)</li><li>Trabajo asignado: Cliente 3 - 44 Lake Rd (01:30 PM)</li>",
    },
  },
  CONTRACT_READY_TO_SIGN: {
    label: "Contract ready to sign",
    description: "Sent to a customer when their service contract is ready for their signature.",
    placeholders: ["{{customer_name}}", "{{customer_name_html}}", "{{contract_link}}"],
    defaults: {
      subject: "Your AcostasPool service contract is ready to sign",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your pool service contract is ready for your review and signature.",
        "Open it here:",
        "{{contract_link}}",
        "",
        "You can sign it with your finger on your phone or with your mouse on a computer.",
        "If you have any questions, reply to this message and our team will assist you.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<p style="margin:0 0 14px;color:#0b1f35;">Hi {{customer_name_html}},</p>',
        '<p style="margin:0 0 14px;color:#334155;">Your pool service contract is ready for your review and signature.</p>',
        '<p style="margin:0 0 14px;"><a href="{{contract_link}}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">Review and sign</a></p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">You can sign with your finger on your phone or your mouse on a computer.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Alex Rivera",
      customer_name_html: "Alex Rivera",
      contract_link: "https://app.example.com/client/contract",
    },
  },
  MEMBERSHIP_START_INVITE: {
    label: "Membership start invite",
    description: "Sent to a customer to start their service: sign the contract if pending, then set up monthly autopay.",
    placeholders: [
      "{{customer_name}}",
      "{{customer_name_html}}",
      "{{activation_link}}",
      "{{property_address}}",
      "{{property_address_html}}",
      "{{monthly_amount}}",
    ],
    defaults: {
      subject: "Let's get your AcostasPool service started",
      text: [
        "Hi {{customer_name}},",
        "",
        "Let's get your pool service at {{property_address}} up and running.",
        "Open this secure link to review your contract (if pending) and set up automatic monthly billing of {{monthly_amount}}:",
        "{{activation_link}}",
        "",
        "Autopay stays active until you or AcostasPool cancel it - you're always in control.",
        "If you have any questions, reply to this message and our team will assist you.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<p style="margin:0 0 14px;color:#0b1f35;">Hi {{customer_name_html}},</p>',
        '<p style="margin:0 0 14px;color:#334155;">Let\'s get your pool service at {{property_address_html}} up and running.</p>',
        '<p style="margin:0 0 14px;"><a href="{{activation_link}}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#0ea5e9;color:#ffffff;text-decoration:none;font-weight:700;">Start my service</a></p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">Monthly autopay of {{monthly_amount}} stays active until you or AcostasPool cancel it.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Alex Rivera",
      customer_name_html: "Alex Rivera",
      activation_link: "https://app.example.com/client/membership/activate?propertyId=123",
      property_address: "123 Palm Ave",
      property_address_html: "123 Palm Ave",
      monthly_amount: "$103.00",
    },
  },
};

const EMAIL_TEMPLATE_LOCALES: readonly EmailTemplateLocale[] = ["EN", "ES"];

type LocalizedEmailTemplateDefaultsInput = Partial<
  Record<EmailTemplateId, Record<EmailTemplateLocale, { subject: string; text: string }>>
>;

const LOCALIZED_EMAIL_TEMPLATE_DEFAULTS: LocalizedEmailTemplateDefaultsInput = {
  CUSTOMER_INVITE: {
    EN: {
      subject: "Welcome to AcostasPool - Complete your profile",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your client portal is ready. Complete your profile and create your password.",
        "Use this secure access link:",
        "{{invite_link}}",
        "",
        "This invitation expires in {{invite_hours}} hours.",
        "If you need help, reply to this message and our team will assist you.",
      ].join("\n"),
    },
    ES: {
      subject: "Bienvenido a AcostasPool - Completa tu perfil",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu portal de cliente ya esta listo. Completa tu perfil y crea tu contrasena.",
        "Usa este enlace de acceso seguro:",
        "{{invite_link}}",
        "",
        "Esta invitacion vence en {{invite_hours}} horas.",
        "Si necesitas ayuda, responde este mensaje y nuestro equipo te apoyara.",
      ].join("\n"),
    },
  },
  PASSWORD_RESET: {
    EN: {
      subject: "Reset your AcostasPool password",
      text: [
        "Hi {{recipient_name}},",
        "",
        "We received a request to reset your password.",
        "Use this secure link: {{reset_link}}",
        "",
        "This link expires in {{reset_hours}} hours.",
        "If you didn't request this, you can ignore this message.",
      ].join("\n"),
    },
    ES: {
      subject: "Restablece tu contrasena de AcostasPool",
      text: [
        "Hola {{recipient_name}},",
        "",
        "Recibimos una solicitud para restablecer tu contrasena.",
        "Usa este enlace seguro: {{reset_link}}",
        "",
        "Este enlace vence en {{reset_hours}} horas.",
        "Si no hiciste esta solicitud, puedes ignorar este mensaje.",
      ].join("\n"),
    },
  },
  INVOICE_SENT: {
    EN: {
      subject: "Your AcostasPool invoice {{invoice_number}}",
      text: [
        "Hi {{customer_name}},",
        "",
        "You have received a new invoice from AcostasPool - {{invoice_number}} for {{invoice_total}}.",
        "It's attached to this email as a PDF.",
        "",
        "Pay it now:",
        "{{pay_link}}",
        "",
        "You can also pay it anytime from your customer portal:",
        "{{portal_link}}",
        "",
        "Thank you for choosing AcostasPool.",
      ].join("\n"),
    },
    ES: {
      subject: "Tu factura de AcostasPool {{invoice_number}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Has recibido una nueva factura de AcostasPool - {{invoice_number}} por {{invoice_total}}.",
        "Esta adjunta a este correo en PDF.",
        "",
        "Pagala ahora:",
        "{{pay_link}}",
        "",
        "Tambien puedes pagarla en cualquier momento desde tu portal de cliente:",
        "{{portal_link}}",
        "",
        "Gracias por elegir AcostasPool.",
      ].join("\n"),
    },
  },
  CUSTOMER_SERVICE_SCHEDULED: {
    EN: {
      subject: "Service confirmed - {{scheduled_label}}",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your service has been confirmed for {{scheduled_label}}.",
        "Our team will arrive within the planned window.",
        "If you need to reschedule, please contact us.",
        "",
        "Address: {{job_address}}",
      ].join("\n"),
    },
    ES: {
      subject: "Servicio confirmado - {{scheduled_label}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu servicio ha sido confirmado para {{scheduled_label}}.",
        "Nuestro equipo llegara dentro del rango planificado.",
        "Si necesitas cambiar la fecha, por favor contactanos.",
        "",
        "Direccion: {{job_address}}",
      ].join("\n"),
    },
  },
  CUSTOMER_SERVICE_RESCHEDULED: {
    EN: {
      subject: "Service rescheduled - {{scheduled_label}}",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your service has been rescheduled for {{scheduled_label}}.",
        "We apologize for the change and appreciate your understanding.",
        "If you have any questions, please reply to this email.",
        "",
        "Address: {{job_address}}",
      ].join("\n"),
    },
    ES: {
      subject: "Servicio reprogramado - {{scheduled_label}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu servicio ha sido reprogramado para {{scheduled_label}}.",
        "Lamentamos el cambio y agradecemos tu comprension.",
        "Si tienes dudas, por favor responde a este correo.",
        "",
        "Direccion: {{job_address}}",
      ].join("\n"),
    },
  },
  CUSTOMER_JOB_COMPLETED: {
    EN: {
      subject: "Service completed - {{completed_label}}",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your service was completed by {{technician_name}}.",
        "Completion time: {{completed_label}}.",
        "",
        "Address: {{job_address}}",
        "You can review job evidence in your client portal.",
      ].join("\n"),
    },
    ES: {
      subject: "Servicio completado - {{completed_label}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu servicio fue completado por {{technician_name}}.",
        "Hora de finalizacion: {{completed_label}}.",
        "",
        "Direccion: {{job_address}}",
        "Puedes revisar las evidencias en tu portal de cliente.",
      ].join("\n"),
    },
  },
  CONTRACT_READY_TO_SIGN: {
    EN: {
      subject: "Your AcostasPool service contract is ready to sign",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your pool service contract is ready for your review and signature.",
        "Open it here:",
        "{{contract_link}}",
        "",
        "You can sign it with your finger on your phone or with your mouse on a computer.",
        "If you have any questions, reply to this message and our team will assist you.",
      ].join("\n"),
    },
    ES: {
      subject: "Tu contrato de servicio de AcostasPool esta listo para firmar",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu contrato de servicio de piscina esta listo para tu revision y firma.",
        "Abrelo aqui:",
        "{{contract_link}}",
        "",
        "Puedes firmarlo con el dedo desde tu telefono o con el mouse desde tu computadora.",
        "Si tienes dudas, responde este mensaje y nuestro equipo te apoyara.",
      ].join("\n"),
    },
  },
  MEMBERSHIP_START_INVITE: {
    EN: {
      subject: "Let's get your AcostasPool service started",
      text: [
        "Hi {{customer_name}},",
        "",
        "Let's get your pool service at {{property_address}} up and running.",
        "Open this secure link to review your contract (if pending) and set up automatic monthly billing of {{monthly_amount}}:",
        "{{activation_link}}",
        "",
        "Autopay stays active until you or AcostasPool cancel it - you're always in control.",
        "If you have any questions, reply to this message and our team will assist you.",
      ].join("\n"),
    },
    ES: {
      subject: "Vamos a iniciar tu servicio de AcostasPool",
      text: [
        "Hola {{customer_name}},",
        "",
        "Vamos a activar tu servicio de piscina en {{property_address}}.",
        "Abre este enlace seguro para revisar tu contrato (si esta pendiente) y configurar el cobro automatico mensual de {{monthly_amount}}:",
        "{{activation_link}}",
        "",
        "El cobro automatico permanece activo hasta que tu o AcostasPool lo cancelen - tu tienes el control.",
        "Si tienes dudas, responde este mensaje y nuestro equipo te apoyara.",
      ].join("\n"),
    },
  },
};

const SPANISH_HINT_PATTERN =
  /\b(hola|servicio|factura|correo|gracias|direccion|reprogramado|completado|contrasena|solicitud)\b/i;
const ENGLISH_HINT_PATTERN =
  /\b(hi|hello|service|invoice|email|thanks|address|rescheduled|completed|password|request|welcome)\b/i;

const TEMPLATE_TOKEN = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

function interpolateTemplate(content: string, variables: Record<string, string>) {
  return content.replace(TEMPLATE_TOKEN, (_match, key: string) => variables[key] ?? "");
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildEmailButtonHtml(hrefToken: string, label: string, backgroundColor: string) {
  return [
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 18px;border-collapse:separate;">',
    "<tr>",
    `<td bgcolor="${backgroundColor}" style="border-radius:999px;background-color:${backgroundColor};text-align:center;">`,
    `<a href="${hrefToken}" style="display:inline-block;padding:12px 20px;border-radius:999px;background-color:${backgroundColor};color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;line-height:1.2;">${escapeHtml(
      label
    )}</a>`,
    "</td>",
    "</tr>",
    "</table>",
  ].join("");
}

function getTemplateButtonHtml(templateId: EmailTemplateId, token: string) {
  if (token === "{{invite_link}}") {
    return buildEmailButtonHtml(
      token,
      templateId === "TECH_ACCOUNT_INVITE" ? "Complete account" : "Complete profile",
      "#18b978"
    );
  }

  if (token === "{{reset_link}}") {
    return buildEmailButtonHtml(token, "Reset password", "#0ea5e9");
  }

  if (token === "{{contract_link}}") {
    return buildEmailButtonHtml(token, "Review and sign", "#18b978");
  }

  return "";
}

function buildEmailBodyBlocks(templateId: EmailTemplateId, text: string) {
  const rawLines = text.replace(/\r/g, "").split("\n");
  const blocks: string[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }
    blocks.push(
      `<ul style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">${listItems
        .map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`)
        .join("")}</ul>`
    );
    listItems = [];
  };

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      continue;
    }

    if (
      trimmed === "{{invite_link}}" ||
      trimmed === "{{reset_link}}" ||
      trimmed === "{{contract_link}}"
    ) {
      flushList();
      blocks.push(getTemplateButtonHtml(templateId, trimmed));
      continue;
    }

    if (trimmed === "{{lines_text}}") {
      flushList();
      if (templateId === "TECH_DAILY_DIGEST" || templateId === "TECH_CHANGE_DIGEST") {
        blocks.push(
          '<ol style="margin:0 0 16px;padding-left:20px;color:#334155;line-height:1.6;">{{lines_html}}</ol>'
        );
      } else {
        blocks.push(
          '<p style="margin:0 0 12px;color:#334155;line-height:1.65;">{{lines_text}}</p>'
        );
      }
      continue;
    }

    if (/^[-*]\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^[-*]\s+/, ""));
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      listItems.push(trimmed.replace(/^\d+\.\s+/, ""));
      continue;
    }

    flushList();
    blocks.push(
      `<p style="margin:0 0 12px;color:#334155;line-height:1.65;">${escapeHtml(trimmed)}</p>`
    );
  }

  flushList();
  return blocks.join("");
}

export function buildPremiumEmailTemplateHtml(
  templateId: EmailTemplateId,
  subject: string,
  text: string
) {
  const meta = EMAIL_TEMPLATE_DEFINITIONS[templateId];
  const bodyBlocks = buildEmailBodyBlocks(templateId, text);
  const appUrlRaw = process.env.APP_URL?.trim() || "https://acostaspool.com";
  const appUrlNormalized = /^https?:\/\//i.test(appUrlRaw) ? appUrlRaw : `https://${appUrlRaw}`;
  let appOrigin = "https://acostaspool.com";
  try {
    appOrigin = new URL(appUrlNormalized).origin.replace(/\/+$/, "");
  } catch {
    appOrigin = "https://acostaspool.com";
  }
  const legalCenterUrl = `${appOrigin}/legal`;
  const privacyUrl = `${appOrigin}/legal/privacy-policy`;
  const termsUrl = `${appOrigin}/legal/terms-of-service`;
  const paymentUrl = `${appOrigin}/legal/payment-cancellation-policy`;
  const disclaimerUrl = `${appOrigin}/legal/disclaimer-limitation-of-liability`;
  const cookieUrl = `${appOrigin}/legal/cookie-notice`;

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    "<body style=\"margin:0;padding:0;background-color:#edf2f7;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;\">",
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#edf2f7" style="width:100%;margin:0;padding:0;border-collapse:collapse;background-color:#edf2f7;">',
    "<tr>",
    '<td align="center" style="padding:24px 16px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;border-collapse:separate;">',
    "<tr>",
    '<td style="border:1px solid #d7e3f0;border-radius:20px;background-color:#ffffff;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="width:100%;border-collapse:separate;background-color:#ffffff;border-radius:20px;">',
    "<tr>",
    '<td bgcolor="#0b4f7f" style="padding:18px 22px;background-color:#0b4f7f;background-image:linear-gradient(140deg,#0b3b66,#0ea5e9);border-radius:20px 20px 0 0;color:#ffffff;">',
    '<p style="margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:#e8f7ff;">ACOSTASPOOL</p>',
    `<h2 style="margin:8px 0 0;font-size:19px;line-height:1.3;font-weight:800;color:#ffffff;">${escapeHtml(
      meta.label
    )}</h2>`,
    `<p style="margin:8px 0 0;font-size:13px;line-height:1.45;color:#eaf7ff;">${escapeHtml(
      subject
    )}</p>`,
    "</td>",
    "</tr>",
    "<tr>",
    '<td style="padding:22px 22px 16px;background-color:#ffffff;color:#0f172a;font-family:Arial,\'Helvetica Neue\',Helvetica,sans-serif;">',
    bodyBlocks,
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:18px;border-collapse:separate;">',
    "<tr>",
    '<td bgcolor="#f8fbff" style="padding:12px 14px;border:1px solid #d8e5f2;border-radius:12px;background-color:#f8fbff;">',
    '<p style="margin:0 0 7px;color:#0f172a;font-size:12px;font-weight:700;">Need help?</p>',
    '<p style="margin:0;color:#475569;font-size:12px;line-height:1.55;">Reply to this email or contact <a href="mailto:contact@acostaspool.com" style="color:#0c4a6e;text-decoration:underline;">contact@acostaspool.com</a>.</p>',
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "<tr>",
    '<td bgcolor="#f8fafc" style="padding:12px 22px;border-top:1px solid #e2e8f0;background-color:#f8fafc;border-radius:0 0 20px 20px;">',
    `<p style="margin:0 0 6px;color:#475569;font-size:11px;line-height:1.5;">Legal: <a href="${legalCenterUrl}" style="color:#0c4a6e;text-decoration:underline;">Legal Center</a> | <a href="${privacyUrl}" style="color:#0c4a6e;text-decoration:underline;">Privacy Policy</a> | <a href="${termsUrl}" style="color:#0c4a6e;text-decoration:underline;">Terms of Service</a></p>`,
    `<p style="margin:0 0 7px;color:#64748b;font-size:10px;line-height:1.5;">More policies: <a href="${paymentUrl}" style="color:#0c4a6e;text-decoration:underline;">Payment and Cancellation</a> | <a href="${disclaimerUrl}" style="color:#0c4a6e;text-decoration:underline;">Disclaimer and Liability</a> | <a href="${cookieUrl}" style="color:#0c4a6e;text-decoration:underline;">Cookie Notice</a></p>`,
    '<p style="margin:0 0 4px;color:#0f172a;font-size:11px;line-height:1.45;font-weight:700;">Digitally signed by AcostasPool Operations Team</p>',
    '<p style="margin:0;color:#64748b;font-size:10px;line-height:1.45;">AcostasPool | Premium pool operations | contact@acostaspool.com</p>',
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</td>",
    "</tr>",
    "</table>",
    "</body>",
    "</html>",
  ].join("");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function getDefaultTemplateCopyByLocale(
  templateId: EmailTemplateId,
  locale: EmailTemplateLocale
) {
  const localized = LOCALIZED_EMAIL_TEMPLATE_DEFAULTS[templateId]?.[locale];
  if (localized) {
    return localized;
  }
  const defaults = EMAIL_TEMPLATE_DEFINITIONS[templateId].defaults;
  return {
    subject: defaults.subject,
    text: defaults.text,
  };
}

function buildTemplateContent(
  templateId: EmailTemplateId,
  subject: string,
  text: string
): EmailTemplateContent {
  return {
    subject,
    text,
    html: buildPremiumEmailTemplateHtml(templateId, subject, text),
  };
}

function detectSnippetLocale(value: string): EmailTemplateLocale | null {
  const snippet = value.trim();
  if (!snippet) {
    return null;
  }
  const hasSpanishHints = SPANISH_HINT_PATTERN.test(snippet);
  const hasEnglishHints = ENGLISH_HINT_PATTERN.test(snippet);
  if (hasSpanishHints && !hasEnglishHints) {
    return "ES";
  }
  if (hasEnglishHints && !hasSpanishHints) {
    return "EN";
  }
  return null;
}

function alignSubjectToBodyLocale(
  locale: EmailTemplateLocale,
  subject: string,
  text: string,
  fallbackSubject: string
) {
  const safeSubject = subject.trim();
  if (!safeSubject) {
    return fallbackSubject;
  }

  const subjectLocale = detectSnippetLocale(safeSubject);
  const bodyLocale = detectSnippetLocale(text);
  if (!subjectLocale || !bodyLocale || subjectLocale === bodyLocale) {
    return safeSubject;
  }
  if (bodyLocale === locale) {
    return fallbackSubject;
  }
  return safeSubject;
}

function guessTemplateLocale(content: EmailTemplateContent): EmailTemplateLocale {
  const haystack = `${content.subject}\n${content.text}\n${content.html}`;
  return SPANISH_HINT_PATTERN.test(haystack) ? "ES" : "EN";
}

function normalizeTemplateForLocale(
  templateId: EmailTemplateId,
  locale: EmailTemplateLocale,
  value: unknown,
  fallback: EmailTemplateContent
) {
  const normalized = normalizeEmailTemplateContent(value, fallback);
  const subject = alignSubjectToBodyLocale(
    locale,
    normalized.subject,
    normalized.text,
    fallback.subject
  );
  return buildTemplateContent(templateId, subject, normalized.text);
}

export function resolveEmailTemplateLocale(
  locale: string | null | undefined
): EmailTemplateLocale {
  const normalized = String(locale ?? "")
    .trim()
    .toUpperCase();
  if (normalized.startsWith("ES")) {
    return "ES";
  }
  return "EN";
}

export function getDefaultEmailTemplatesConfig(
  locale: EmailTemplateLocale = "EN"
): EmailTemplatesConfig {
  return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
    const defaults = getDefaultTemplateCopyByLocale(templateId, locale);
    acc[templateId] = buildTemplateContent(
      templateId,
      defaults.subject,
      defaults.text
    );
    return acc;
  }, {} as EmailTemplatesConfig);
}

export function getDefaultLocalizedEmailTemplatesConfig(): LocalizedEmailTemplatesConfig {
  const defaultsByLocale: Record<EmailTemplateLocale, EmailTemplatesConfig> =
    EMAIL_TEMPLATE_LOCALES.reduce((acc, locale) => {
      acc[locale] = getDefaultEmailTemplatesConfig(locale);
      return acc;
    }, {} as Record<EmailTemplateLocale, EmailTemplatesConfig>);

  return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
    acc[templateId] = EMAIL_TEMPLATE_LOCALES.reduce((localized, locale) => {
      localized[locale] = defaultsByLocale[locale][templateId];
      return localized;
    }, {} as Record<EmailTemplateLocale, EmailTemplateContent>);
    return acc;
  }, {} as LocalizedEmailTemplatesConfig);
}

export function normalizeEmailTemplateContent(
  value: unknown,
  fallback: EmailTemplateContent
): EmailTemplateContent {
  const input = asRecord(value) ?? {};

  return {
    subject: String(input.subject ?? fallback.subject),
    text: String(input.text ?? fallback.text),
    html: String(input.html ?? fallback.html),
  };
}

export function normalizeLocalizedEmailTemplates(value: unknown): LocalizedEmailTemplatesConfig {
  const input = asRecord(value) ?? {};
  const defaults = getDefaultLocalizedEmailTemplatesConfig();

  return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
    const rawTemplate = asRecord(input[templateId]);
    if (!rawTemplate) {
      acc[templateId] = defaults[templateId];
      return acc;
    }

    const localizedEN = asRecord(rawTemplate.EN);
    const localizedES = asRecord(rawTemplate.ES);

    if (localizedEN || localizedES) {
      acc[templateId] = {
        EN: normalizeTemplateForLocale(
          templateId,
          "EN",
          localizedEN ?? localizedES,
          defaults[templateId].EN
        ),
        ES: normalizeTemplateForLocale(
          templateId,
          "ES",
          localizedES ?? localizedEN,
          defaults[templateId].ES
        ),
      };
      return acc;
    }

    const legacyContentEN = normalizeTemplateForLocale(
      templateId,
      "EN",
      rawTemplate,
      defaults[templateId].EN
    );
    const guessedLocale = guessTemplateLocale(legacyContentEN);
    const legacyContent = normalizeTemplateForLocale(
      templateId,
      guessedLocale,
      rawTemplate,
      defaults[templateId][guessedLocale]
    );
    const otherLocale: EmailTemplateLocale = guessedLocale === "EN" ? "ES" : "EN";

    acc[templateId] = {
      EN: guessedLocale === "EN" ? legacyContent : defaults[templateId].EN,
      ES: guessedLocale === "ES" ? legacyContent : defaults[templateId].ES,
    };
    acc[templateId][otherLocale] = defaults[templateId][otherLocale];
    return acc;
  }, {} as LocalizedEmailTemplatesConfig);
}

export function normalizeEmailTemplates(
  value: unknown,
  locale: EmailTemplateLocale = "EN"
): EmailTemplatesConfig {
  const resolvedLocale = resolveEmailTemplateLocale(locale);
  const localized = normalizeLocalizedEmailTemplates(value);
  return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
    acc[templateId] = localized[templateId][resolvedLocale];
    return acc;
  }, {} as EmailTemplatesConfig);
}

export function renderEmailTemplate(
  template: EmailTemplateContent,
  variables: Record<string, string>
): EmailTemplateContent {
  return {
    subject: interpolateTemplate(template.subject, variables),
    text: interpolateTemplate(template.text, variables),
    html: interpolateTemplate(template.html, variables),
  };
}

export function isEmailTemplateId(value: string | null | undefined): value is EmailTemplateId {
  return EMAIL_TEMPLATE_IDS.some((templateId) => templateId === value);
}

