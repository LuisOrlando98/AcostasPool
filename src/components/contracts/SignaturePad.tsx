"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

type SignaturePadProps = {
  onChange: (dataUrl: string | null) => void;
  height?: number;
  clearLabel: string;
  emptyHint?: string;
  className?: string;
};

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

export default function SignaturePad({
  onChange,
  height = 180,
  clearLabel,
  emptyHint,
  className = "",
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const setupCanvas = () => {
      const width = Math.max(240, Math.floor(canvas.parentElement?.clientWidth ?? 320));
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
    };

    setupCanvas();
    window.addEventListener("resize", setupCanvas);
    return () => window.removeEventListener("resize", setupCanvas);
  }, [height]);

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const width = Number.parseInt(canvas.style.width || "320", 10);
    const canvasHeight = Number.parseInt(canvas.style.height || String(height), 10);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, canvasHeight);
    setHasSignature(false);
    onChange(null);
  };

  const handlePointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }
    const point = getCanvasPoint(canvas, event);
    canvas.setPointerCapture(event.pointerId);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    setIsDrawing(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
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
    setIsDrawing(false);
    if (hasSignature) {
      onChange(canvas.toDataURL("image/png"));
    }
  };

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="block w-full touch-none"
          style={{ height }}
        />
        {!hasSignature && emptyHint ? (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-300">
            {emptyHint}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600 transition hover:border-slate-300"
      >
        {clearLabel}
      </button>
    </div>
  );
}
