export type ChecklistItem = {
  label: string;
  completed: boolean;
};

export const serviceTypeOptions = [
  {
    value: "WEEKLY_CLEANING",
    label: "Weekly cleaning",
    labelKey: "jobs.service.weeklyCleaning",
  },
  {
    value: "FILTER_CHECK",
    label: "Filter check",
    labelKey: "jobs.service.filterCheck",
  },
  {
    value: "CHEM_BALANCE",
    label: "Chemical balance",
    labelKey: "jobs.service.chemBalance",
  },
  {
    value: "EQUIPMENT_CHECK",
    label: "Equipment check",
    labelKey: "jobs.service.equipmentCheck",
  },
];

const checklistTemplates: Record<string, ChecklistItem[]> = {
  WEEKLY_CLEANING: [
    { label: "Cepillar paredes y piso", completed: false },
    { label: "Retirar hojas y residuos", completed: false },
    { label: "Vaciar canastas de skimmers", completed: false },
    { label: "Revisar niveles de agua", completed: false },
  ],
  FILTER_CHECK: [
    { label: "Revisar presion del filtro", completed: false },
    { label: "Limpieza/retrolavado", completed: false },
    { label: "Inspeccionar conexiones", completed: false },
    { label: "Registrar lectura final", completed: false },
  ],
  CHEM_BALANCE: [
    { label: "Medir cloro y pH", completed: false },
    { label: "Ajustar alcalinidad", completed: false },
    { label: "Verificar estabilizador", completed: false },
    { label: "Registrar quimicos agregados", completed: false },
  ],
  EQUIPMENT_CHECK: [
    { label: "Revisar bomba y ruidos", completed: false },
    { label: "Verificar calentador", completed: false },
    { label: "Inspeccionar fugas", completed: false },
    { label: "Revisar temporizador", completed: false },
  ],
};

export function getChecklistTemplate(serviceType: string) {
  return checklistTemplates[serviceType] ?? checklistTemplates.WEEKLY_CLEANING;
}
