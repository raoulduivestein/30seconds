export type PlayerRole = "host" | "player" | "cohost" | "describer";
export type RoomStatus = "lobby" | "actief" | "gepauzeerd" | "afgelopen";
export type WordStatus = "pending" | "correct" | "wrong" | "skipped";
export type Difficulty = "makkelijk" | "normaal" | "moeilijk";

export interface AccessibilityPreferences {
  textSize?: "normaal" | "groot" | "extra-groot";
  contrast?: "normaal" | "hoog" | "zwart-geel" | "zwart-wit";
  reduceMotion?: boolean;
  screenreaderMode?: boolean;
  timerAnnouncements?: boolean;
  soundSignals?: boolean;
  vibration?: boolean;
  simpleView?: boolean;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  teamId: string | null;
  accessibilityPreferences: AccessibilityPreferences;
  joinedAt: string;
  connected: boolean;
}

export interface Team {
  id: string;
  name: string;
  colorName: string;
  players: string[];
  leaderId: string | null;
  score: number;
}

export interface GameCard {
  id: string;
  category: string;
  difficulty: Difficulty;
  words: string[];
  status: "actief" | "inactief";
}

export interface WordResult {
  word: string;
  status: WordStatus;
  points: number;
}

export interface Turn {
  id: string;
  teamId: string;
  judgingTeamId: string | null;
  describerPlayerId: string;
  cardId: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number;
  wordResults: WordResult[];
  points: number;
}

export interface Settings {
  timerSeconds: number;
  rounds: number;
  targetScore: number;
  allowSkips: boolean;
  maxSkips: number;
  penaltyEnabled: boolean;
  penaltyPoints: number;
  cardsCanRepeat: boolean;
  manualApproval: boolean;
  accessibilityDefault: boolean;
  wordsPerCard: number;
}

export interface Room {
  id: string;
  code: string;
  hostToken: string;
  status: RoomStatus;
  settings: Settings;
  players: Player[];
  teams: Team[];
  currentRound: number;
  currentTurn: Turn | null;
  createdAt: string;
  expiresAt: string;
}
