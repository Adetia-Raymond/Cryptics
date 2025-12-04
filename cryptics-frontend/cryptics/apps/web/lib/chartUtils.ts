export type Kline = {
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  close_time?: number;
};

export type Candle = {
  time: number; // seconds
  open: number;
  high: number;
  low: number;
  close: number;
};

export function klinesToCandles(klines: Kline[]): Candle[] {
  return klines.map((k) => ({
    time: Math.floor(k.open_time / 1000),
    open: k.open,
    high: k.high,
    low: k.low,
    close: k.close,
  }));
}

export function klinesToLinePoints(klines: Kline[]): Array<{ time: number; value: number }> {
  return klines.map((k) => ({ time: Math.floor(k.open_time / 1000), value: k.close }));
}
