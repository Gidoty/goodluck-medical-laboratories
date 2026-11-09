import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt = "I-Recruit. Skilled Masons. Reliable Labour.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          background: "#2c2d31",
          position: "relative",
          padding: "0 90px",
          gap: 60,
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 18, background: "#f58b1e" }} />
        <div
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: 0,
            height: 0,
            borderLeft: "340px solid transparent",
            borderBottom: "340px solid #f58b1e",
          }}
        />
        <svg width="280" height="280" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="100" fill="#f58b1e" />
          <circle cx="100" cy="100" r="88" fill="#ffffff" />
          <path d="M50 103 A50 48 0 0 1 150 103 Z" fill="#2c2d31" />
          <rect x="94" y="55.5" width="12" height="34" fill="#f58b1e" />
          <rect x="43" y="101" width="114" height="10" rx="5" fill="#2c2d31" />
          <rect x="54" y="119" width="44" height="13" rx="2" fill="#f58b1e" />
          <rect x="102" y="119" width="44" height="13" rx="2" fill="#f58b1e" />
          <rect x="34" y="136" width="42" height="13" rx="2" fill="#2c2d31" />
          <rect x="79" y="136" width="42" height="13" rx="2" fill="#2c2d31" />
          <rect x="124" y="136" width="42" height="13" rx="2" fill="#2c2d31" />
        </svg>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 132, fontWeight: 800, color: "#f58b1e", lineHeight: 1 }}>I-Recruit</div>
          <div style={{ width: 200, height: 4, background: "#f58b1e", margin: "22px 0" }} />
          <div style={{ fontSize: 40, fontWeight: 700, color: "#ffffff", letterSpacing: 6, fontStyle: "italic" }}>
            SKILLED MASONS.
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: "#ffffff", letterSpacing: 6, fontStyle: "italic" }}>
            RELIABLE LABOUR.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
