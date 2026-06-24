import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { classifyWaste, type ClassificationResult } from "@/lib/waste.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Camera, Upload, Loader2, ImagePlus, Recycle, Lightbulb } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({ meta: [{ title: "Scan Waste — EcoSort AI" }] }),
  component: ScanPage,
});

const MAX_BYTES = 10 * 1024 * 1024;

function ScanPage() {
  const classify = useServerFn(classifyWaste);
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<ClassificationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }

  async function startCamera() {
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        toast.error("Camera API not supported in this browser");
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOn(true);
      setPreview(null);
      setResult(null);
      // wait a tick so the <video> element is mounted
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not open camera";
      toast.error(`Camera error: ${msg}. Check browser permissions.`);
    }
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || !streamRef.current) return;
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.9));
    if (!blob) {
      toast.error("Capture failed");
      return;
    }
    stopCamera();
    await handleFile(new File([blob], `scan-${Date.now()}.jpg`, { type: "image/jpeg" }));
  }

  async function handleFile(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error("File too large (max 10MB)");
      return;
    }
    if (!/image\/(jpe?g|png|webp)/i.test(file.type)) {
      toast.error("Use JPG, PNG, or WEBP");
      return;
    }
    const dataUrl = await new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(file);
    });
    setPreview(dataUrl);
    setResult(null);
    setLoading(true);
    try {
      const r = await classify({ data: { imageBase64: dataUrl, mimeType: file.type } });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["my-stats"] });
      qc.invalidateQueries({ queryKey: ["my-scans"] });
      qc.invalidateQueries({ queryKey: ["leaderboard"] });
      toast.success(`+${r.points_awarded} eco points!`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Classification failed");
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFile(f);
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-bold tracking-tight">Scan waste</h1>
      <p className="text-muted-foreground">Take or upload a photo of any waste item.</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Capture or upload</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={onDrop}
              className="grid place-items-center rounded-xl border-2 border-dashed border-border bg-muted/40 p-6 text-center"
            >
              {cameraOn ? (
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  autoPlay
                  className="max-h-80 w-full rounded-lg bg-black object-contain"
                />
              ) : preview ? (
                <img src={preview} alt="preview" className="max-h-80 rounded-lg object-contain" />
              ) : (
                <>
                  <ImagePlus className="mb-2 h-10 w-10 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Drag &amp; drop, or use a button below</p>
                  <p className="text-xs text-muted-foreground">JPG · PNG · WEBP · up to 10MB</p>
                </>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {!cameraOn ? (
                <Button onClick={startCamera} disabled={loading}>
                  <Camera className="mr-2 h-4 w-4" /> Open camera
                </Button>
              ) : (
                <>
                  <Button onClick={captureFromCamera} disabled={loading}>
                    <Camera className="mr-2 h-4 w-4" /> Capture
                  </Button>
                  <Button variant="outline" onClick={stopCamera} disabled={loading}>
                    Stop camera
                  </Button>
                </>
              )}
              <Button onClick={() => fileRef.current?.click()} variant="outline" disabled={loading}>
                <Upload className="mr-2 h-4 w-4" /> Upload image
              </Button>
              {preview && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setPreview(null);
                    setResult(null);
                  }}
                  disabled={loading}
                >
                  Reset
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="grid place-items-center py-16 text-muted-foreground">
                <Loader2 className="mb-2 h-8 w-8 animate-spin" />
                Analyzing image with AI…
              </div>
            ) : result ? (
              <ResultPanel result={result} />
            ) : (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Results appear here after you submit an image.
              </p>
            )}
            {result && (
              <div className="mt-4 flex gap-2">
                <Link to="/history">
                  <Button variant="outline" size="sm">View history</Button>
                </Link>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">Dashboard</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function ResultPanel({ result }: { result: ClassificationResult }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge className="text-sm" variant="secondary">{result.category}</Badge>
        <span className="text-lg font-semibold">{result.subcategory}</span>
        <span className="ml-auto text-sm text-muted-foreground">
          +{result.points_awarded} pts
        </span>
      </div>

      <Metric label="Confidence" value={result.confidence} />
      <Metric label="Recyclability" value={result.recyclability_score} />
      <Metric label="Environmental impact" value={result.environmental_impact_score} />

      <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm">
        <p className="font-medium text-foreground">
          🌱 Estimated CO₂ saved: {result.carbon_reduction_kg.toFixed(3)} kg
        </p>
      </div>

      <div className="rounded-lg border border-border p-3">
        <p className="flex items-center gap-2 font-medium"><Recycle className="h-4 w-4" /> Disposal</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.disposal_recommendation}</p>
      </div>
      <div className="rounded-lg border border-border p-3">
        <p className="flex items-center gap-2 font-medium"><Lightbulb className="h-4 w-4" /> Did you know?</p>
        <p className="mt-1 text-sm text-muted-foreground">{result.educational_insight}</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <Progress value={value} />
    </div>
  );
}