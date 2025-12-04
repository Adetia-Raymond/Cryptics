// Minimal WS manager stub. Replace with real WebSocket-based manager later.
type SummaryMap = Record<string, any>;

class WSManagerClass {
  private map: SummaryMap = {};

  subscribe(symbol: string) {
    // no-op in stub; in real manager you'd add to subscription set and open WS
    return;
  }

  unsubscribe(symbol: string) {
    // no-op
    return;
  }

  setLatest(symbol: string, summary: any) {
    this.map[symbol] = summary;
  }

  getLatest(symbol: string) {
    return this.map[symbol];
  }
}

const WSManager = new WSManagerClass();
export default WSManager;
