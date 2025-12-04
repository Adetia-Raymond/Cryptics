import api from "./axios";

export const getCurrentPrice = async (symbol: string) => {
  const res = await api.get("/market/price", { params: { symbol } });
  return res.data;
};

export const getSummary = async (symbol: string) => {
  const res = await api.get("/market/summary", { params: { symbol } });
  return res.data;
};

export const getKlines = async (symbol: string, interval = "1h", limit = 100) => {
  const res = await api.get("/market/klines", {
    params: { symbol, interval, limit },
  });
  return res.data;
};
