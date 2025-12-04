"use client";

import React, { useEffect, useRef } from "react";
import type { AreaSeriesPartialOptions } from "lightweight-charts";

interface Props {
  data: number[] | Array<{ time: number; value: number }>;
  color?: string;
  height?: number;
  className?: string;
  sharp?: boolean;
  showGuides?: boolean;
}

export default function Sparkline({ data, color = "#10b981", height = 60, className = "", sharp = false, showGuides = true }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<any>(null);
  const seriesRef = useRef<any>(null);
  const priceLineRef = useRef<any>(null);

  // Warn only once per session when falling back to SVG (prevents console spam)
  const warnedRef = useRef<{ noArea?: boolean }>({});

  useEffect(() => {
    if (!containerRef.current) return;

    let mounted = true;
    let crossHandler: any = null;

    async function init() {
      try {
        // Use loader helper (dynamic import then UMD CDN fallback)
        const lwc: any = await import("../../lib/lwcLoader").then((m) => m.loadLightweightCharts());

        // normalize createChart function
        let createChartFn: any = null;
        try {
          if (typeof lwc === "function") createChartFn = lwc;
          else if (lwc && typeof lwc.createChart === "function") createChartFn = lwc.createChart.bind(lwc);
          else if (lwc && lwc.default && typeof lwc.default.createChart === "function") createChartFn = lwc.default.createChart.bind(lwc.default);
          else if ((window as any).LightweightCharts && typeof (window as any).LightweightCharts.createChart === "function") createChartFn = (window as any).LightweightCharts.createChart.bind((window as any).LightweightCharts);
        } catch (e) {
          console.error("Sparkline: error while locating createChart", e, { lwc });
        }

        if (!createChartFn || typeof createChartFn !== "function") {
          console.error("Sparkline: createChart is not a function", { lwc });
          return;
        }

        if (!mounted) return;

        const initialHeight = (containerRef.current!.clientHeight || height);
        chartRef.current = createChartFn(containerRef.current!, {
          width: containerRef.current!.clientWidth,
          height: initialHeight,
          layout: { background: { color: "transparent" }, textColor: "#fff" },
          grid: { vertLines: { visible: false }, horzLines: { visible: false } },
          crosshair: { vertLine: { visible: true, color: 'rgba(255,255,255,0.06)', width: 1 }, horzLine: { visible: true, color: 'rgba(255,255,255,0.04)', width: 1 } },
          rightPriceScale: { visible: false },
          timeScale: { visible: false },
        });

        try {
          if (chartRef.current && typeof chartRef.current.addAreaSeries === "function") {
            seriesRef.current = chartRef.current.addAreaSeries({
              topColor: `${color}33`,
              bottomColor: "transparent",
              lineColor: color,
              lineWidth: 2,
            } as AreaSeriesPartialOptions);
          } else {
            if (!warnedRef.current.noArea) {
              console.warn("Sparkline: chart instance missing addAreaSeries, falling back to SVG sparkline", { chart: chartRef.current });
              warnedRef.current.noArea = true;
            }
            seriesRef.current = null;
          }
        } catch (e) {
          console.error("Sparkline: addAreaSeries failed", e);
          seriesRef.current = null;
        }

        // Initial set
        const points = Array.isArray(data) && data.length && typeof (data[0] as any).value === "number"
          ? (data as Array<{ time: number; value: number }>)
          : (data as number[]).map((v, i) => ({ time: i, value: v }));
        // init (no debug log)

        try {
            if (seriesRef.current && typeof seriesRef.current.setData === "function") {
            seriesRef.current.setData(points as any);

            // create a base price line at the first point (opening) so there's a reference horizontal line
            if (showGuides && points && points.length) {
              try {
                if (priceLineRef.current && typeof priceLineRef.current.applyOptions === "function") {
                  // attempt update
                }
                // remove existing
                if (priceLineRef.current && typeof priceLineRef.current.remove === "function") {
                  try { priceLineRef.current.remove(); } catch (e) {}
                }
                priceLineRef.current = seriesRef.current.createPriceLine({
                  price: (points[0] as any).value,
                  color: 'rgba(255,255,255,0.06)',
                  lineWidth: 1,
                  lineStyle: 2,
                });
              } catch (e) {}
            }
            // create a tooltip element for lightweight-charts crosshair events
            let tooltipEl: HTMLDivElement | null = null;
            if (showGuides && containerRef.current) {
              // remove any leftover fallback tooltip/guides before adding lwc tooltip
              try {
                const container = containerRef.current;
                if (container) {
                  const guides = (container as any)._sparklineGuides;
                  const prevSvg = container.querySelector("svg[data-fallback='sparkline']");
                  if (guides && guides.tooltip) {
                    try { guides.tooltip.remove(); } catch (e) {}
                  }
                  if (prevSvg && guides) {
                    try { prevSvg.removeEventListener('mousemove', guides.onMove); } catch (e) {}
                    try { prevSvg.removeEventListener('mouseleave', guides.onLeave); } catch (e) {}
                  }
                  try { delete (container as any)._sparklineGuides; } catch (e) {}
                  const otherTt = container.querySelectorAll('.sparkline-tooltip');
                  otherTt.forEach((n) => { try { n.remove(); } catch (e) {} });
                }
              } catch (e) {}
              tooltipEl = document.createElement('div');
              tooltipEl.className = 'sparkline-tooltip';
              tooltipEl.style.position = 'absolute';
              tooltipEl.style.pointerEvents = 'none';
              tooltipEl.style.padding = '4px 6px';
              tooltipEl.style.fontSize = '12px';
              tooltipEl.style.background = 'rgba(0,0,0,0.75)';
              tooltipEl.style.color = '#fff';
              tooltipEl.style.borderRadius = '4px';
              tooltipEl.style.transform = 'translate(-50%, -120%)';
              tooltipEl.style.display = 'none';
              containerRef.current.appendChild(tooltipEl);
            }

            // subscribe to crosshair moves to update tooltip
            if (showGuides && chartRef.current && typeof chartRef.current.subscribeCrosshairMove === 'function') {
              crossHandler = (param: any) => {
                try {
                  if (!param || !param.point || !param.time) {
                    if (tooltipEl) tooltipEl.style.display = 'none';
                    return;
                  }
                  const point = param.point;
                  const seriesPrices = param.seriesPrices;
                  const seriesVal = seriesPrices && seriesPrices.get(seriesRef.current) ? seriesPrices.get(seriesRef.current) : null;
                  const price = seriesVal ?? (param?.close ?? null);
                  if (tooltipEl && price != null) {
                    tooltipEl.textContent = typeof price === 'number' ? price.toLocaleString(undefined, { maximumFractionDigits: 8 }) : String(price);
                    // position relative to container
                    tooltipEl.style.left = (point.x) + 'px';
                    tooltipEl.style.top = (point.y) + 'px';
                    tooltipEl.style.display = 'block';
                  }
                } catch (e) {}
              };
              try { chartRef.current.subscribeCrosshairMove(crossHandler); } catch (e) {}
            }
            } else {
            // fallback: draw simple inline SVG into container
            drawFallback(points.map((p: any) => (typeof p.value === "number" ? p.value : Number(p.value))));
          }
        } catch (e) {
          console.error("Sparkline: setData failed", e);
          try { drawFallback(points.map((p: any) => (typeof p.value === "number" ? p.value : Number(p.value)))); } catch (err) {}
        }
      } catch (e) {
        console.error("Sparkline: chart init failed", e);
      }
    }

    init();

    const ro = new ResizeObserver(() => {
      if (!containerRef.current || !chartRef.current) return;
      try {
        chartRef.current.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      } catch (e) {}
    });
        // observe resize
        ro.observe(containerRef.current!);

    return () => {
      mounted = false;
      ro.disconnect();
      try {
        chartRef.current?.remove();
      } catch (e) {}
      // remove tooltip and unsub
      try {
        const container = containerRef.current;
        if (container) {
          const tt = container.querySelector('.sparkline-tooltip');
          if (tt) tt.remove();
        }
        // unsubscribe crosshair if available (use stored handler)
        try { if (typeof (chartRef.current?.unsubscribeCrosshairMove) === 'function' && crossHandler) { try { chartRef.current.unsubscribeCrosshairMove(crossHandler); } catch (e) {} } } catch (e) {}
      } catch (e) {}
      // remove any fallback guide listeners
      try {
        const container = containerRef.current;
        if (container) {
          const guides = (container as any)._sparklineGuides;
          const svg = container.querySelector("svg[data-fallback='sparkline']");
          if (guides && svg) {
            try { svg.removeEventListener('mousemove', guides.onMove); } catch (e) {}
            try { svg.removeEventListener('mouseleave', guides.onLeave); } catch (e) {}
          }
          try { delete (container as any)._sparklineGuides; } catch (e) {}
        }
      } catch (e) {}
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  // update
  useEffect(() => {
    const points = Array.isArray(data) && data.length && typeof (data[0] as any).value === "number"
      ? (data as Array<{ time: number; value: number }>)
      : (data as number[]).map((v, i) => ({ time: i, value: v }));
    try {
      if (seriesRef.current && typeof seriesRef.current.setData === "function") {
        // update using LWC
        seriesRef.current.setData(points as any);
        // update base price line if present
        try {
          if (priceLineRef.current && priceLineRef.current.applyOptions) {
            priceLineRef.current.applyOptions({ price: (points[0] as any).value });
          } else if (seriesRef.current && showGuides) {
            if (priceLineRef.current && typeof priceLineRef.current.remove === 'function') {
              try { priceLineRef.current.remove(); } catch (e) {}
            }
            priceLineRef.current = seriesRef.current.createPriceLine({
              price: (points[0] as any).value,
              color: 'rgba(255,255,255,0.06)',
              lineWidth: 1,
              lineStyle: 2,
            });
          }
        } catch (e) {}
      } else {
      drawFallback(points.map((p: any) => (typeof p.value === "number" ? p.value : Number(p.value))));
      }
    } catch (e) {
      try { if (seriesRef.current && typeof seriesRef.current.update === "function") seriesRef.current.update(points[points.length - 1]); } catch (err) {}
    }
  }, [data]);

  function drawFallback(values: number[]) {
    const container = containerRef.current;
    if (!container) return;
    // cleanup any previous guides / tooltip elements first to avoid orphaned tooltips
    try {
      const existingGuides = (container as any)._sparklineGuides;
      const prevSvg = container.querySelector("svg[data-fallback='sparkline']");
      if (existingGuides) {
        if (existingGuides.tooltip) {
          try { existingGuides.tooltip.remove(); } catch (e) {}
        }
        if (prevSvg) {
          try { prevSvg.removeEventListener('mousemove', existingGuides.onMove); } catch (e) {}
          try { prevSvg.removeEventListener('mouseleave', existingGuides.onLeave); } catch (e) {}
        }
        try { delete (container as any)._sparklineGuides; } catch (e) {}
      }
      // remove any orphan .sparkline-tooltip elements
      const otherTt = container.querySelectorAll('.sparkline-tooltip');
      otherTt.forEach((n) => { try { n.remove(); } catch (e) {} });
    } catch (e) {}

    // remove any previous fallback and clear potential leftover chart markup
    const prev = container.querySelector("svg[data-fallback='sparkline']");
    if (prev) prev.remove();
    // remove lightweight-charts generated nodes if present so fallback doesn't sit beside them
    const lwcNode = container.querySelector(".tv-lightweight-charts, .tv-lightweight-charts__chart") as Element | null;
    if (lwcNode) lwcNode.remove();
    // ensure container is positioned for absolute SVG
    if (container.style.position === "" || container.style.position === "static") container.style.position = "relative";

    if (!values || values.length === 0) return;
    // Size the SVG to the container's actual pixel dimensions so the fallback fills space
    const rect = container.getBoundingClientRect();
    const w = rect.width || 100;
    const h = rect.height || 100;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const step = w / Math.max(values.length - 1, 1);

    // Build a smooth path using simple quadratic bezier smoothing between points (normalized coords)
    const pts = values.map((v, i) => ({ x: i * step, y: h - ((v - min) / range) * h }));

    function straightPath(ps: { x: number; y: number }[]) {
      if (ps.length === 0) return "";
      let d = `M ${ps[0].x} ${ps[0].y}`;
      for (let i = 1; i < ps.length; i++) {
        d += ` L ${ps[i].x} ${ps[i].y}`;
      }
      return d;
    }

    function smoothPath(ps: { x: number; y: number }[]) {
      if (ps.length === 0) return "";
      if (ps.length === 1) return `M ${ps[0].x} ${ps[0].y}`;
      let d = `M ${ps[0].x} ${ps[0].y}`;
      for (let i = 1; i < ps.length; i++) {
        const prev = ps[i - 1];
        const cur = ps[i];
        const cx = (prev.x + cur.x) / 2;
        const cy = (prev.y + cur.y) / 2;
        if (i === 1) {
          d += ` Q ${prev.x} ${prev.y} ${cx} ${cy}`;
        } else {
          d += ` T ${cx} ${cy}`;
        }
        if (i === ps.length - 1) {
          d += ` L ${cur.x} ${cur.y}`;
        }
      }
      return d;
    }

    const pathD = sharp ? straightPath(pts) : smoothPath(pts);
    const areaD = pathD + ` L ${w} ${h} L 0 ${h} Z`;

    const xmlns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(xmlns, "svg");
    svg.setAttribute("data-fallback", "sparkline");
    // set viewBox to actual pixel dimensions so coordinates map 1:1 and we avoid extra letterboxing
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin meet");
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";
    svg.style.position = "absolute";
    svg.style.left = "0";
    svg.style.top = "0";

    const area = document.createElementNS(xmlns, "path");
    area.setAttribute("d", areaD);
    area.setAttribute("fill", `${color}33`);
    area.setAttribute("stroke", "none");

    const path = document.createElementNS(xmlns, "path");
    path.setAttribute("d", pathD);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "2");
    path.setAttribute("stroke-linecap", sharp ? "butt" : "round");
    path.setAttribute("stroke-linejoin", sharp ? "miter" : "round");

    svg.appendChild(area);
    svg.appendChild(path);
    // Add interactive guide elements when requested
    if (showGuides) {
      const guideGroup = document.createElementNS(xmlns, 'g');
      guideGroup.setAttribute('data-guides', 'true');

      const vline = document.createElementNS(xmlns, 'line');
      vline.setAttribute('x1', '0'); vline.setAttribute('y1', '0'); vline.setAttribute('x2', '0'); vline.setAttribute('y2', String(h));
      vline.setAttribute('stroke', 'rgba(255,255,255,0.12)'); vline.setAttribute('stroke-width', '1'); vline.setAttribute('visibility', 'hidden');

      const hline = document.createElementNS(xmlns, 'line');
      hline.setAttribute('x1', '0'); hline.setAttribute('y1', '0'); hline.setAttribute('x2', String(w)); hline.setAttribute('y2', '0');
      hline.setAttribute('stroke', 'rgba(255,255,255,0.08)'); hline.setAttribute('stroke-width', '1'); hline.setAttribute('visibility', 'hidden');

      const dot = document.createElementNS(xmlns, 'circle');
      dot.setAttribute('cx', '0'); dot.setAttribute('cy', '0'); dot.setAttribute('r', '2.5');
      dot.setAttribute('fill', color); dot.setAttribute('visibility', 'hidden');

      guideGroup.appendChild(vline);
      guideGroup.appendChild(hline);
      guideGroup.appendChild(dot);
      svg.appendChild(guideGroup);

      // create an HTML tooltip element overlaying the container
      const tooltipDiv = document.createElement('div');
      tooltipDiv.className = 'sparkline-tooltip';
      tooltipDiv.style.position = 'absolute';
      tooltipDiv.style.pointerEvents = 'none';
      tooltipDiv.style.padding = '4px 6px';
      tooltipDiv.style.fontSize = '12px';
      tooltipDiv.style.background = 'rgba(0,0,0,0.75)';
      tooltipDiv.style.color = '#fff';
      tooltipDiv.style.borderRadius = '4px';
      tooltipDiv.style.transform = 'translate(-50%, -120%)';
      tooltipDiv.style.display = 'none';
      container.appendChild(tooltipDiv);

      // Mouse handling
      const onMove = (ev: MouseEvent) => {
        const rect = (svg as any).getBoundingClientRect();
        const x = Math.max(0, Math.min(w, ((ev.clientX - rect.left) / rect.width) * w));
        // find nearest point index
        const idx = Math.round((x / w) * (values.length - 1));
        const ptIndex = Math.max(0, Math.min(pts.length - 1, idx));
        const px = pts[ptIndex].x;
        const py = pts[ptIndex].y;
        vline.setAttribute('x1', String(px)); vline.setAttribute('x2', String(px)); vline.setAttribute('visibility', 'visible');
        hline.setAttribute('y1', String(py)); hline.setAttribute('y2', String(py)); hline.setAttribute('visibility', 'visible');
        dot.setAttribute('cx', String(px)); dot.setAttribute('cy', String(py)); dot.setAttribute('visibility', 'visible');
        // update tooltip text and position (use percent coords)
        const val = values[ptIndex];
        tooltipDiv.textContent = typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 8 }) : String(val);
        // position using percent within container
        tooltipDiv.style.left = `${(px / w) * 100}%`;
        tooltipDiv.style.top = `${(py / h) * 100}%`;
        tooltipDiv.style.display = 'block';
      };
      const onLeave = () => {
        vline.setAttribute('visibility', 'hidden');
        hline.setAttribute('visibility', 'hidden');
        dot.setAttribute('visibility', 'hidden');
        tooltipDiv.style.display = 'none';
      };
      svg.addEventListener('mousemove', onMove);
      svg.addEventListener('mouseleave', onLeave);
      // cleanup handler reference on container for future removal (includes tooltip)
      (container as any)._sparklineGuides = { onMove, onLeave, tooltip: tooltipDiv };
    }
    container.appendChild(svg);
  }

  return <div ref={containerRef} className={`w-full h-full ${className}`} style={{ height: '100%' }} />;
}
