"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

type TreeNodeState = {
  folders: RepositoryEntry[];
  loaded: boolean;
  loading: boolean;
};

type TreeState = Record<string, TreeNodeState>;

type ExpandedState = Record<string, boolean>;

type CustomerRepositoryExplorerProps = {
  customerId: string;
};

type FileKind =
  | "file"
  | "pdf"
  | "image"
  | "word"
  | "excel"
  | "archive"
  | "text"
  | "code";

function formatBytes(size: number | null) {
  if (!size || size <= 0) {
    return "--";
  }
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getNodeLabel(path: string) {
  if (!path) {
    return "Repository";
  }
  const parts = path.split("/");
  return parts[parts.length - 1] || path;
}

function getAncestors(path: string) {
  if (!path) {
    return [""];
  }
  const parts = path.split("/");
  const result = [""];
  for (let i = 0; i < parts.length; i += 1) {
    result.push(parts.slice(0, i + 1).join("/"));
  }
  return result;
}

function getFileExtension(entry: RepositoryEntry) {
  if (entry.type !== "file") {
    return "folder";
  }
  const index = entry.name.lastIndexOf(".");
  if (index <= 0 || index === entry.name.length - 1) {
    return "--";
  }
  return entry.name.slice(index + 1).toLowerCase();
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function getFileKind(extension: string): FileKind {
  if (extension === "pdf") return "pdf";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "heic", "avif"].includes(extension)) {
    return "image";
  }
  if (["doc", "docx", "odt", "rtf"].includes(extension)) return "word";
  if (["xls", "xlsx", "csv", "ods"].includes(extension)) return "excel";
  if (["zip", "rar", "7z", "tar", "gz", "bz2"].includes(extension)) return "archive";
  if (["txt", "md", "log"].includes(extension)) return "text";
  if (
    ["js", "ts", "tsx", "jsx", "json", "html", "css", "scss", "yml", "yaml", "xml", "sql"].includes(
      extension
    )
  ) {
    return "code";
  }
  return "file";
}

function getFileKindLabel(kind: FileKind) {
  if (kind === "pdf") return "PDF";
  if (kind === "image") return "IMG";
  if (kind === "word") return "DOC";
  if (kind === "excel") return "XLS";
  if (kind === "archive") return "ZIP";
  if (kind === "text") return "TXT";
  if (kind === "code") return "DEV";
  return "";
}

