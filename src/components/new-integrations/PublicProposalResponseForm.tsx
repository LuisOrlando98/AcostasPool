"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type PointerEvent,
} from "react";

type Props = {
  token: string;
};

type Decision = "ACCEPT" | "DECLINE" | "";

function getCanvasPoint(
  canvas: HTMLCanvasElement,
  event: PointerEvent<HTMLCanvasElement>
) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

export default function PublicProposalResponseForm({ token }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const signatureImageRef = useRef<string | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [decision, setDecision] = useState<Decision>("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [comments, setComments] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [loginRedirectUrl, setLoginRedirectUrl] = useState("/login");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const setupCanvas = () => {
      const previousDataUrl = signatureImageRef.current;
      const width = Math.max(280, Math.floor(canvas.parentElement?.clientWidth ?? 320));
      const height = 180;
      const ratio = window.devicePixelRatio || 1;

      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }

      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0f172a";

      if (!previousDataUrl) {
        return;
      }
      const image = new Image();
      image.onload = () => {
        ctx.drawImage(image, 0, 0, width, height);
      };
      image.src = previousDataUrl;
    };

    setupCanvas();
    window.addEventListener("resize", setupCanvas);
    return () => window.removeEventListener("resize", setupCanvas);
  }, []);

  const summaryLabel = useMemo(() => {
    if (decision === "ACCEPT") {
      return "Acepta proceder con la integracion";
    }
    if (decision === "DECLINE") {
      return "No acepta proceder por ahora";
    }
    return "Sin decision seleccionada";
  }, [decision]);

  useEffect(() => {
    if (!successId) {
      return;
    }
    setRedirecting(true);
    const timer = window.setTimeout(() => {
      window.location.assign(loginRedirectUrl);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [successId, loginRedirectUrl]);

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const width = Number.parseInt(canvas.style.width || "320", 10);
    const height = Number.parseInt(canvas.style.height || "180", 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    signatureImageRef.current = null;
    setHasSignature(false);
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const point = getCanvasPoint(canvas, event);
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
    setError(null);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const point = getCanvasPoint(canvas, event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const handlePointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    signatureImageRef.current = canvas.toDataURL("image/png");
    setIsDrawing(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccessId(null);
    setRedirecting(false);

    if (!clientName.trim() || !clientEmail.trim()) {
      setError("Completa nombre y correo del cliente.");
      return;
    }
    if (!decision) {
      setError("Selecciona si acepta o no la integracion.");
      return;
    }
    if (decision === "ACCEPT" && !acceptTerms) {
      setError("Debes confirmar aceptacion de terminos para aprobar.");
      return;
    }
    if (!hasSignature || !canvasRef.current) {
      setError("La firma es requerida.");
      return;
    }

    setSubmitting(true);
    const signatureDataUrl = canvasRef.current.toDataURL("image/png");

    try {
      const response = await fetch("/api/public-integrations/response", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim(),
          companyName: companyName.trim(),
          decision,
          acceptTerms,
          comments: comments.trim(),
          signatureDataUrl,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        id?: string;
        loginUrl?: string;
        error?: string;
      };

      if (!response.ok || !data.ok || !data.id) {
        setError(data.error ?? "No se pudo guardar la respuesta. Intenta de nuevo.");
        return;
      }

      setSuccessId(data.id);
      setLoginRedirectUrl(data.loginUrl || "/login");
      signatureImageRef.current = signatureDataUrl;
    } catch {
      setError("No se pudo guardar la respuesta. Intenta de nuevo.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">
        Confirmacion del cliente
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Completa este formulario para dejar por escrito si aceptas o no esta
        mejora. La firma funciona en telefono (tactil) y en computadora.
      </p>

      <form className="mt-5 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Nombre completo
            </span>
            <input
              type="text"
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              placeholder="Nombre y apellido"
              required
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Correo
            </span>
            <input
              type="email"
              value={clientEmail}
              onChange={(event) => setClientEmail(event.target.value)}
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              placeholder="cliente@empresa.com"
              required
            />
          </label>
        </div>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Empresa (opcional)
          </span>
          <input
            type="text"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
            placeholder="Nombre de empresa"
          />
        </label>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Decision del cliente
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
              <input
                type="radio"
                name="decision"
                checked={decision === "ACCEPT"}
                onChange={() => setDecision("ACCEPT")}
                className="mt-0.5 h-4 w-4"
              />
              <span>Si, acepto proceder con la integracion</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-sm text-rose-900">
              <input
                type="radio"
                name="decision"
                checked={decision === "DECLINE"}
                onChange={() => setDecision("DECLINE")}
                className="mt-0.5 h-4 w-4"
              />
              <span>No, por ahora no acepto proceder</span>
            </label>
          </div>
          <p className="mt-3 text-xs text-slate-600">
            Estado actual: <span className="font-semibold">{summaryLabel}</span>
          </p>
        </div>

        <label className="flex items-start gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 py-3 text-sm text-sky-900">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(event) => setAcceptTerms(event.target.checked)}
            className="mt-0.5 h-4 w-4"
            required={decision === "ACCEPT"}
            aria-required={decision === "ACCEPT"}
          />
          <span>
            Estoy de acuerdo con los terminos de esta mejora e integracion
            propuesta, y autorizo a Wyxloop Corp a implementarla. (requerido
            para aprobacion)
          </span>
        </label>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Firma digital rapida
            </p>
            <button
              type="button"
              onClick={clearSignature}
              className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
            >
              Limpiar firma
            </button>
          </div>
          <div className="mt-2 rounded-2xl border border-slate-300 bg-white p-2">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              className="block w-full touch-none rounded-xl border border-slate-200 bg-white"
              aria-label="Canvas para firma"
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Firma con el dedo o stylus en movil, o con mouse en computadora.
          </p>
        </div>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Pregunta o comentario (opcional)
          </span>
          <textarea
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            className="min-h-[110px] w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
            placeholder="Escribe aqui cualquier duda o comentario final..."
            maxLength={1200}
          />
        </label>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        {successId ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Respuesta registrada y enviada por email. Referencia:{" "}
            <span className="font-semibold">{successId}</span>
            {redirecting ? (
              <p className="mt-1 text-xs text-emerald-700">
                Redirigiendo al login de AcostasPool...
              </p>
            ) : null}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={submitting || redirecting || Boolean(successId)}
          className="w-full rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {submitting ? "Guardando..." : "Enviar confirmacion firmada"}
        </button>
      </form>
    </section>
  );
}
