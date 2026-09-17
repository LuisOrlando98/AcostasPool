"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Coordinación de los modales de la ficha de cliente (editar cliente, nueva
 * propiedad, nuevo trabajo, nuevo plan). Sustituye al patrón CSS-only
 * (`<input type="checkbox" hidden>` + `peer-checked` + `<label htmlFor>`), que
 * no podía abrirse con teclado: los disparadores son botones reales
 * (`CustomerDetailModalTrigger`) que pueden vivir en cualquier punto del árbol
 * (hero, tablas, perfil) y cada modal consulta si está abierto con
 * `useCustomerDetailModal(id)`. Solo hay un modal abierto a la vez.
 */

export const CUSTOMER_DETAIL_MODAL_IDS = [
  "edit-customer",
  "new-property",
  "new-job",
  "new-plan",
] as const;

export type CustomerDetailModalId = (typeof CUSTOMER_DETAIL_MODAL_IDS)[number];

type CustomerDetailModalsContextValue = {
  readonly openModalId: CustomerDetailModalId | null;
  readonly openModal: (id: CustomerDetailModalId) => void;
  readonly closeModal: (id: CustomerDetailModalId) => void;
};

const CustomerDetailModalsContext =
  createContext<CustomerDetailModalsContextValue | null>(null);

export function CustomerDetailModalsProvider({
  children,
}: {
  readonly children: ReactNode;
}) {
  const [openModalId, setOpenModalId] = useState<CustomerDetailModalId | null>(
    null
  );

  const value = useMemo<CustomerDetailModalsContextValue>(
    () => ({
      openModalId,
      openModal: (id) => setOpenModalId(id),
      // Solo cierra si ese modal es el abierto: un cierre tardío no pisa a otro.
      closeModal: (id) =>
        setOpenModalId((current) => (current === id ? null : current)),
    }),
    [openModalId]
  );

  return (
    <CustomerDetailModalsContext.Provider value={value}>
      {children}
    </CustomerDetailModalsContext.Provider>
  );
}

function useCustomerDetailModalsContext(): CustomerDetailModalsContextValue {
  const context = useContext(CustomerDetailModalsContext);
  if (!context) {
    throw new Error(
      "useCustomerDetailModal must be used within CustomerDetailModalsProvider"
    );
  }
  return context;
}

export type CustomerDetailModalHandle = {
  readonly isOpen: boolean;
  readonly open: () => void;
  readonly close: () => void;
};

export function useCustomerDetailModal(
  id: CustomerDetailModalId
): CustomerDetailModalHandle {
  const { openModalId, openModal, closeModal } = useCustomerDetailModalsContext();
  return {
    isOpen: openModalId === id,
    open: () => openModal(id),
    close: () => closeModal(id),
  };
}

type CustomerDetailModalTriggerProps = {
  readonly modal: CustomerDetailModalId;
  readonly className?: string;
  readonly children: ReactNode;
};

/** Botón real (accesible por teclado) que abre uno de los modales de la ficha. */
export function CustomerDetailModalTrigger({
  modal,
  className,
  children,
}: CustomerDetailModalTriggerProps) {
  const { open } = useCustomerDetailModal(modal);
  return (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      className={className}
    >
      {children}
    </button>
  );
}
