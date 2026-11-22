'use client';
import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { parseClassroomQr, type ClassroomScan } from '@/lib/classroom-qr';
type Controls = { stop: () => void };
export function StudentScanner({ onScan }: { onScan: (value: ClassroomScan) => void }) {
  const video = useRef<HTMLVideoElement>(null),
    controls = useRef<Controls | null>(null),
    generation = useRef(0);
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [link, setLink] = useState('');
  function stop() {
    generation.current++;
    controls.current?.stop();
    controls.current = null;
    const stream = video.current?.srcObject;
    if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream)
      stream.getTracks().forEach((t) => t.stop());
    setActive(false);
  }
  useEffect(
    () => () => {
      generation.current++;
      controls.current?.stop();
    },
    [],
  );
  function accept(value: string) {
    try {
      const parsed = parseClassroomQr(value, window.location.origin);
      stop();
      setError('');
      onScan(parsed);
    } catch {
      setError('That is not a valid AECS classroom QR. Scan the current QR shown by your teacher.');
    }
  }
  async function start() {
    setError('');
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'This browser cannot access a camera. Open this page in Safari or Chrome, upload a QR image, or paste the classroom QR link below.',
      );
      return;
    }
    setBusy(true);
    setActive(true);
    const current = ++generation.current;
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (current !== generation.current) return;
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: 'environment' } } },
        video.current!,
        (result) => {
          if (result && current === generation.current) accept(result.getText());
        },
      );
      if (current !== generation.current) scanner.stop();
      else controls.current = scanner;
    } catch {
      stop();
      setError(
        'Camera access failed. Allow camera permission in your browser, or use the image/link options below.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-4 space-y-4">
      <Button className="w-full" onClick={() => void start()} disabled={busy || active}>
        <Camera size={18} />
        {busy ? 'Starting camera…' : 'Scan classroom QR'}
      </Button>
      <div className={active ? 'relative overflow-hidden rounded-xl bg-slate-950' : 'hidden'}>
        <video
          ref={video}
          autoPlay
          muted
          playsInline
          className="aspect-square w-full object-cover"
        />
        <button
          type="button"
          aria-label="Stop camera"
          className="absolute right-3 top-3 rounded-full bg-white p-2"
          onClick={stop}
        >
          <X size={18} />
        </button>
        <p className="absolute inset-x-0 bottom-0 bg-slate-950/70 p-3 text-center text-sm text-white">
          Point your camera at the classroom QR
        </p>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600">
        <ImagePlus size={17} />
        Upload a QR image
        <input
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 10 * 1024 * 1024) {
              setError('Choose an image smaller than 10 MB.');
              return;
            }
            stop();
            setBusy(true);
            const url = URL.createObjectURL(file);
            try {
              const { BrowserQRCodeReader } = await import('@zxing/browser');
              const result = await new BrowserQRCodeReader().decodeFromImageUrl(url);
              accept(result.getText());
            } catch {
              setError('No readable classroom QR found in this image. Try a clearer photo.');
            } finally {
              URL.revokeObjectURL(url);
              setBusy(false);
              e.target.value = '';
            }
          }}
        />
      </label>
      <details className="text-sm text-slate-500">
        <summary className="cursor-pointer py-2">Have a classroom QR link instead?</summary>
        <form
          className="mt-2 grid gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            accept(link);
          }}
        >
          <input
            aria-label="Classroom QR link"
            className="input"
            type="url"
            placeholder="Paste the link from your teacher"
            required
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
          <Button type="submit" variant="outline">
            Use classroom link
          </Button>
        </form>
      </details>
      {error && (
        <p role="alert" className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {error}
        </p>
      )}
    </div>
  );
}
