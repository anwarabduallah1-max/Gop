import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useToast } from '../context/ToastContext'

interface AvatarUploadProps {
  userId: string
  avatarPath?: string | null
  username?: string | null
  size?: number
  onUploaded: (avatarPath: string) => void
}

export async function getAvatarSignedUrl(avatarPath: string | null | undefined): Promise<string | null> {
  if (!avatarPath) return null
  const { data, error } = await supabase.storage.from('avatars').createSignedUrl(avatarPath, 3600)
  if (error) {
    console.error('Avatar URL error:', error)
    return null
  }
  return data.signedUrl
}

export default function AvatarUpload({ userId, avatarPath, username, size = 112, onUploaded }: AvatarUploadProps) {
  const { showToast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true
    if (!avatarPath) {
      setPreviewUrl(null)
      return
    }
    getAvatarSignedUrl(avatarPath).then(url => { if (active) setPreviewUrl(url) })
    return () => { active = false }
  }, [avatarPath])

  useEffect(() => () => {
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  const handleSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file.', 'error'); return }
    if (file.size > 5 * 1024 * 1024) { showToast('Images must be smaller than 5 MB.', 'error'); return }

    const localPreview = URL.createObjectURL(file)
    setPreviewUrl(localPreview)
    setLoading(true)
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${userId}/avatar-${Date.now()}.${extension}`

    try {
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type })
      if (uploadError) throw uploadError
      const { error: profileError } = await supabase.from('profiles').update({ avatar_url: path, updated_at: new Date().toISOString() }).eq('id', userId)
      if (profileError) {
        await supabase.storage.from('avatars').remove([path])
        throw profileError
      }
      const signedUrl = await getAvatarSignedUrl(path)
      setPreviewUrl(signedUrl ?? localPreview)
      onUploaded(path)
      showToast('Profile picture updated.', 'success')
    } catch (error) {
      console.error('Avatar upload error:', error)
      setPreviewUrl(avatarPath ? await getAvatarSignedUrl(avatarPath) : null)
      showToast('Could not upload your profile picture. Please try again.', 'error')
    } finally {
      setLoading(false)
      URL.revokeObjectURL(localPreview)
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
      <button type="button" onClick={() => inputRef.current?.click()} disabled={loading} aria-label="Choose profile picture" style={{ position: 'relative', width: size, height: size, borderRadius: '50%', padding: 0, overflow: 'hidden', cursor: loading ? 'wait' : 'pointer', border: '2px solid rgba(245,200,66,0.4)', background: 'var(--accent-muted)', color: 'var(--accent)', flexShrink: 0 }}>
        {previewUrl ? <img src={previewUrl} alt="Profile preview" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', opacity: loading ? 0.45 : 1 }} /> : <span style={{ fontSize: size * 0.34, fontWeight: 800 }}>{(username?.[0] ?? 'U').toUpperCase()}</span>}
        {loading && <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(0,0,0,0.35)', fontSize: 12, fontWeight: 800 }}>Saving</span>}
      </button>
      <div><input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleSelect} hidden /><div style={{ fontSize: 15, fontWeight: 750, color: 'var(--text-primary)' }}>Profile picture</div><div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 5, lineHeight: 1.5 }}>JPG, PNG, WEBP, or GIF. Maximum 5 MB.</div><button type="button" className="btn-secondary" onClick={() => inputRef.current?.click()} disabled={loading} style={{ marginTop: 10, padding: '7px 12px', fontSize: 12 }}>{loading ? 'Uploading...' : previewUrl ? 'Change picture' : 'Choose picture'}</button></div>
    </div>
  )
}
