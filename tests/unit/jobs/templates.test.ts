import { describe, expect, it } from "vitest";
import { getChecklistTemplate, serviceTypeOptions } from "@/lib/jobs/templates";

const CHECKLIST_ITEMS_PER_TEMPLATE = 4;
const SERVICE_TYPES = ["WEEKLY_CLEANING", "FILTER_CHECK", "CHEM_BALANCE", "EQUIPMENT_CHECK"];

describe("serviceTypeOptions", () => {
  it("expone exactamente los cuatro tipos de servicio con sus etiquetas", () => {
    expect(serviceTypeOptions).toEqual([
      { value: "WEEKLY_CLEANING", label: "Weekly cleaning", labelKey: "jobs.service.weeklyCleaning" },
      { value: "FILTER_CHECK", label: "Filter check", labelKey: "jobs.service.filterCheck" },
      { value: "CHEM_BALANCE", label: "Chemical balance", labelKey: "jobs.service.chemBalance" },
      { value: "EQUIPMENT_CHECK", label: "Equipment check", labelKey: "jobs.service.equipmentCheck" },
    ]);
  });
});

describe("getChecklistTemplate", () => {
  it("devuelve la checklist de limpieza semanal", () => {
    expect(getChecklistTemplate("WEEKLY_CLEANING")).toEqual([
      { label: "Cepillar paredes y piso", completed: false },
      { label: "Retirar hojas y residuos", completed: false },
      { label: "Vaciar canastas de skimmers", completed: false },
      { label: "Revisar niveles de agua", completed: false },
    ]);
  });

  it("devuelve la checklist de revisión de filtro", () => {
    expect(getChecklistTemplate("FILTER_CHECK")).toEqual([
      { label: "Revisar presion del filtro", completed: false },
      { label: "Limpieza/retrolavado", completed: false },
      { label: "Inspeccionar conexiones", completed: false },
      { label: "Registrar lectura final", completed: false },
    ]);
  });

  it("devuelve la checklist de balance químico", () => {
    expect(getChecklistTemplate("CHEM_BALANCE")).toEqual([
      { label: "Medir cloro y pH", completed: false },
      { label: "Ajustar alcalinidad", completed: false },
      { label: "Verificar estabilizador", completed: false },
      { label: "Registrar quimicos agregados", completed: false },
    ]);
  });

  it("devuelve la checklist de revisión de equipo", () => {
    expect(getChecklistTemplate("EQUIPMENT_CHECK")).toEqual([
      { label: "Revisar bomba y ruidos", completed: false },
      { label: "Verificar calentador", completed: false },
      { label: "Inspeccionar fugas", completed: false },
      { label: "Revisar temporizador", completed: false },
    ]);
  });

  it("cada tipo de serviceTypeOptions tiene una plantilla propia de cuatro ítems sin completar", () => {
    const weekly = getChecklistTemplate("WEEKLY_CLEANING");

    for (const option of serviceTypeOptions) {
      const template = getChecklistTemplate(option.value);
      expect(template).toHaveLength(CHECKLIST_ITEMS_PER_TEMPLATE);
      expect(template.every((item) => item.completed === false)).toBe(true);
      if (option.value !== "WEEKLY_CLEANING") {
        expect(template).not.toEqual(weekly);
      }
    }
    expect(serviceTypeOptions.map((option) => option.value)).toEqual(SERVICE_TYPES);
  });

  it("las etiquetas de cada plantilla son cadenas no vacías y únicas", () => {
    for (const serviceType of SERVICE_TYPES) {
      const labels = getChecklistTemplate(serviceType).map((item) => item.label);
      expect(labels.every((label) => label.trim().length > 0)).toBe(true);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });

  it("usa la limpieza semanal como fallback para tipos desconocidos, vacíos o en minúscula", () => {
    const weekly = getChecklistTemplate("WEEKLY_CLEANING");

    expect(getChecklistTemplate("UNKNOWN")).toEqual(weekly);
    expect(getChecklistTemplate("")).toEqual(weekly);
    expect(getChecklistTemplate("filter_check")).toEqual(weekly);
    expect(getChecklistTemplate(" FILTER_CHECK")).toEqual(weekly);
  });

  it("devuelve la misma referencia compartida en cada llamada (no clona la plantilla)", () => {
    expect(getChecklistTemplate("FILTER_CHECK")).toBe(getChecklistTemplate("FILTER_CHECK"));
    expect(getChecklistTemplate("UNKNOWN")).toBe(getChecklistTemplate("WEEKLY_CLEANING"));
  });

  it.fails(
    "debería usar el fallback para claves heredadas de Object.prototype como 'constructor' (bug sospechado)",
    () => {
      const weekly = getChecklistTemplate("WEEKLY_CLEANING");

      expect(getChecklistTemplate("constructor")).toEqual(weekly);
      expect(getChecklistTemplate("toString")).toEqual(weekly);
      expect(getChecklistTemplate("__proto__")).toEqual(weekly);
    }
  );
});
