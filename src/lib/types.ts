export interface Profile {
  id: string
  username: string
  avatar_url: string | null
  stars_balance: number
  referral_code: string
  referred_by: string | null
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
  is_unlimited: boolean
  is_platform_post: boolean
  status: 'active' | 'funded' | 'closed' | 'paid_out'
  created_at: string
  updated_at: string
  profile?: { username: string; avatar_url: string | null } | null
}

export interface Supporter {
  username: string
  avatar_url: string | null
  donated_stars: number
  referral_stars: number
  total_stars: number
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
  plisio_invoice_id: string | null
  plisio_invoice_url: string | null
  plisio_invoice_qr: string | null
  plisio_order_number: string | null
  plisio_currency: string | null
}

export interface Withdrawal {
  id: string
  user_id: string
  stars_amount: number
  platform_fee_stars: number
  usdt_amount: number
  wallet_address: string
  status: 'processing' | 'completed' | 'failed'
  plisio_txn_id: string | null
  created_at: string
  completed_at: string | null
}
