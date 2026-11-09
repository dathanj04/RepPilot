"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#F5F7FA", color: "#14243A", fontFamily: "sans-serif" }}>
        <main style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <p style={{ color: "#087f5b", fontWeight: 700 }}>RepPilot AI</p>
          <h1 style={{ fontSize: 28, margin: "8px 0" }}>This page could not open</h1>
          <p style={{ color: "#66758B" }}>Reload it, or go back to sign-up and try again.</p>
          <p style={{ display: "flex", gap: 12, justifyContent: "center" }}>
            <button type="button" onClick={() => reset()} style={{ height: 44, padding: "0 16px", borderRadius: 8, border: 0, background: "#10263E", color: "white" }}>Reload</button>
            <a href="/signup" style={{ height: 44, display: "inline-flex", alignItems: "center", padding: "0 16px", borderRadius: 8, background: "#19B78A", color: "#06281f", textDecoration: "none" }}>Create account</a>
          </p>
        </main>
      </body>
    </html>
  );
}
