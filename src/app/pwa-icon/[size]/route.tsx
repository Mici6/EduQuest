import { ImageResponse } from "next/og";

const SIZES = new Set([192, 512]);

/** PNG app icons for the web manifest (installable PWA). */
export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: raw } = await params;
  const size = SIZES.has(Number(raw)) ? Number(raw) : 192;
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, display: "flex", background: "#080B12" }}>
        <svg width={size} height={size} viewBox="0 0 32 32">
          <defs>
            <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFF2B3" />
              <stop offset="0.55" stopColor="#FFD34D" />
              <stop offset="1" stopColor="#FF8A3D" />
            </linearGradient>
          </defs>
          <rect x="3" y="3" width="26" height="26" rx="8" fill="url(#g)" />
          <path d="M10 19 14.5 14l3 3L22.5 11.5" fill="none" stroke="#080B12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M18.5 11.5h4v4" fill="none" stroke="#080B12" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": `public, max-age=86400, s-maxage=86400` } },
  );
}
