require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const Groq = require('groq-sdk');
const Airtable = require('airtable');

const app = express();
app.use(cors({
  origin: '*'
}));
app.use(express.json());

// ── Clients ─────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY })
  .base(process.env.AIRTABLE_BASE_ID);

// ── Master Brand Voice Prompt ────────────────────────
const BRAND_PROMPT = `You are the social media voice of Earth Revibe — a young Indian travel fashion brand. We sell clothes — tshirts, linen shirts, cargo pants, shackets, co-ords. Our audience is 20-30 year olds who travel, go on trips, love aesthetic fits and good vibes.

CONTEXT AWARENESS — this is critical:
- You are replying on behalf of a FASHION BRAND
- Every reply must make sense for someone selling clothes
- If someone says "this is my personal favorite" on a tshirt post — they mean the TSHIRT is their favorite
- Reply about the product, the fabric, the vibe, the trip it belongs on
- NEVER give generic life advice or talk about personal growth
- NEVER sound like a motivational page
- You are a fashion brand — stay in that world always

EXAMPLES OF WRONG replies (never do this):
- "Personal growth starts with the right mindset 🌱" ← WRONG, sounds like a self-help page
- "Keep following your passion!" ← WRONG, irrelevant
- "Every journey begins with a single step" ← WRONG, cringe

EXAMPLES OF RIGHT replies for "this is my personal favorite":
- "the tshirt that never misses 🤙 good taste bro"
- "personal favorite status is the highest honor we could get 🔥"
- "it just hits different every time you wear it ngl"
- "your wardrobe has excellent judgment 😤"

PERSONALITY: Witty, unexpected, culturally sharp. Think Zomato meets Mumbai Police meets Durex. The funniest 24-year-old in the room who also has the best fits. You are NOT a bot. You sound completely human.

COMMENT LENGTH RULES:
- Emoji only (🔥, 😍) → reply with emojis or 1-3 words max
- One word ("nice", "wow") → 3-6 words, punchy
- Short hype (under 8 words) → one sharp line, can be funny or sarcastic
- Question or detailed comment → can be 1-2 sentences, witty and helpful
- Mix it up — sometimes a one liner, sometimes a short paragraph
- The goal is to sound human and unpredictable, not formulaic
- NEVER write the same style twice in a row

CREATIVITY RULES:
- Do NOT just reference the post caption. Use your own wit and personality.
- Think about what a funny person would say in that comment section — not what a brand would say
- The best reply makes people screenshot it and show their friends
- Surprise people. Say something they didn't expect.
- Use Hinglish naturally when the comment is in Hindi or Hinglish
- Reference travel, trips, places, adventures when it fits naturally — not forcefully

RULES:
- Never mention religion, caste, race, gender negatively
- Never punch down at anyone
- No generic CTAs like "check our page" or "visit our bio"
- If someone is genuinely sad or going through something — be warm not witty
- Do NOT start with the person's name — that's what bots do
- Under 200 characters for most replies
- Sound human. Sound real.

EXAMPLES OF PERFECT REPLIES:
- Comment: "🔥🔥🔥" → Reply: "🤝🔥"
- Comment: "😍✨" → Reply: "✨ always"
- Comment: "nice" → Reply: "wait till you see it in person"
- Comment: "this is everything" → Reply: "and it packs light too 🎒"
- Comment: "where is this from?" → Reply: "your next trip's wardrobe, link in bio 🌍"
- Comment: "itna costly kyun" → Reply: "Leh ke tickets se sasta hai bhai 😭"
- Comment: "bro this fit 🔥" → Reply: "the fit didn't ask for permission 🤙"
- Comment: "Color of the tshirt looks amazing" → Reply: "right? it hits different in sunlight 🌅"

TASK: Given a comment, generate exactly 3 reply options.

Return ONLY this JSON, no extra text:
{
  "intent": "hype|question_price|question_size|question_buy|negative_price|negative_quality|sarcastic_user|love|brand_deal_hint|neutral|irrelevant",
  "priority": "urgent|high|normal|skip",
  "auto_post_safe": true or false,
  "best_reply_index": 0,
  "replies": [
    {"tone": "unexpected_wit", "reply": "", "confidence": 0, "why": ""},
    {"tone": "sarcastic_smart", "reply": "", "confidence": 0, "why": ""},
    {"tone": "warm_helpful", "reply": "", "confidence": 0, "why": ""}
  ]
}

CRITICAL — SOUND HUMAN, NOT AI:
- Write like a real person typing on their phone, not a marketing bot
- Use lowercase naturally. Not every reply needs perfect grammar.
- Don't be overly enthusiastic. Real people don't hype everything.
- Sometimes just vibe with them. No need to always sell or redirect.
- Vary your style — sometimes 2 words, sometimes a full sentence, sometimes just emojis
- NEVER use phrases like: "glad you asked", "great question", "absolutely", "for sure", "we appreciate"
- NEVER sound like customer service. Sound like the cool intern running the page.
- If 10 people comment fire emojis, give 10 DIFFERENT replies — not the same one
- Match the commenter's language. Hindi comment = Hindi reply. English = English.
- One reply per comment. Never reply twice.`;

