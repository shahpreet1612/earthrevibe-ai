import { useState, useEffect } from 'react'
import axios from 'axios'

const API = 'https://earthrevibe-ai.onrender.com'

const priorityColor = {
  urgent: '#E24B4A', high: '#EF9F27', normal: '#1D9E75', skip: '#666'
}
const intentEmoji = {
  hype: '🔥', question_price: '💰', question_buy: '🛒',
  question_size: '📏', negative_price: '😤', negative_quality: '😠',
  love: '❤️', brand_deal_hint: '🤝', neutral: '💬',
  sarcastic_user: '😏', irrelevant: '🗑️'
}
const toneLabel = {
  unexpected_wit: '😂 Wit',
  sarcastic_smart: '😏 Sarcastic',
  warm_helpful: '🙌 Helpful',
  hype_energy: '🔥 Hype',
  one_liner: '⚡ One-liner'
}

export default function CommentQueue() {
  const [comments, setComments] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending')
  const [editingId, setEditingId] = useState(null)
  const [editText, setEditText] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const load = async () => {
    try {
      const res = await axios.get(`${API}/api/comments`)
      setComments(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  const copyAndMark = async (record, commentId, replyText) => {
    // Copy to clipboard
    await navigator.clipboard.writeText(replyText)
    setCopiedId(`${record}-${replyText}`)
    setTimeout(() => setCopiedId(null), 3000)

    // Mark as approved in Airtable
    try {
      await axios.post(`${API}/api/approve`, {
        recordId: record,
        commentId,
        replyText
      })
      load()
    } catch (e) {
      console.error(e)
    }
  }

  const skip = async (recordId) => {
    await axios.post(`${API}/api/skip`, { recordId })
    load()
  }

  const filtered = comments.filter(c => {
    if (filter === 'pending') return c.Status === 'pending'
    if (filter === 'approved') return c.Status === 'approved'
    if (filter === 'auto') return c.Status === 'auto_posted'
    if (filter === 'urgent') return c.Priority === 'urgent' || c.Priority === 'high'
    return true
  })

  const counts = {
    pending: comments.filter(c => c.Status === 'pending').length,
    urgent: comments.filter(c => c.Priority === 'urgent' || c.Priority === 'high').length,
    auto: comments.filter(c => c.Status === 'auto_posted').length,
  }

  return (
    <div>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Pending Approval', value: counts.pending, color: '#534AB7' },
          { label: 'Urgent / High', value: counts.urgent, color: '#E24B4A' },
          { label: 'Auto-Posted', value: counts.auto, color: '#1D9E75' },
          { label: 'Total Logged', value: comments.length, color: '#888' },
        ].map(s => (
          <div key={s.label} style={{
            background: '#1a1a2e', borderRadius: 10,
            padding: '14px 16px', border: '1px solid #2a2a4a'
          }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {['pending','urgent','auto','approved','all'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{
              padding: '6px 14px', borderRadius: 20,
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: filter === f ? '#534AB7' : '#1a1a2e',
              color: filter === f ? '#fff' : '#888',
              border: filter === f ? 'none' : '1px solid #2a2a4a'
            }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Notice for pending */}
      {filter === 'pending' && counts.pending > 0 && (
        <div style={{
          background: '#1a1a2e', border: '1px solid #534AB7',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          fontSize: 12, color: '#9990dd'
        }}>
          Click "Copy & Mark Done" then paste it as a reply on Instagram. Auto-posting will be live after Meta approves the app (2-3 days).
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#888' }}>No comments here yet</div>
      ) : (
        filtered.map(c => (
          <div key={c.id} style={{
            background: '#0f0f1a', borderRadius: 12,
            border: '1px solid #1e1e3a',
            borderLeft: `4px solid ${priorityColor[c.Priority] || '#333'}`,
            marginBottom: 12, overflow: 'hidden'
          }}>

            {/* Header */}
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #1e1e3a',
              display: 'flex', alignItems: 'flex-start', gap: 10
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%',
                background: '#2a1f6e', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 600, color: '#9990dd',
                flexShrink: 0
              }}>
                {(c.AuthorName || 'U')[0].toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14, fontWeight: 600, color: '#fff',
                  marginBottom: 2
                }}>
                  {c.AuthorName || 'Instagram User'}
                </div>
                <div style={{ fontSize: 11, color: '#555', marginBottom: 4 }}>
                  {c.Timestamp ? new Date(c.Timestamp).toLocaleString('en-IN') : ''}
                </div>
                <div style={{
                  fontSize: 11, color: '#666',
                  background: '#1a1a2e', borderRadius: 6,
                  padding: '3px 8px', display: 'inline-block',
                  maxWidth: '100%', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                }}>
                  Post: {c.PostCaption ? c.PostCaption.substring(0, 60) + '...' : 'Earth Revibe post'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px',
                  borderRadius: 20, background: '#1a1a2e', color: '#888'
                }}>
                  {intentEmoji[c.Intent] || ''} {c.Intent}
                </span>
                <span style={{
                  fontSize: 11, fontWeight: 500, padding: '2px 8px',
                  borderRadius: 20,
                  background: c.Status === 'approved' ? '#0d2d1a' :
                              c.Status === 'auto_posted' ? '#0d1a2d' : '#2d2000',
                  color: c.Status === 'approved' ? '#1D9E75' :
                         c.Status === 'auto_posted' ? '#185FA5' : '#EF9F27'
                }}>
                  {c.Status?.toUpperCase()}
                </span>
              </div>
            </div>

            {/* Original comment */}
            <div style={{
              padding: '10px 16px',
              background: '#13131f',
              fontSize: 15, color: '#ddd',
              borderBottom: '1px solid #1e1e3a'
            }}>
              "{c.CommentText}"
            </div>

            {/* Reply options */}
            {c.Status === 'pending' && (
              <div style={{ padding: 16 }}>
                <div style={{
                  fontSize: 10, fontWeight: 500, color: '#555',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom: 10
                }}>
                  AI Generated Replies — copy and paste on Instagram
                </div>
                {[
                  { reply: c.Reply1, tone: c.Reply1Tone, score: c.Reply1Score, idx: 0 },
                  { reply: c.Reply2, tone: c.Reply2Tone, score: c.Reply2Score, idx: 1 },
                  { reply: c.Reply3, tone: c.Reply3Tone, score: c.Reply3Score, idx: 2 },
                ].filter(r => r.reply).map((r) => (
                  <div key={r.idx} style={{
                    border: `1px solid ${r.idx === c.BestReplyIdx ? '#534AB7' : '#1e1e3a'}`,
                    borderRadius: 8, padding: '10px 12px', marginBottom: 8,
                    background: r.idx === c.BestReplyIdx ? '#16133a' : '#0f0f1a'
                  }}>
                    <div style={{
                      display: 'flex', alignItems: 'center',
                      gap: 8, marginBottom: 8
                    }}>
                      <span style={{
                        fontSize: 11, fontWeight: 500, padding: '2px 8px',
                        borderRadius: 20, background: '#1a1a2e', color: '#888'
                      }}>
                        {toneLabel[r.tone] || r.tone}
                      </span>
                      <span style={{ fontSize: 11, color: '#555' }}>
                        {r.score}/10
                      </span>
                      {r.idx === c.BestReplyIdx && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#534AB7' }}>
                          AI pick
                        </span>
                      )}
                    </div>

                    {editingId === `${c.id}-${r.idx}` ? (
                      <textarea
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        style={{
                          width: '100%', padding: 8, borderRadius: 6,
                          border: '1px solid #534AB7', fontSize: 13,
                          lineHeight: 1.5, resize: 'vertical', minHeight: 60,
                          background: '#0f0f1a', color: '#fff'
                        }}
                      />
                    ) : (
                      <div style={{
                        fontSize: 14, lineHeight: 1.6, color: '#ddd',
                        marginBottom: 8
                      }}>
                        {r.reply}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {editingId === `${c.id}-${r.idx}` ? (
                        <>
                          <button
                            onClick={() => copyAndMark(c.id, c.CommentID, editText)}
                            style={{
                              padding: '6px 14px', background: '#1D9E75',
                              color: '#fff', border: 'none', borderRadius: 6,
                              fontSize: 12, fontWeight: 500, cursor: 'pointer'
                            }}>
                            Copy edited reply
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            style={{
                              padding: '6px 14px', background: '#1a1a2e',
                              color: '#888', border: '1px solid #2a2a4a',
                              borderRadius: 6, fontSize: 12, cursor: 'pointer'
                            }}>
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => copyAndMark(c.id, c.CommentID, r.reply)}
                            style={{
                              padding: '6px 14px',
                              background: copiedId === `${c.id}-${r.reply}` ? '#1D9E75' : '#534AB7',
                              color: '#fff', border: 'none', borderRadius: 6,
                              fontSize: 12, fontWeight: 500, cursor: 'pointer'
                            }}>
                            {copiedId === `${c.id}-${r.reply}` ? 'Copied!' : 'Copy & Mark Done'}
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(`${c.id}-${r.idx}`)
                              setEditText(r.reply)
                            }}
                            style={{
                              padding: '6px 14px', background: '#1a1a2e',
                              color: '#888', border: '1px solid #2a2a4a',
                              borderRadius: 6, fontSize: 12, cursor: 'pointer'
                            }}>
                            Edit
                          </button>
                          {c.PostType === 'instagram_post' && (
                            <a
                              href="https://www.instagram.com/earthrevibe/"
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                padding: '6px 14px', background: '#1a1a2e',
                                color: '#888', border: '1px solid #2a2a4a',
                                borderRadius: 6, fontSize: 12,
                                textDecoration: 'none', display: 'inline-block'
                              }}>
                              Open Post
                            </a>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => skip(c.id)}
                  style={{
                    padding: '6px 14px', background: 'transparent',
                    color: '#555', border: '1px solid #1e1e3a',
                    borderRadius: 6, fontSize: 12, cursor: 'pointer', marginTop: 4
                  }}>
                  Skip
                </button>
              </div>
            )}

            {/* Approved reply */}
            {(c.Status === 'approved' || c.Status === 'auto_posted') && c.ApprovedReply && (
              <div style={{
                padding: '10px 16px', background: '#0d2d1a',
                fontSize: 13, color: '#1D9E75'
              }}>
                Reply: "{c.ApprovedReply}"
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
