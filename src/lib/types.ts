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
  status: 'active' | 'funded' | 'closed' | 'paid_out'
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

export interface PaymentOrder {
  id: string
  user_id: string
  usdt_amount: number
  stars_amount: number
  status: 'pending' | 'confirmed' | 'failed'
  tx_hash: string | null
  created_at: string
  confirmed_at: string | null
}

export interface PayoutRequest {
  id: string
  request_id: string
  creator_id: string
  gross_stars: number
  platform_fee_stars: number
  net_stars: number
  net_usdt: number
  wallet_address: string
  status: 'processing' | 'completed' | 'failed'
  tx_hash: string | null
  created_at: string
  completed_at: string | null
}
