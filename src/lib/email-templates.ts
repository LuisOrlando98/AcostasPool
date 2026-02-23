export const EMAIL_TEMPLATE_IDS = [
  "CUSTOMER_INVITE",
  "INVOICE_SENT",
  "QUOTE_REQUEST",
  "CUSTOMER_SERVICE_SCHEDULED",
  "CUSTOMER_SERVICE_RESCHEDULED",
  "TECH_DAILY_DIGEST",
  "TECH_CHANGE_DIGEST",
] as const;

export type EmailTemplateId = (typeof EMAIL_TEMPLATE_IDS)[number];

export type EmailTemplateContent = {
  subject: string;
  text: string;
  html: string;
};

export type EmailTemplatesConfig = Record<EmailTemplateId, EmailTemplateContent>;

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
      subject: "Complete your AcostasPool profile",
      text: [
        "Hi {{customer_name}},",
        "",
        "We invited you to complete your profile and set your password.",
        "Open this link: {{invite_link}}",
        "",
        "This link expires in {{invite_hours}} hours.",
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
  INVOICE_SENT: {
    label: "Invoice sent",
    description: "Email sent to customers with the invoice PDF attached.",
    placeholders: ["{{customer_name}}", "{{customer_name_html}}", "{{invoice_number}}"],
    defaults: {
      subject: "Invoice {{invoice_number}}",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your invoice {{invoice_number}} is attached to this email.",
        "Thank you for choosing AcostasPool.",
      ].join("\n"),
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:20px;border:1px solid #dbe6f2;border-radius:16px;background:#ffffff;">',
        '<h2 style="margin:0 0 10px;color:#0b1f35;">Invoice {{invoice_number}}</h2>',
        '<p style="margin:0 0 12px;color:#334155;">Hi {{customer_name_html}}, your invoice is attached to this email.</p>',
        '<p style="margin:0;color:#64748b;font-size:13px;">Thank you for choosing AcostasPool.</p>',
        "</div>",
      ].join(""),
    },
    previewValues: {
      customer_name: "Alex Rivera",
      customer_name_html: "Alex Rivera",
      invoice_number: "INV-1042",
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
        "New quote request received",
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
      subject: "Servicio programado - {{scheduled_label}}",
      text: [
        "Hola {{customer_name}},",
        "",
        "Tu servicio esta programado para {{scheduled_label}}.",
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
        "Lamentamos el inconveniente y agradecemos tu comprension.",
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
  TECH_DAILY_DIGEST: {
    label: "Tech daily route digest",
    description: "Morning route digest sent to technicians.",
    placeholders: ["{{tech_name}}", "{{tech_name_html}}", "{{route_date}}", "{{lines_text}}", "{{lines_html}}"],
    defaults: {
      subject: "Ruta - {{tech_name}} - {{route_date}}",
      text: [
        "Hola {{tech_name}},",
        "",
        "Esta es tu ruta para hoy ({{route_date}}):",
        "{{lines_text}}",
        "",
        "Recibiras actualizaciones a las 12:00pm y 9:00pm si hay cambios.",
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
      subject: "Cambios de ruta - {{tech_name}} - {{route_date}}",
      text: [
        "Hola {{tech_name}},",
        "",
        "Cambios detectados en tu ruta del {{route_date}}:",
        "{{lines_text}}",
        "",
        "Si necesitas aclaraciones, contacta al administrador.",
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
};

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

export function getDefaultEmailTemplatesConfig(): EmailTemplatesConfig {
  return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
    acc[templateId] = {
      ...EMAIL_TEMPLATE_DEFINITIONS[templateId].defaults,
    };
    return acc;
  }, {} as EmailTemplatesConfig);
}

export function normalizeEmailTemplateContent(
  value: unknown,
  fallback: EmailTemplateContent
): EmailTemplateContent {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    subject: String(input.subject ?? fallback.subject),
    text: String(input.text ?? fallback.text),
    html: String(input.html ?? fallback.html),
  };
}

export function normalizeEmailTemplates(value: unknown): EmailTemplatesConfig {
  const input = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const defaults = getDefaultEmailTemplatesConfig();

  return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
    acc[templateId] = normalizeEmailTemplateContent(input[templateId], defaults[templateId]);
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
