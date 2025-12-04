import React, { useEffect, useMemo, useState } from 'react';
import { View, Text } from 'react-native';
// try to use react-native-svg if available; otherwise render a simple fallback
let Svg: any = null;
let Path: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RN_SVG = require('react-native-svg');
  Svg = RN_SVG.Svg;
  Path = RN_SVG.Path;
} catch (e) {
  // svg not available — we'll render a simple textual fallback
}

type Props = {
  symbol: string;
  summary?: any; // may include klines or last_price
  getKlines?: (symbol: string) => Promise<any>;
  width?: number;
  height?: number;
  debug?: boolean;
  strokeColor?: string;
};

const SPARK_MAX = 24;

function extractClosesFromKlines(klines: any[]): number[] {
  if (!Array.isArray(klines)) return [];
  // klines may be array-of-arrays or array-of-objects
  const closes: number[] = [];
  for (const k of klines) {
    if (Array.isArray(k)) {
      // typical array format: [open, high, low, close, volume, ts?] or similar
      const close = Number(k[4] ?? k[3]);
      if (!Number.isNaN(close)) closes.push(close);
    } else if (k && typeof k === 'object') {
      const close = Number(k.close ?? k.c ?? k[4]);
      if (!Number.isNaN(close)) closes.push(close);
    }
  }
  return closes;
}

function padTo(arr: number[], n: number) {
  if (arr.length >= n) return arr.slice(-n);
  if (arr.length === 0) return Array(n).fill(0);
  const out = Array.from(arr);
  while (out.length < n) out.unshift(out[0]);
  return out;
}

export default function Sparkline({ symbol, summary, getKlines, width = 120, height = 36, debug, strokeColor }: Props) {
  const [buffer, setBuffer] = useState<number[]>([]);

  useEffect(() => {
    let mounted = true;
    async function seed() {
      try {
        // prefer summary.klines
        const klines = summary?.klines;
        if (klines && Array.isArray(klines) && klines.length > 0) {
          const closes = extractClosesFromKlines(klines);
          const vals = closes.length > SPARK_MAX ? closes.slice(-SPARK_MAX) : closes.slice();
          if (mounted) setBuffer(padTo(vals, SPARK_MAX));
          return;
        }

        // fallback to last_price
        const last = summary?.last_price;
        if (last != null) {
          const val = Number(last);
          if (!Number.isNaN(val) && mounted) setBuffer(Array(SPARK_MAX).fill(val));
          return;
        }

        // nothing — leave empty and schedule fallback fetch if provided
        if (mounted) setBuffer([]);

        if (getKlines) {
          // delayed single-shot fallback
          setTimeout(async () => {
            try {
              const res = await getKlines(symbol);
              // res might be array of klines
              const closes = extractClosesFromKlines(res || []);
              if (closes.length > 0 && mounted) setBuffer(padTo(closes.slice(-SPARK_MAX), SPARK_MAX));
            } catch (e) {
              // ignore
            }
          }, 150);
        }
      } catch (e) {
        // ignore
      }
    }
    seed();
    return () => {
      mounted = false;
    };
  }, [summary, symbol, getKlines]);

  const points = useMemo(() => {
    if (!buffer || buffer.length === 0) return null;
    const min = Math.min(...buffer);
    const max = Math.max(...buffer);
    const range = max - min || 1;
    const step = width / (buffer.length - 1 || 1);
    const coords = buffer.map((v, i) => {
      const x = i * step;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    });
    return coords.join(' ');
  }, [buffer, width, height]);

  if (Svg && Path && points) {
    // render simple polyline path
    const d = `M ${points.replace(/ /g, ' L ')}`;
    return (
      // @ts-ignore
      <Svg width={width} height={height}>
        {/* @ts-ignore */}
        <Path d={d} stroke={strokeColor || summary?.strokeColor || '#1f6feb'} strokeWidth={1.5} fill="none" />
      </Svg>
    );
  }

  // Fallback: render small text summary or simple bar list
  if (!buffer || buffer.length === 0) {
    return <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>{debug ? <Text>no data</Text> : null}</View>;
  }

  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end', gap: 1 }}>
      {buffer.map((v, i) => (
        <View
          key={i}
          style={{
            width: Math.max(1, Math.round(width / SPARK_MAX) - 2),
            height: Math.max(1, (v / Math.max(...buffer)) * height),
            backgroundColor: strokeColor || summary?.strokeColor || '#1f6feb',
            opacity: 0.9,
          }}
        />
      ))}
    </View>
  );
}
