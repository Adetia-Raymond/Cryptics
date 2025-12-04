import api from "./axios";

export const addToWatchlist = async (symbol: string, notes: string) => {
  const res = await api.post("/watchlist/", { symbol, notes });
  return res.data;
};

export const getWatchlist = async (includeMarketData = true) => {
  const res = await api.get("/watchlist/", {
    params: { include_market_data: includeMarketData },
  });
  return res.data;
};

export const updateWatchlist = async (id: string, data: any) => {
  const res = await api.patch(`/watchlist/${id}`, data);
  return res.data;
};

export const deleteWatchlist = async (id: string) => {
  return api.delete(`/watchlist/${id}`);
};
