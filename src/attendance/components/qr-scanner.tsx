"use client";

import { useEffect, useRef, useState } from "react";

// Chrome on Android has a built-in QR reader; iPhones do not, so they fall
// back to jsQR, loaded only when the camera opens.
interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
type DetectorConstructor = new (options: { formats: string[] }) => Detector;

function builtInDetector(): Detector | null {
  const Constructor = (globalThis as { BarcodeDetector?: DetectorConstructor })
    .BarcodeDetector;
  return Constructor ? new Constructor({ formats: ["qr_code"] }) : null;
}

async function jsQrReader(): Promise<
  (video: HTMLVideoElement) => string | null
> {
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  return (video) => {
    // A smaller frame decodes faster and a desk QR fills the view anyway.
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, 1));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    return jsQR(image.data, image.width, image.height)?.data ?? null;
  };
}

/**
 * The camera view. Calls `onScan` with each QR it reads until `onScan`
 * returns true (the code was ours), then turns the camera off.
 */
export function QrScanner({ onScan }: { onScan: (text: string) => boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        setProblem(
          "The camera is blocked. Allow camera access for this app in your phone's settings, or ask the desk to mark you in.",
        );
        return;
      }
      if (stopped || !video.current) return;
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);

      const detector = builtInDetector();
      const readFrame = detector ? null : await jsQrReader();

      const tick = async () => {
        if (stopped || !video.current) return;
        const element = video.current;
        let text: string | null = null;
        if (element.readyState >= element.HAVE_ENOUGH_DATA) {
          text = detector
            ? ((await detector.detect(element).catch(() => []))[0]?.rawValue ??
              null)
            : readFrame!(element);
        }
        if (text && onScan(text)) return stop();
        timer = setTimeout(tick, 200);
      };
      tick();
    }

    function stop() {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    }

    start();
    return stop;
  }, [onScan]);

  if (problem) {
    return (
      <p role="alert" className="callout text-lg">
        {problem}
      </p>
    );
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded-card bg-ink shadow-float">
      <video
        ref={video}
        muted
        playsInline
        className="size-full object-cover"
        aria-label="Camera view"
      />
      <span
        aria-hidden="true"
        className="absolute inset-[18%] rounded-card border-2 border-white/90"
      />
    </div>
  );
}
