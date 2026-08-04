import { Scanner } from "@/components/check-in/scanner";

export const dynamic = "force-dynamic";

export default function ScanPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-serif text-xl font-bold tracking-tight">
          Scan tickets
        </h1>
        <p className="text-sm text-muted-foreground">
          Point the camera at a ticket QR code, review, then check in.
        </p>
      </div>
      <Scanner />
    </div>
  );
}