function getFileKindStyles(kind: FileKind) {
  if (kind === "pdf") {
    return { bg: "bg-rose-50", border: "border-rose-200", icon: "text-rose-600", badge: "bg-rose-600" };
  }
  if (kind === "image") {
    return { bg: "bg-violet-50", border: "border-violet-200", icon: "text-violet-600", badge: "bg-violet-600" };
  }
  if (kind === "word") {
    return { bg: "bg-blue-50", border: "border-blue-200", icon: "text-blue-700", badge: "bg-blue-700" };
  }
  if (kind === "excel") {
    return { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-700", badge: "bg-emerald-700" };
  }
  if (kind === "archive") {
    return { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-700", badge: "bg-amber-700" };
  }
  if (kind === "text") {
    return { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-600", badge: "bg-slate-600" };
  }
  if (kind === "code") {
    return { bg: "bg-cyan-50", border: "border-cyan-200", icon: "text-cyan-700", badge: "bg-cyan-700" };
  }
  return { bg: "bg-slate-50", border: "border-slate-200", icon: "text-slate-500", badge: "bg-slate-500" };
}

function FolderGlyph({ open = false }: { open?: boolean }) {
  return (
    <span className="inline-flex h-5 w-5 items-center justify-center text-amber-600">
      {open ? (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M2.5 4.75A1.75 1.75 0 0 1 4.25 3h3.13c.5 0 .98.2 1.33.55l.87.87c.14.14.34.23.55.23h5.62a1.75 1.75 0 0 1 1.7 2.17l-.78 3.15A2.25 2.25 0 0 1 14.49 11H3.32a2.25 2.25 0 0 1-2.2-2.7l.74-2.98A1.75 1.75 0 0 1 2.5 4.75Z" />
          <path d="M3.25 12.25h11.24a2.25 2.25 0 0 0 2.2-1.7l.5-2.02a1 1 0 0 1 .97 1.24l-1.2 4.8A2.25 2.25 0 0 1 14.78 16H3.22a2.25 2.25 0 0 1-2.18-2.8l.2-.8a1 1 0 0 1 2.01-.15Z" />
        </svg>
      ) : (
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path d="M2.5 4.75A1.75 1.75 0 0 1 4.25 3h3.13c.5 0 .98.2 1.33.55l.87.87c.14.14.34.23.55.23h5.62a1.75 1.75 0 0 1 1.75 1.75v6.85A1.75 1.75 0 0 1 15.75 15h-11.5A1.75 1.75 0 0 1 2.5 13.25V4.75Z" />
        </svg>
      )}
    </span>
  );
}

function FileGlyph({ extension }: { extension: string }) {
  const kind = getFileKind(extension);
  const label = getFileKindLabel(kind);
  const styles = getFileKindStyles(kind);

  return (
    <span
      className={`relative inline-flex h-5 w-5 items-center justify-center rounded border ${styles.bg} ${styles.border}`}
    >
      <svg viewBox="0 0 20 20" fill="none" className={`h-4 w-4 ${styles.icon}`}>
        <path
          d="M6 2.75h5.1l3.15 3.15V16a1.25 1.25 0 0 1-1.25 1.25H6A1.25 1.25 0 0 1 4.75 16V4A1.25 1.25 0 0 1 6 2.75Z"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
        <path
          d="M11.1 2.75V6a.9.9 0 0 0 .9.9h3.25"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
        />
      </svg>
      {label ? (
        <span
          className={`absolute -bottom-1 -right-1 rounded px-1 py-[1px] text-[8px] font-bold leading-none text-white ${styles.badge}`}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
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
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [treeState, setTreeState] = useState<TreeState>({
    "": { folders: [], loaded: false, loading: false },
  });
  const [expanded, setExpanded] = useState<ExpandedState>({ "": true });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const canManageCurrentPath =
    currentPath === "files" || currentPath.startsWith("files/");

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.path === selectedPath) ?? null,
    [entries, selectedPath]
  );

  const canMutateSelected =
    Boolean(selectedEntry) && canManageCurrentPath && !selectedEntry?.readOnly;

  const visibleEntries = useMemo(() => {
    const query = normalizeText(searchTerm);
    if (!query) {
      return entries;
    }
    return entries.filter((entry) =>
      normalizeText(entry.name).includes(query)
    );
  }, [entries, searchTerm]);

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

  const refresh = () => setReloadTick((value) => value + 1);

  const fetchRepository = useCallback(
    async (path: string): Promise<RepositoryResponse> => {
      const query = new URLSearchParams();
      if (path) {
        query.set("path", path);
      }
      const response = await fetch(
        `/api/customers/${customerId}/repository?${query.toString()}`,
        { cache: "no-store" }
      );
      const data = (await response.json().catch(() => null)) as
        | RepositoryResponse
        | { error?: string }
        | null;

      if (!response.ok || !data || !("entries" in data)) {
        const messageText =
          (data as { error?: string } | null)?.error ??
          "Unable to load repository.";
        throw new Error(messageText);
      }

      return data;
    },
    [customerId]
  );

  const hydrateTreeNode = useCallback(
    (path: string, nodeEntries: RepositoryEntry[]) => {
      const folders = nodeEntries.filter((entry) => entry.type === "folder");
      setTreeState((prev) => ({
        ...prev,
        [path]: {
          folders,
          loaded: true,
          loading: false,
        },
      }));
    },
    []
  );

  const loadTreeNode = useCallback(
    async (path: string) => {
      const existing = treeState[path];
      if (existing?.loaded || existing?.loading) {
        return;
      }
      setTreeState((prev) => ({
        ...prev,
        [path]: {
          folders: prev[path]?.folders ?? [],
          loaded: false,
          loading: true,
        },
      }));
      try {
        const payload = await fetchRepository(path);
        hydrateTreeNode(path, payload.entries);
      } catch {
        setTreeState((prev) => ({
          ...prev,
          [path]: {
            folders: prev[path]?.folders ?? [],
            loaded: false,
            loading: false,
          },
        }));
      }
    },
    [fetchRepository, hydrateTreeNode, treeState]
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const payload = await fetchRepository(currentPath);
        if (cancelled) {
          return;
        }
        const safePath = payload.currentPath ?? "";
        if (safePath !== currentPath) {
          setCurrentPath(safePath);
        }
        setParentPath(payload.parentPath ?? null);
        setEntries(Array.isArray(payload.entries) ? payload.entries : []);
        hydrateTreeNode(safePath, payload.entries);
        setExpanded((prev) => {
          const next = { ...prev };
          for (const ancestor of getAncestors(safePath)) {
            next[ancestor] = true;
          }
          return next;
        });
      } catch (loadError) {
        if (cancelled) {
          return;
        }
        setEntries([]);
        setError(
          loadError instanceof Error ? loadError.message : "Unable to load repository."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [currentPath, fetchRepository, hydrateTreeNode, reloadTick]);

  useEffect(() => {
    if (!selectedPath) {
      return;
    }
    const exists = entries.some((entry) => entry.path === selectedPath);
    if (!exists) {
      setSelectedPath(null);
    }
  }, [entries, selectedPath]);

  const navigateToPath = (path: string) => {
    setCurrentPath(path);
    setSelectedPath(null);
    setSearchTerm("");
    setMessage(null);
  };

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
      if (selectedPath === entry.path) {
        setSelectedPath(null);
      }
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

  const handleOpenEntry = (entry: RepositoryEntry) => {
    if (entry.type === "folder") {
      navigateToPath(entry.path);
      return;
    }
    if (entry.url) {
      window.open(entry.url, "_blank", "noopener,noreferrer");
    }
  };

  const toggleTreeNode = async (path: string) => {
    const isExpanded = Boolean(expanded[path]);
    if (!path) {
      setExpanded((prev) => ({ ...prev, "": true }));
      if (!treeState[path]?.loaded) {
        await loadTreeNode(path);
      }
      return;
    }

    if (isExpanded) {
      setExpanded((prev) => ({ ...prev, [path]: false }));
      return;
    }

    setExpanded((prev) => ({ ...prev, [path]: true }));
    await loadTreeNode(path);
  };

  const renderTreeNode = (path: string, depth = 0): ReactNode => {
    const node = treeState[path];
    const isExpanded = Boolean(expanded[path]);
    const folders = node?.folders ?? [];
    const isLoadingNode = Boolean(node?.loading);
    const isSelectedNode = currentPath === path;

    return (
      <div key={path}>
        <div
          className={`flex items-center gap-1 rounded-md px-1.5 py-1 text-xs transition ${
            isSelectedNode
              ? "bg-sky-100 text-sky-900"
              : "text-slate-700 hover:bg-slate-100"
          }`}
          style={{ paddingLeft: `${depth * 14 + 6}px` }}
        >
          <button
            type="button"
            onClick={() => void toggleTreeNode(path)}
            className="inline-flex h-4 w-4 items-center justify-center rounded text-slate-500 hover:bg-slate-200"
            aria-label="Toggle folder"
          >
            <svg
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className={`h-3.5 w-3.5 transition ${isExpanded ? "rotate-90" : ""}`}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7 5l6 5-6 5" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => navigateToPath(path)}
            className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left"
            title={getNodeLabel(path)}
          >
            <FolderGlyph open={isExpanded} />
            {getNodeLabel(path)}
          </button>
        </div>
        {isExpanded ? (
          <div>
            {isLoadingNode ? (
              <p
                className="px-2 py-1 text-[11px] text-slate-400"
                style={{ paddingLeft: `${depth * 14 + 30}px` }}
              >
                Loading...
              </p>
            ) : null}
            {!isLoadingNode
              ? folders.map((folder) => renderTreeNode(folder.path, depth + 1))
              : null}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="h-full min-w-0 overflow-hidden rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:min-h-[440px] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Repositorio del cliente</h2>
          <p className="mt-1 text-sm text-slate-500">
            Explorador de carpetas y archivos del cliente (estilo desktop).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => navigateToPath(parentPath ?? "")}
            disabled={!parentPath || submitting}
            className="ui-button-ghost px-3 py-2 text-xs font-semibold disabled:opacity-50"
          >
            {t("common.actions.back")}
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={submitting}
            className="ui-button-ghost px-3 py-2 text-xs font-semibold"
          >
            Refresh
          </button>
          {canManageCurrentPath ? (
            <>
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
            </>
          ) : null}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => void handleUploadFiles(event.target.files)}
          />
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
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
              onClick={() => navigateToPath(crumb.path)}
            >
              {crumb.label}
            </button>
          ))}
        </div>
      </div>

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

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="min-w-0 border-b border-slate-200 bg-slate-50/80 p-3 lg:border-b-0 lg:border-r">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Folder Tree
            </p>
            <div className="max-h-[460px] overflow-y-auto pr-1">
              {renderTreeNode("")}
            </div>
          </aside>

          <section className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
              <div className="flex min-w-[230px] flex-1 items-center gap-2">
                <p className="max-w-[420px] truncate text-xs text-slate-600">
                  {currentPath ? currentPath : "Repository"}
                </p>
                <span className="hidden rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-500 sm:inline-flex">
                  Details
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-500">
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    className="mr-1.5 h-3.5 w-3.5"
                  >
                    <path
                      d="m14.25 14.25 3 3m-1.5-8a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search"
                    className="w-28 bg-transparent text-[11px] text-slate-700 outline-none placeholder:text-slate-400 sm:w-36"
                  />
                </label>
                {selectedEntry ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenEntry(selectedEntry)}
                      className="ui-button-ghost px-3 py-1 text-[11px] font-semibold"
                    >
                      Open
                    </button>
                    {canMutateSelected ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleRename(selectedEntry)}
                          disabled={submitting}
                          className="ui-button-ghost px-3 py-1 text-[11px] font-semibold"
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(selectedEntry)}
                          disabled={submitting}
                          className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700"
                        >
                          {t("common.actions.delete")}
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-xs text-slate-600">
                <thead className="bg-white text-[11px] uppercase tracking-[0.14em] text-slate-500">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Name</th>
                    <th className="px-3 py-2 font-semibold">Type</th>
                    <th className="px-3 py-2 font-semibold">Extension</th>
                    <th className="px-3 py-2 font-semibold">Size</th>
                    <th className="px-3 py-2 font-semibold">Modified</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                        Cargando repositorio...
                      </td>
                    </tr>
                  ) : visibleEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                        {searchTerm
                          ? "No hay resultados con ese criterio."
                          : "Esta carpeta no tiene elementos."}
                      </td>
                    </tr>
                  ) : (
                    visibleEntries.map((entry) => {
                      const isSelected = selectedPath === entry.path;
                      const extension = getFileExtension(entry);
                      return (
                        <tr
                          key={entry.path}
                          className={`cursor-pointer border-t border-slate-100 ${
                            isSelected ? "bg-sky-50/80" : "hover:bg-slate-50/80"
                          }`}
                          onClick={() => setSelectedPath(entry.path)}
                          onDoubleClick={() => handleOpenEntry(entry)}
                        >
                          <td className="px-3 py-2.5">
                            <div className="inline-flex max-w-[26rem] items-center gap-2">
                              {entry.type === "folder" ? (
                                <FolderGlyph />
                              ) : (
                                <FileGlyph extension={extension} />
                              )}
                              <span className="truncate" title={entry.name}>
                                {entry.name}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.type}
                            {entry.readOnly ? " | lock" : ""}
                          </td>
                          <td className="px-3 py-2.5">{extension}</td>
                          <td className="px-3 py-2.5">
                            {entry.type === "file" ? formatBytes(entry.size) : "--"}
                          </td>
                          <td className="px-3 py-2.5">
                            {entry.lastModified
                              ? new Date(entry.lastModified).toLocaleString(locale)
                              : "--"}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>
                  {visibleEntries.length} item
                  {visibleEntries.length === 1 ? "" : "s"}
                  {searchTerm ? ` (filtered from ${entries.length})` : ""}
                </p>
                <p className="truncate">
                  {selectedEntry
                    ? `Selected: ${selectedEntry.name}`
                    : "Select an item to see actions"}
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
