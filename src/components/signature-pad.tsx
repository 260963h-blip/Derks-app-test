import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";
import { Button } from "@/components/ui/button";

export type SignaturePadHandle = {
  isEmpty: () => boolean;
  toDataURL: () => string;
  clear: () => void;
};

export const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(
  ({ height = 180 }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);
    const last = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
      const c = canvasRef.current;
      if (!c) return;
      const dpr = window.devicePixelRatio || 1;
      const resize = () => {
        const rect = c.getBoundingClientRect();
        c.width = rect.width * dpr;
        c.height = rect.height * dpr;
        const ctx = c.getContext("2d")!;
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2;
        ctx.lineCap = "round";
        ctx.strokeStyle = "#0a2463";
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, rect.width, rect.height);
      };
      resize();
    }, []);

    const pos = (e: PointerEvent | React.PointerEvent) => {
      const c = canvasRef.current!;
      const rect = c.getBoundingClientRect();
      return { x: (e as any).clientX - rect.left, y: (e as any).clientY - rect.top };
    };

    useImperativeHandle(ref, () => ({
      isEmpty: () => !dirty.current,
      toDataURL: () => canvasRef.current!.toDataURL("image/png"),
      clear: () => {
        const c = canvasRef.current!;
        const ctx = c.getContext("2d")!;
        const rect = c.getBoundingClientRect();
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, rect.width, rect.height);
        dirty.current = false;
      },
    }));

    return (
      <div className="space-y-2">
        <canvas
          ref={canvasRef}
          style={{ height, width: "100%", touchAction: "none" }}
          className="rounded-md border bg-white"
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            drawing.current = true;
            last.current = pos(e);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const p = pos(e);
            const ctx = canvasRef.current!.getContext("2d")!;
            ctx.beginPath();
            ctx.moveTo(last.current!.x, last.current!.y);
            ctx.lineTo(p.x, p.y);
            ctx.stroke();
            last.current = p;
            dirty.current = true;
          }}
          onPointerUp={() => {
            drawing.current = false;
            last.current = null;
          }}
          onPointerLeave={() => {
            drawing.current = false;
            last.current = null;
          }}
        />
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              const c = canvasRef.current!;
              const ctx = c.getContext("2d")!;
              const rect = c.getBoundingClientRect();
              ctx.fillStyle = "#fff";
              ctx.fillRect(0, 0, rect.width, rect.height);
              dirty.current = false;
            }}
          >
            Wissen
          </Button>
        </div>
      </div>
    );
  },
);
SignaturePad.displayName = "SignaturePad";