"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ backgroundColor: "#020202", color: "#fff", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Something went wrong</h2>
          <p style={{ fontSize: 14, color: "#737373", marginBottom: 24 }}>An unexpected error occurred. Please try again.</p>
          <button
            onClick={() => reset()}
            style={{ padding: "10px 24px", backgroundColor: "#fff", color: "#000", border: "none", borderRadius: 999, fontWeight: 600, fontSize: 14, cursor: "pointer" }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
