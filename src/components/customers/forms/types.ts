import type { getTranslations } from "@/i18n/server";

/** Traductor de servidor (`await getTranslations()`) que reciben las secciones. */
export type Translator = Awaited<ReturnType<typeof getTranslations>>;

export type PropertyOption = {
  id: string;
  name: string | null;
  address: string;
};

export type TechnicianOption = {
  id: string;
  user: { fullName: string };
};

export type ServiceTierOption = {
  id: string;
  name: string;
};
