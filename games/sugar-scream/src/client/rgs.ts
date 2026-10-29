// Stake Engine RGS client, implementing the documented HTTP contract.
// The RGS host comes from the `rgs_url` launch parameter; it is never hard-coded.

export interface Balance {
  amount: number;
  currency: string;
}

export interface Jurisdiction {
  socialCasino: boolean;
  disabledFullscreen: boolean;
  disabledTurbo: boolean;
  disabledSuperTurbo: boolean;
  disabledAutoplay: boolean;
  disabledSlamstop: boolean;
  disabledSpacebar: boolean;
  disabledBuyFeature: boolean;
  displayNetPosition: boolean;
  displayRTP: boolean;
  displaySessionTimer: boolean;
  minimumRoundDuration: number;
}

export interface RgsConfig {
  /** The game's ID on Stake Engine (used for replay links), when the RGS sends it. */
  gameID?: string;
  minBet: number;
  maxBet: number;
  stepBet: number;
  defaultBetLevel: number;
  betLevels: number[];
  jurisdiction: Jurisdiction;
}

export interface RgsRound {
  /** The bet's ID: the event a replay link points at. */
  betID?: number | string;
  event?: number | string | null;
  payoutMultiplier: number;
  costMultiplier?: number;
  active?: boolean;
  mode?: string;
  amount?: number;
  state: unknown;
}

export class RgsError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const MESSAGES: Record<string, string> = {
  ERR_VAL: 'The request was not accepted.',
  ERR_IPB: 'Insufficient balance for this bet.',
  ERR_IS: 'Your session has expired. Please reload the game.',
  ERR_ATE: 'Authentication failed. Please reload the game.',
  ERR_GLE: 'Gambling limit reached.',
  ERR_LOC: 'Play is not available in your location.',
  ERR_GEN: 'A server error occurred. Please try again.',
  ERR_MAINTENANCE: 'The game server is under maintenance.',
  NOT_FOUND: 'Round not found.',
  NETWORK: 'Connection problem. Please check your internet connection.',
};

export function errorMessage(e: unknown): string {
  if (e instanceof RgsError) return MESSAGES[e.code] ?? e.message;
  return MESSAGES.NETWORK;
}

export class RgsClient {
  readonly base: string;
  readonly sessionID: string;

  constructor(rgsUrl: string, sessionID: string) {
    const local = /^(localhost|127\.0\.0\.1)(:|\/|$)/.test(rgsUrl);
    this.base = /^https?:\/\//.test(rgsUrl) ? rgsUrl : `${local ? 'http' : 'https'}://${rgsUrl}`;
    this.base = this.base.replace(/\/$/, '');
    this.sessionID = sessionID;
  }

  async request<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new RgsError('NETWORK', MESSAGES.NETWORK, 0);
    }
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      /* empty or non-JSON body */
    }
    if (!res.ok) {
      const d = (data ?? {}) as { error?: string; code?: string; message?: string };
      const code = d.error ?? d.code ?? (res.status >= 500 ? 'ERR_GEN' : 'ERR_VAL');
      throw new RgsError(code, d.message ?? code, res.status);
    }
    return data as T;
  }

  authenticate(language: string) {
    return this.request<{ balance: Balance; config: RgsConfig; round: RgsRound | null }>('POST', '/wallet/authenticate', { sessionID: this.sessionID, language });
  }

  balance() {
    return this.request<{ balance: Balance }>('POST', '/wallet/balance', { sessionID: this.sessionID });
  }

  play(amount: number, mode: string) {
    return this.request<{ balance: Balance; round: RgsRound }>('POST', '/wallet/play', { sessionID: this.sessionID, amount, mode });
  }

  endRound() {
    return this.request<{ balance: Balance }>('POST', '/wallet/end-round', { sessionID: this.sessionID });
  }

  event(value: string) {
    return this.request<{ event: string }>('POST', '/bet/event', { sessionID: this.sessionID, event: value });
  }

  replay(game: string, version: string, mode: string, event: string) {
    return this.request<RgsRound>('GET', `/bet/replay/${encodeURIComponent(game)}/${encodeURIComponent(version)}/${encodeURIComponent(mode)}/${encodeURIComponent(event)}`);
  }
}
