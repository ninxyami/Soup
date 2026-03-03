export interface User {
  discord_id: string;
  username: string;
  global_name?: string;
  avatar_url: string;
  is_admin?: boolean;
  player?: {
    ingame_name: string;
    identity: string;
    games_played: number;
    games_won: number;
    times_survived: number;
  };
  quiz?: {
    rank: number;
    total_points: number;
    correct_answers: number;
    games_played: number;
  };
}

export interface ShopItem {
  item_id: string;
  name: string;
  category: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
  buy_price: number;
  sell_price?: number;
  stock: number;
  enabled: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  faction?: string;
  value: number;
}

export interface Transaction {
  id: string;
  from_name: string;
  to_name: string;
  amount: number;
  type: string;
  note?: string;
  created_at: string;
}
