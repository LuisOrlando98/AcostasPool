export const EMAIL_TEMPLATE_IDS = [
  "CUSTOMER_INVITE",
  "TECH_ACCOUNT_INVITE",
  "PASSWORD_RESET",
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
    description: "Email sent to customers with the invoice PDF attached.",
    placeholders: ["{{customer_name}}", "{{customer_name_html}}", "{{invoice_number}}"],
    defaults: {
      subject: "Your AcostasPool invoice {{invoice_number}}",
      text: [
        "Hi {{customer_name}},",
        "",
        "Your invoice {{invoice_number}} is attached to this email as PDF.",
        "Please review the details and keep this message for your records.",
        "",
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

    if (trimmed === "{{invite_link}}") {
      flushList();
      blocks.push(
        '<div style="margin:0 0 18px;"><a href="{{invite_link}}" style="display:inline-block;padding:11px 18px;border-radius:999px;background:linear-gradient(135deg,#0ea5e9,#22c55e);color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;">Complete profile</a></div>'
      );
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

  return [
    '<div style="margin:0;padding:26px;background:#edf2f7;font-family:Inter,Arial,sans-serif;">',
    '<div style="max-width:680px;margin:0 auto;border:1px solid #d7e3f0;border-radius:20px;overflow:hidden;background:#ffffff;box-shadow:0 18px 36px rgba(15,23,42,0.12);">',
    '<div style="padding:18px 22px;background:linear-gradient(145deg,#082236,#0d3555);color:#e2f5ff;">',
    '<p style="margin:0;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:700;opacity:.8;">AcostasPool</p>',
    `<h2 style="margin:8px 0 0;font-size:19px;line-height:1.3;font-weight:800;color:#ffffff;">${escapeHtml(
      meta.label
    )}</h2>`,
    `<p style="margin:8px 0 0;font-size:13px;line-height:1.45;color:#cbe9fb;">${escapeHtml(
      subject
    )}</p>`,
    "</div>",
    '<div style="padding:22px 22px 16px;">',
    bodyBlocks,
    '<div style="margin-top:18px;padding:10px 12px;border:1px solid #dbe7f3;border-radius:10px;background:#f8fbff;">',
    '<p style="margin:0;color:#5b6b80;font-size:11px;line-height:1.5;">This message was generated from your AcostasPool admin panel templates.</p>',
    "</div>",
    "</div>",
    '<div style="padding:12px 22px;border-top:1px solid #e2e8f0;background:#f8fafc;">',
    '<p style="margin:0;color:#7a8ca1;font-size:10px;line-height:1.45;">AcostasPool • Premium pool operations • support@acostaspool.com</p>',
    "</div>",
    "</div>",
    "</div>",
  ].join("");
}

export function getDefaultEmailTemplatesConfig(): EmailTemplatesConfig {
  return EMAIL_TEMPLATE_IDS.reduce((acc, templateId) => {
    const defaults = EMAIL_TEMPLATE_DEFINITIONS[templateId].defaults;
    acc[templateId] = {
      subject: defaults.subject,
      text: defaults.text,
      html: buildPremiumEmailTemplateHtml(templateId, defaults.subject, defaults.text),
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
    const normalized = normalizeEmailTemplateContent(input[templateId], defaults[templateId]);
    acc[templateId] = {
      subject: normalized.subject,
      text: normalized.text,
      html: buildPremiumEmailTemplateHtml(templateId, normalized.subject, normalized.text),
    };
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
