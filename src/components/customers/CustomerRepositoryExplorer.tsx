"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/i18n/client";

type RepositoryEntry = {
  type: "folder" | "file";
  name: string;
  path: string;
  size: number | null;
  lastModified: string | null;
  url?: string;
  readOnly?: boolean;
};

type RepositoryResponse = {
  currentPath: string;
  parentPath: string | null;
  entries: RepositoryEntry[];
};

type CustomerRepositoryExplorerProps = {
  customerId: string;
};

function formatBytes(size: number | null) {
  if (!size || size <= 0) {
    return "--";
  }
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CustomerRepositoryExplorer({
  customerId,
}: CustomerRepositoryExplorerProps) {
  const { t, locale } = useI18n();
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [entries, setEntries] = useState<RepositoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canManageCurrentPath =
    currentPath === "files" || currentPath.startsWith("files/");

  const breadcrumbs = useMemo(() => {
    if (!currentPath) {
      return [{ label: "Repository", path: "" }];
    }
    const segments = currentPath.split("/");
    return [
      { label: "Repository", path: "" },
      ...segments.map((segment, index) => ({
        label: segment,
        path: segments.slice(0, index + 1).join("/"),
      })),
    ];
  }, [currentPath]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      const query = new URLSearchParams();
      if (currentPath) {
        query.set("path", currentPath);
      }

      const response = await fetch(
        `/api/customers/${customerId}/repository?${query.toString()}`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as
        | RepositoryResponse
        | { error?: string }
        | null;

      if (cancelled) {
        return;
      }

      if (!response.ok) {
        setEntries([]);
        setError((data as { error?: string } | null)?.error ?? "Unable to load repository.");
        setLoading(false);
        return;
      }

      const payload = data as RepositoryResponse;
      setCurrentPath(payload.currentPath ?? "");
      setParentPath(payload.parentPath ?? null);
      setEntries(Array.isArray(payload.entries) ? payload.entries : []);
      setLoading(false);
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentPath, customerId, reloadTick]);

  const refresh = () => setReloadTick((value) => value + 1);

  const runAction = async (payload: Record<string, unknown>) => {
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/customers/${customerId}/repository`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setSubmitting(false);
    if (!response.ok) {
      setError(data?.error ?? "Action failed.");
      return false;
    }
    refresh();
    return true;
  };

  const handleCreateFolder = async () => {
    const name = window.prompt("Folder name");
    if (!name) {
      return;
    }
    const ok = await runAction({
      action: "createFolder",
      path: currentPath || "files",
      name,
    });
    if (ok) {
      setMessage("Folder created.");
    }
  };

  const handleRename = async (entry: RepositoryEntry) => {
    const newName = window.prompt("New name", entry.name);
    if (!newName || newName.trim() === entry.name) {
      return;
    }
    const ok = await runAction({
      action: "rename",
      path: entry.path,
      type: entry.type,
      newName,
    });
    if (ok) {
      setMessage("Renamed successfully.");
    }
  };

  const handleDelete = async (entry: RepositoryEntry) => {
    const confirmed = window.confirm(
      `Delete ${entry.type === "folder" ? "folder" : "file"} "${entry.name}"?`
    );
    if (!confirmed) {
      return;
    }
    const ok = await runAction({
      action: "delete",
      path: entry.path,
      type: entry.type,
    });
    if (ok) {
      setMessage("Deleted successfully.");
    }
  };

  const handleUploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.append("path", currentPath || "files");
    Array.from(files).forEach((file) => formData.append("files", file));
    const response = await fetch(`/api/customers/${customerId}/repository/upload`, {
      method: "POST",
      body: formData,
    });
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    setSubmitting(false);
    if (!response.ok) {
      setError(data?.error ?? "Upload failed.");
      return;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setMessage("Files uploaded.");
    refresh();
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Repositorio del cliente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Explora, organiza y gestiona carpetas/archivos de este cliente.
          </p>
        </div>
        {canManageCurrentPath ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
              className="app-button-secondary px-3 py-2 text-xs font-semibold"
            >
              Subir archivo
            </button>
            <button
              type="button"
              onClick={() => void handleCreateFolder()}
              disabled={submitting}
              className="app-button-primary px-3 py-2 text-xs font-semibold"
            >
              Nueva carpeta
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={(event) => void handleUploadFiles(event.target.files)}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-1.5">
          {breadcrumbs.map((crumb, index) => (
            <button
              key={`${crumb.path || "root"}-${index}`}
              type="button"
              className={`rounded px-1.5 py-0.5 transition ${
                index === breadcrumbs.length - 1
                  ? "bg-slate-200 font-semibold text-slate-800"
                  : "hover:bg-slate-200"
              }`}
              onClick={() => setCurrentPath(crumb.path)}
            >
              {crumb.label}
            </button>
          ))}
        </div>
      </div>

      {parentPath ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setCurrentPath(parentPath)}
            className="text-xs font-semibold text-sky-700 underline"
          >
            {t("common.actions.back")}
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
          {message}
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-[780px] w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">Nombre</th>
              <th className="px-3 py-2 font-semibold">Tipo</th>
              <th className="px-3 py-2 font-semibold">Tamano</th>
              <th className="px-3 py-2 font-semibold">Actualizado</th>
              <th className="px-3 py-2 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  Cargando repositorio...
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                  Esta carpeta no tiene elementos.
                </td>
              </tr>
            ) : (
              entries.map((entry) => {
                const canMutate = canManageCurrentPath && !entry.readOnly;
                return (
                  <tr key={entry.path} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      {entry.type === "folder" ? (
                        <button
                          type="button"
                          onClick={() => setCurrentPath(entry.path)}
                          className="inline-flex max-w-[24rem] items-center gap-2 truncate font-semibold text-slate-800 hover:text-sky-700"
                        >
                          <span
                            aria-hidden="true"
                            className="inline-flex h-5 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1 text-[10px] font-semibold text-slate-500"
                          >
                            DIR
                          </span>
                          <span className="truncate">{entry.name}</span>
                        </button>
                      ) : entry.url ? (
                        <a
                          href={entry.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex max-w-[24rem] items-center gap-2 truncate font-medium text-slate-800 hover:text-sky-700"
                        >
                          <span
                            aria-hidden="true"
                            className="inline-flex h-5 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1 text-[10px] font-semibold text-slate-500"
                          >
                            FILE
                          </span>
                          <span className="truncate">{entry.name}</span>
                        </a>
                      ) : (
                        <span className="inline-flex max-w-[24rem] items-center gap-2 truncate font-medium text-slate-500">
                          <span
                            aria-hidden="true"
                            className="inline-flex h-5 min-w-8 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-1 text-[10px] font-semibold text-slate-500"
                          >
                            FILE
                          </span>
                          <span className="truncate">{entry.name}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-600">
                        {entry.type}
                        {entry.readOnly ? " · lock" : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">{entry.type === "file" ? formatBytes(entry.size) : "--"}</td>
                    <td className="px-3 py-2.5">
                      {entry.lastModified
                        ? new Date(entry.lastModified).toLocaleString(locale)
                        : "--"}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {canMutate ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void handleRename(entry)}
                            disabled={submitting}
                            className="ui-button-ghost px-3 py-1 text-[11px] font-semibold"
                          >
                            Renombrar
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleDelete(entry)}
                            disabled={submitting}
                            className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700"
                          >
                            {t("common.actions.delete")}
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