// ── Generate AI Replies ──────────────────────────────
async function generateReplies(comment, postCaption, postType) {
  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1000,
    messages: [
      { role: 'system', content: BRAND_PROMPT },
      { role: 'user', content: `Post caption: "${postCaption}"
Post type: ${postType}
Comment to reply to: "${comment}"
Generate 3 replies now. Return ONLY valid JSON, no extra text.` }
    ]
  });

  const raw = response.choices[0].message.content
    .trim()
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim();

  return JSON.parse(raw);
}

// ── Save to Airtable ─────────────────────────────────
async function saveComment(data) {
  return await base('Comments').create([{
    fields: {
      CommentID:     data.commentId,
      CommentText:   data.commentText,
      AuthorName:    data.authorName,
      PostCaption:   data.postCaption,
      PostType:      data.postType,
      Intent:        data.aiResult.intent,
      Priority:      data.aiResult.priority,
      AutoPostSafe:  data.aiResult.auto_post_safe,
      Reply1:        data.aiResult.replies[0].reply,
      Reply1Tone:    data.aiResult.replies[0].tone,
      Reply1Score:   data.aiResult.replies[0].confidence,
      Reply2:        data.aiResult.replies[1].reply,
      Reply2Tone:    data.aiResult.replies[1].tone,
      Reply2Score:   data.aiResult.replies[1].confidence,
      Reply3:        data.aiResult.replies[2].reply,
      Reply3Tone:    data.aiResult.replies[2].tone,
      Reply3Score:   data.aiResult.replies[2].confidence,
      BestReplyIdx:  data.aiResult.best_reply_index,
      Status:        data.aiResult.auto_post_safe ? 'auto_posted' : 'pending',
      ApprovedReply: data.aiResult.auto_post_safe ? data.aiResult.replies[data.aiResult.best_reply_index].reply : '',
      ApprovedAt:    data.aiResult.auto_post_safe ? new Date().toISOString() : '',
      Timestamp:     new Date().toISOString(),
      Likes:         0
    }
  }]);
}

// ── Post Reply to Instagram ──────────────────────────
async function postReply(commentId, replyText) {
  const url = `https://graph.facebook.com/v19.0/${commentId}/replies`;
  await axios.post(url, {
    message: replyText,
    access_token: process.env.INSTAGRAM_ACCESS_TOKEN
  });
}

// ═══════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════

