export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  stars_balance: number
  created_at: string
  updated_at: string
}

export interface Request {
  id: string
  user_id: string
  title: string
  description: string
  image_url: string
  product_url: string
  base_target: number
  final_target: number
  current_stars: number
  status: 'active' | 'funded' | 'closed'
  created_at: string
  updated_at: string
  profile?: { username: string; avatar_url: string | null }
}

export interface Transaction {
  id: string
  donor_id: string
  request_id: string
  stars_amount: number
  created_at: string
}
