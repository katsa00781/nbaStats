import { createNbaClient } from '@/lib/db-schema'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function createSupabaseClient() {
  return createNbaClient(supabaseUrl, supabaseAnonKey, {
    persistSession: true,
    autoRefreshToken: true,
    // Csak email/jelszó flow van, nincs magic link / OAuth callback
    detectSessionInUrl: false,
  })
}

// Dev módban a Fast Refresh újraértékelheti ezt a modult, és több GoTrueClient
// példány versenyezne ugyanazért a refresh tokenért. A globalThis-en tárolt
// példány ezt megakadályozza.
const globalForSupabase = globalThis as typeof globalThis & {
  __nbastatsSupabaseClient?: ReturnType<typeof createSupabaseClient>
}

export const supabase = globalForSupabase.__nbastatsSupabaseClient ?? createSupabaseClient()

if (process.env.NODE_ENV !== 'production') {
  globalForSupabase.__nbastatsSupabaseClient = supabase
}

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[]

type Timestamps = { created_at: string }

// Típusok a Supabase táblákhoz – a migrations/001 tükre (`nba` séma).
export type Database = {
  nba: {
    Tables: {
      seasons: {
        Row: Timestamps & {
          id: string
          espn_year: number
          name: string
          start_date: string | null
          end_date: string | null
        }
        Insert: Omit<Database['nba']['Tables']['seasons']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['nba']['Tables']['seasons']['Insert']>
      }
      teams: {
        Row: Timestamps & {
          id: string
          espn_team_id: string
          name: string
          short_name: string | null
          abbreviation: string
          conference: string | null
          division: string | null
          logo_url: string | null
          updated_at: string
        }
        Insert: Omit<Database['nba']['Tables']['teams']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['nba']['Tables']['teams']['Insert']>
      }
      players: {
        Row: Timestamps & {
          id: string
          espn_athlete_id: string
          name: string
          short_name: string | null
          position: string | null
          jersey: string | null
          headshot_url: string | null
          updated_at: string
        }
        Insert: Omit<Database['nba']['Tables']['players']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['nba']['Tables']['players']['Insert']>
      }
      games: {
        Row: Timestamps & {
          id: string
          espn_event_id: string
          season_id: string
          season_type: number
          game_date: string
          start_time: string | null
          home_team_id: string
          away_team_id: string
          home_score: number | null
          away_score: number | null
          status: GameStatus
          periods: number | null
          venue: string | null
          updated_at: string
        }
        Insert: Omit<Database['nba']['Tables']['games']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['nba']['Tables']['games']['Insert']>
      }
      player_game_stats: {
        Row: Timestamps & {
          id: number
          game_id: string
          player_id: string
          team_id: string
          season_id: string
          starter: boolean
          did_not_play: boolean
          dnp_reason: string | null
          minutes: number
          points: number
          fgm: number
          fga: number
          fg3m: number
          fg3a: number
          ftm: number
          fta: number
          close_made: number | null
          close_attempted: number | null
          mid_made: number | null
          mid_attempted: number | null
          oreb: number
          dreb: number
          reb: number
          ast: number
          stl: number
          blk: number
          tov: number
          pf: number
          plus_minus: number | null
        }
        Insert: Omit<Database['nba']['Tables']['player_game_stats']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['nba']['Tables']['player_game_stats']['Insert']>
      }
      team_game_stats: {
        Row: Timestamps & {
          id: number
          game_id: string
          team_id: string
          opponent_team_id: string
          season_id: string
          is_home: boolean
          points: number
          fgm: number
          fga: number
          fg3m: number
          fg3a: number
          ftm: number
          fta: number
          oreb: number
          dreb: number
          reb: number
          ast: number
          stl: number
          blk: number
          tov: number
          pf: number
          points_in_paint: number | null
          fast_break_points: number | null
          points_off_turnovers: number | null
          largest_lead: number | null
        }
        Insert: Omit<Database['nba']['Tables']['team_game_stats']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['nba']['Tables']['team_game_stats']['Insert']>
      }
      shot_events: {
        Row: Timestamps & {
          id: number
          game_id: string
          season_id: string
          team_id: string
          player_id: string | null
          espn_play_id: string
          period: number
          clock: string | null
          x: number
          y: number
          distance_ft: number
          zone: ShotZone
          shot_value: 2 | 3
          made: boolean
          shot_type: string | null
        }
        Insert: Omit<Database['nba']['Tables']['shot_events']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['nba']['Tables']['shot_events']['Insert']>
      }
      espn_game_raw: {
        Row: {
          espn_event_id: string
          game_id: string | null
          /** gzip-elt nyers summary, bytea hex literálként ("\x…") – lib/espn/raw-payload.ts */
          payload_gz: string
          fetched_at: string
        }
        Insert: Omit<Database['nba']['Tables']['espn_game_raw']['Row'], 'fetched_at'> & { fetched_at?: string }
        Update: Partial<Database['nba']['Tables']['espn_game_raw']['Insert']>
      }
      app_settings: {
        Row: {
          id: boolean
          followed_team_id: string | null
          updated_at: string
        }
        Insert: Partial<Database['nba']['Tables']['app_settings']['Row']>
        Update: Partial<Database['nba']['Tables']['app_settings']['Row']>
      }
    }
  }
}

export type GameStatus = 'scheduled' | 'in_progress' | 'final' | 'postponed' | 'canceled'
export type ShotZone = 'rim' | 'paint' | 'mid' | 'corner3' | 'above_break3'

export type TableInsert<T extends keyof Database['nba']['Tables']> =
  Database['nba']['Tables'][T]['Insert']