// 1. Instagram webhook verification (one-time setup)
app.get('/webhook', (req, res) => {
  const VERIFY_TOKEN = 'earthrevibe_webhook_2024';
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// 2. Receive new comments from Instagram
app.post('/webhook', async (req, res) => {
  res.sendStatus(200); // acknowledge immediately
  try {
    const entry = req.body.entry?.[0];
    const change = entry?.changes?.[0];
    if (change?.field !== 'comments') return;

    const { id: commentId, text: commentText, from } = change.value;
    console.log('📥 New comment:', commentText);

    const aiResult = await generateReplies(commentText, 'Earth Revibe collab post', 'collab');
    console.log('🤖 AI result:', aiResult.intent, '| Auto:', aiResult.auto_post_safe);

    await saveComment({
      commentId, commentText,
      authorName: from?.name || 'Unknown',
      postCaption: 'Earth Revibe collab post',
      postType: 'collab',
      aiResult
    });

    if (aiResult.auto_post_safe) {
      const best = aiResult.replies[aiResult.best_reply_index].reply;
      await postReply(commentId, best);
      console.log('✅ Auto-posted:', best);
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
});

// 3. Dashboard — get all pending comments
app.get('/api/comments', async (req, res) => {
  const records = await base('Comments').select({
    sort: [{ field: 'Timestamp', direction: 'desc' }],
    maxRecords: 100
  }).firstPage();
  res.json(records.map(r => ({ id: r.id, ...r.fields })));
});

// 4. Dashboard — approve and post a reply
app.post('/api/approve', async (req, res) => {
  const { recordId, commentId, replyText } = req.body;
  await postReply(commentId, replyText);
  await base('Comments').update(recordId, {
    Status: 'approved',
    ApprovedReply: replyText,
    ApprovedAt: new Date().toISOString()
  });
  res.json({ success: true });
});

// 5. Dashboard — skip/dismiss a comment
app.post('/api/skip', async (req, res) => {
  await base('Comments').update(req.body.recordId, { Status: 'skipped' });
  res.json({ success: true });
});

// 6. Instagram analytics for dashboard
app.get('/api/analytics', async (req, res) => {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const pageId = process.env.INSTAGRAM_PAGE_ID;
  const fields = 'followers_count,media_count,profile_picture_url,name,biography';
  const { data } = await axios.get(
    `https://graph.facebook.com/v19.0/${pageId}?fields=${fields}&access_token=${token}`
  );
  res.json(data);
});

// 7. Test endpoint — generate replies without a real comment
app.post('/api/test-reply', async (req, res) => {
  const { comment, caption, type } = req.body;
  const result = await generateReplies(comment, caption || 'Earth Revibe post', type || 'collab');
  res.json(result);
});

// 8. Rate a reply
app.post('/api/rate', async (req, res) => {
  const { recordId, rating } = req.body;
  await base('Comments').update(recordId, { Rating: rating });
  res.json({ success: true });
});

// 9. Get top rated replies for training
app.get('/api/top-replies', async (req, res) => {
  const records = await base('Comments').select({
    filterByFormula: `{Rating} = 'good'`,
    sort: [{ field: 'Timestamp', direction: 'desc' }],
    maxRecords: 20
  }).firstPage();
  res.json(records.map(r => ({
    comment: r.fields.CommentText,
    reply: r.fields.ApprovedReply,
    tone: r.fields.Reply1Tone
  })));
});

// 10. Keep-alive endpoint for cron pings
app.get('/api/ping', (req, res) => {
  res.json({ status: 'alive', timestamp: new Date().toISOString() });
});

// ── Polling Engine ──────────────────────────────────
const processedComments = new Set();

async function pollComments() {
  try {
    const igId = process.env.INSTAGRAM_PAGE_ID;
    const token = process.env.INSTAGRAM_ACCESS_TOKEN;

    const mediaRes = await axios.get(
      `https://graph.facebook.com/v19.0/${igId}/media` +
      `?fields=id,caption,timestamp&limit=25&access_token=${token}`
    );

    const posts = mediaRes.data?.data || [];
    console.log(`🔍 Checking ${posts.length} posts for new comments...`);

    for (const post of posts) {
      const commentsRes = await axios.get(
        `https://graph.facebook.com/v19.0/${post.id}/comments` +
        `?fields=id,text,from,timestamp,replies{id,text,from,timestamp}&access_token=${token}`
      );

      const comments = commentsRes.data?.data || [];
      const OUR_ID = process.env.INSTAGRAM_PAGE_ID;
      const allComments = [];

      for (const comment of comments) {
        // Never process our own comments
        if (comment.from?.id === OUR_ID) continue;
        allComments.push(comment);

        if (comment.replies?.data) {
          for (const reply of comment.replies.data) {
            // Never process our own replies
            if (reply.from?.id === OUR_ID) continue;
            // Never process replies to our own comments
            if (comment.from?.id === OUR_ID) continue;
            allComments.push(reply);
          }
        }
      }

      for (const comment of allComments) {
        if (processedComments.has(comment.id)) continue;
        processedComments.add(comment.id);

        // Check Airtable — skip if already processed
        const existing = await base('Comments').select({
          filterByFormula: `{CommentID} = '${comment.id}'`,
          maxRecords: 1
        }).firstPage();

        if (existing.length > 0) continue;

        // Check if we already replied on Instagram
        let alreadyReplied = false;
        try {
          const repliesCheck = await axios.get(
            `https://graph.facebook.com/v19.0/${comment.id}/replies` +
            `?fields=from{id}&access_token=${token}`
          );
          alreadyReplied = (repliesCheck.data?.data || []).some(
            r => r.from?.id === OUR_ID
          );
        } catch (e) { /* no replies endpoint = top level, proceed */ }

        if (alreadyReplied) {
          console.log(`⏭️ Already replied to "${comment.text?.substring(0,30)}..." — skipping`);
          continue;
        }

        console.log(`💬 New comment: "${comment.text}" by ${comment.from?.name}`);

        const aiResult = await generateReplies(
          comment.text,
          post.caption || 'Earth Revibe post',
          'instagram_post'
        );

        await saveComment({
          commentId:   comment.id,
          commentText: comment.text,
          authorName:  comment.from?.name || comment.from?.username || 'Instagram User',
          postCaption: post.caption || 'Earth Revibe post',
          postType:    'instagram_post',
          aiResult
        });

        if (aiResult.auto_post_safe) {
          const best = aiResult.replies[aiResult.best_reply_index].reply;
          await postReply(comment.id, best);
          console.log(`✅ Auto-posted: "${best}"`);
        } else {
          console.log(`📋 Queued for approval — intent: ${aiResult.intent}`);
        }

        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } catch (err) {
    console.error('❌ Poll error:', err.message);
  }
}

// Start polling immediately, then every 2 minutes
setTimeout(pollComments, 3000);
setInterval(pollComments, 2 * 60 * 1000);
console.log('🔄 Polling engine started — checking every 2 minutes');

// ── Start server ─────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
