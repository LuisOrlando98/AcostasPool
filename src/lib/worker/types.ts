import type { Prisma } from "@prisma/client";
import type { LocalizedEmailTemplatesConfig } from "@/lib/email-templates";
import type { SendMailAndLogInput, SendMailAndLogResult } from "@/lib/mail/transport";
import type { WorkerLogger } from "@/lib/worker/logger";

/** Cliente Prisma (o transacción interactiva): las tareas no abren conexiones propias. */
export type WorkerDb = Prisma.TransactionClient;

/** Firma de `sendMailAndLog`: nunca lanza y siempre deja una fila EmailLog. */
export type WorkerMailer = (input: SendMailAndLogInput) => Promise<SendMailAndLogResult>;

/** Plantillas de correo (SiteSettings normalizado) con caché por TTL. */
export type EmailTemplateSource = {
  readonly load: (now: Date) => Promise<LocalizedEmailTemplatesConfig>;
};

/** Dependencias de un tick: todo lo que una tarea necesita se inyecta para poder probarla. */
export type WorkerTaskDeps = {
  readonly db: WorkerDb;
  readonly mailer: WorkerMailer;
  readonly logger: WorkerLogger;
  readonly templates: EmailTemplateSource;
  /** Instante de referencia del tick: define "hoy", los umbrales y las marcas de tiempo escritas. */
  readonly now: Date;
};
