export async function loadLightweightCharts(): Promise<any> {
  if (typeof window === "undefined") return null;

  // If already loaded via UMD, return it
  if ((window as any).LightweightCharts) return (window as any).LightweightCharts;

    // Skip dynamic import and always prefer the local UMD build in dev to avoid bundler ESM/CJS interop issues.
    // This is the most reliable for Turbopack / dev environments where dynamic import may return unexpected shapes.

  // Fallback: prefer a local vendor copy under /vendor/, otherwise CDNs
  const LOCAL = "/vendor/lightweight-charts.standalone.production.js";
  const CDN = "https://unpkg.com/lightweight-charts/dist/lightweight-charts.standalone.production.js";

  const tryLoad = (src: string) => {
    if (!(window as any)._lwc_loader_promise) {
      (window as any)._lwc_loader_promise = new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = src;
        s.async = true;
        s.onload = () => resolve();
        s.onerror = (err) => reject(err);
        document.head.appendChild(s);
      });
    }
    return (window as any)._lwc_loader_promise;
  };

    try {
      // Try local first — deliberately prefer local vendor copy
      await tryLoad(LOCAL);
    } catch (eLocal) {
      console.debug("lwcLoader: local vendor not available, falling back to CDN", eLocal);
      try {
        await tryLoad(CDN);
      } catch (eCdn) {
        console.error("lwcLoader: failed to load lightweight-charts from CDN", eCdn);
        throw eCdn;
      }
    }

    // Return the UMD global directly
    return (window as any).LightweightCharts;
  try {
    // Try local first
    await tryLoad(LOCAL);
  } catch (eLocal) {
    console.debug("lwcLoader: local vendor not available, falling back to CDN", eLocal);
    try {
      await tryLoad(CDN);
    } catch (eCdn) {
      console.error("lwcLoader: failed to load lightweight-charts from CDN", eCdn);
      throw eCdn;
    }
  }

  return (window as any).LightweightCharts;
}
