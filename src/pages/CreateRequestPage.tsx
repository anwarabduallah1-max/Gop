import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'

const PLATFORM_FEE = 0.10
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

type ImageMode = 'url' | 'upload'

export default function CreateRequestPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const navigate = useNavigate()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [productUrl, setProductUrl] = useState('')
  const [baseTarget, setBaseTarget] = useState('')
  const [loading, setLoading] = useState(false)
  const [imagePreviewError, setImagePreviewError] = useState(false)

  const [imageMode, setImageMode] = useState<ImageMode>('url')
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const base = parseFloat(baseTarget) || 0
  const fee = base * PLATFORM_FEE
  const finalTarget = base + fee

  const validateFile = (file: File): boolean => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      showToast('Please choose a JPG, PNG, WEBP, or GIF image.', 'error')
      return false
    }
    if (file.size > MAX_FILE_SIZE) {
      showToast('Image must be under 5 MB.', 'error')
      return false
    }
    return true
  }

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return
    if (!validateFile(file)) return
    setUploadedFile(file)
    setImageUrl('')
    setImagePreviewError(false)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelected(e.target.files?.[0])
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFileSelected(e.dataTransfer.files?.[0])
  }

  const handleRemoveUpload = () => {
    setUploadedFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) { navigate('/login'); return }
    if (!title.trim()) { showToast('Please enter a title', 'error'); return }
    if (base <= 0) { showToast('Please enter a valid target amount', 'error'); return }

    setLoading(true)

    let finalImageUrl = imageUrl.trim()

    // If a file was selected, upload it to Supabase Storage
    if (imageMode === 'upload' && uploadedFile) {
      setUploading(true)
      const fileExt = uploadedFile.name.split('.').pop() || 'jpg'
      const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${fileExt}`
      const { error: upErr } = await supabase.storage
        .from('request-images')
        .upload(filePath, uploadedFile, { cacheControl: '3600', upsert: false })
      setUploading(false)
      if (upErr) {
        showToast(upErr.message, 'error')
        setLoading(false)
        return
      }
      const { data: pub } = supabase.storage.from('request-images').getPublicUrl(filePath)
      finalImageUrl = pub.publicUrl
    }

    const { error } = await supabase.from('requests').insert({
      title: title.trim(),
      description: description.trim(),
      image_url: finalImageUrl,
      product_url: productUrl.trim(),
      base_target: base,
      final_target: finalTarget,
    })
    setLoading(false)

    if (error) {
      showToast(error.message, 'error')
    } else {
      showToast('Request created successfully!', 'success')
      navigate('/my-requests')
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 60px)', paddingBottom: 80, paddingTop: 40 }}>
      <div className="page-container" style={{ maxWidth: 720 }}>
        {/* Breadcrumb */}
        <button className="btn-ghost" onClick={() => navigate('/')} style={{ marginBottom: 24, paddingLeft: 0 }}>
          ← Back to Explore
        </button>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: '0 0 8px', fontSize: 32, fontWeight: 900, letterSpacing: '-0.02em' }}>
            Create a Request
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: 15 }}>
            Share what you need and let the community help fund it with Stars.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 28, alignItems: 'start' }}>
          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label className="field-label">Item / Request Title *</label>
              <input
                className="field-input"
                type="text"
                placeholder="e.g. Gaming PC RTX 4090 Setup"
                value={title}
                onChange={e => setTitle(e.target.value)}
                maxLength={120}
                required
              />
            </div>

            <div>
              <label className="field-label">Description</label>
              <textarea
                className="field-input"
                placeholder="Tell people why you need this item..."
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div>
              <label className="field-label">Product Image</label>
              <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
                <button
                  type="button"
                  className={`chip ${imageMode === 'url' ? 'active' : ''}`}
                  onClick={() => { setImageMode('url'); setUploadedFile(null) }}
                >
                  Image URL
                </button>
                <button
                  type="button"
                  className={`chip ${imageMode === 'upload' ? 'active' : ''}`}
                  onClick={() => setImageMode('upload')}
                >
                  Upload Photo
                </button>
              </div>

              {imageMode === 'url' ? (
                <>
                  <input
                    className="field-input"
                    type="url"
                    placeholder="https://example.com/product.jpg"
                    value={imageUrl}
                    onChange={e => { setImageUrl(e.target.value); setImagePreviewError(false) }}
                  />
                  {imageUrl && !imagePreviewError && (
                    <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', height: 160 }}>
                      <img
                        src={imageUrl}
                        alt="Preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={() => setImagePreviewError(true)}
                      />
                    </div>
                  )}
                  {imagePreviewError && (
                    <div style={{ marginTop: 8, fontSize: 13, color: 'var(--error)' }}>
                      Could not load image from that URL.
                    </div>
                  )}
                </>
              ) : (
                <>
                  {!uploadedFile ? (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      style={{
                        border: `2px dashed ${dragOver ? 'var(--accent)' : 'var(--border)'}`,
                        borderRadius: 12,
                        padding: '32px 20px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        background: dragOver ? 'var(--accent-muted)' : 'var(--surface-raised)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.5 }}>📷</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {dragOver ? 'Drop image here' : 'Tap to upload or drag a photo'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        JPG, PNG, WEBP or GIF · up to 5 MB
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(',')}
                        onChange={handleFileInput}
                        style={{ display: 'none' }}
                      />
                    </div>
                  ) : (
                    <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <img
                        src={URL.createObjectURL(uploadedFile)}
                        alt="Preview"
                        style={{ width: '100%', height: 200, objectFit: 'cover' }}
                      />
                      <button
                        type="button"
                        onClick={handleRemoveUpload}
                        style={{
                          position: 'absolute', top: 10, right: 10,
                          background: 'rgba(0,0,0,0.7)',
                          border: '1px solid var(--border)',
                          color: 'var(--text-primary)',
                          width: 28, height: 28, borderRadius: '50%',
                          cursor: 'pointer', fontSize: 14,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        ✕
                      </button>
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(0,0,0,0.6)',
                        padding: '8px 12px',
                        fontSize: 12, color: 'var(--text-primary)',
                      }}>
                        {uploadedFile.name} · {(uploadedFile.size / 1024).toFixed(0)} KB
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label className="field-label">Product Link (optional)</label>
              <input
                className="field-input"
                type="url"
                placeholder="https://amazon.com/product/..."
                value={productUrl}
                onChange={e => setProductUrl(e.target.value)}
              />
            </div>

            <div>
              <label className="field-label">Target Amount (Stars) *</label>
              <input
                className="field-input"
                type="number"
                placeholder="e.g. 100"
                value={baseTarget}
                onChange={e => setBaseTarget(e.target.value)}
                min={1}
                required
              />
              <p style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>
                This is how many Stars you want to raise (1 Star = 1 USDT)
              </p>
            </div>

            <button
              type="submit"
              className="btn-primary"
              disabled={loading || !title.trim() || base <= 0 || (imageMode === 'upload' && uploading)}
              style={{ width: '100%', padding: '14px', fontSize: 15 }}
            >
              {uploading ? 'Uploading image...' : loading ? 'Creating...' : 'Create Request'}
            </button>
          </form>

          {/* Live breakdown card */}
          <div style={{ position: 'sticky', top: 80 }}>
            <div className="card" style={{ padding: '22px', overflow: 'hidden' }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                  Live Goal Breakdown
                </div>
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {title || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Your request title...</span>}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Base target</span>
                  <span className="stars-badge" style={{ fontSize: 13 }}>★ {base.toFixed(0)}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-raised)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Platform fee (10%)</span>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>+ ★ {fee.toFixed(1)}</span>
                </div>

                <hr className="divider" />

                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--accent-muted)', borderRadius: 8, border: '1px solid rgba(245,200,66,0.2)' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)' }}>Total Goal</span>
                  <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>★ {finalTarget.toFixed(1)}</span>
                </div>
              </div>

              {base > 0 && (
                <>
                  <div style={{ margin: '18px 0 10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)' }}>
                      <span>Progress preview</span>
                      <span>0%</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: '0%' }} />
                    </div>
                  </div>

                  <div style={{ padding: '12px 14px', background: 'rgba(62,207,142,0.06)', border: '1px solid rgba(62,207,142,0.2)', borderRadius: 8, marginTop: 14 }}>
                    <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 600, marginBottom: 4 }}>
                      Upon full funding, you receive:
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--success)' }}>
                      ★ {base.toFixed(0)} Stars
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      (after {PLATFORM_FEE * 100}% platform fee of ★ {fee.toFixed(1)})
                    </div>
                  </div>
                </>
              )}

              <div style={{ marginTop: 16, padding: '10px 12px', background: 'var(--surface-raised)', borderRadius: 8, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                The platform retains 10% of every withdrawal, regardless of whether the goal is fully reached.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
