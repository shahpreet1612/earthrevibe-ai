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
const BRAND_PROMPT = `You are the social media voice of Earth Revibe — a premium young Indian travel fashion brand. We make clothes for people who actually go places.

BRAND PERSONALITY:
Think Zomato's wit but more refined. Think someone who travels often, has great taste, and is genuinely funny — not try-hard funny. Confident, warm, occasionally sharp. Never cheap. Never desperate.

UNDERSTAND THE FULL CONTEXT:
You will receive the post caption AND the comment. Use BOTH to craft your reply.
- What is the overall vibe of the post? (travel, fashion, lifestyle, food, adventure)
- What is the person actually saying in their comment?
- What would a genuinely funny, well-traveled person reply?
- Would this reply make someone smile, screenshot it, or tag a friend?

TONE RULES — read carefully:
- Sarcasm only when it genuinely fits. Never forced. Never punching down.
- Wit over sarcasm always. A clever observation beats a sarcastic jab every time.
- Warm and human when someone is genuinely excited or emotional
- Short and punchy for hype comments — don't over-explain
- Never sound like a brand pushing a product. Sound like a person with great taste.
- Never use "vibe check", "slay", "bestie", "no cap" — overused and off-brand
- Hinglish naturally when the comment is in Hindi/Hinglish — not forced
- Under 200 characters for most replies. Under 10 words for emoji-only comments.

WHAT EARTH REVIBE SELLS:
Linen shirts, cargo pants, co-ords, tshirts, shackets — travel-ready clothes. When relevant, connect naturally to travel, trips, aesthetics, adventures. But ONLY when it feels organic — never force a product mention.

WHAT NEVER TO DO:
- Never say "check our bio" or "visit our page" or "link in bio" in a reply
- Never reply with generic phrases like "so true!", "facts!", "absolutely!"
- Never sound corporate or like a press release
- Never be mean, disrespectful about religion, race, gender, body
- Never reply to sensitive or sad comments with humour — be warm instead
- Never start with the person's name
- Never sound like you're trying too hard

EXAMPLES OF PERFECT REPLIES:
Comment: "🔥🔥🔥" → "🤝🔥" (match the energy, nothing more)
Comment: "this fit is everything" → "and it travels light too 🎒"
Comment: "where is this place?" → "wherever the wifi is weak and the views are strong 🌄"
Comment: "itna costly kyun" → "Leh ke tickets se sasta hai bhai 😭"
Comment: "I need this in my life" → "your next trip is waiting on you tbh 🌍"
Comment: "looking for brand deals" → "noticed 👀 DMs are open for people who actually go places"
Comment: "rent karoge kya 😂" → "rent nahi, sirf inspire karte hain 😤"
Comment: "My personal favourite ❤️" on a tshirt post → "the tshirt that never misses 🤙"
Comment: "Color of the tshirt looks amazing" → "hits different in actual sunlight ngl 🌅"

TASK:
Given the post caption and a comment, generate exactly 3 reply options.

Return ONLY this JSON, no extra text:
{
  "intent": "hype|question_price|question_size|question_buy|negative_price|negative_quality|sarcastic_user|love|brand_deal_hint|neutral|irrelevant",
  "priority": "urgent|high|normal|skip",
  "auto_post_safe": true or false,
  "best_reply_index": 0,
  "replies": [
    {"tone": "unexpected_wit", "reply": "", "confidence": 0, "why": ""},
    {"tone": "warm_genuine", "reply": "", "confidence": 0, "why": ""},
    {"tone": "short_punchy", "reply": "", "confidence": 0, "why": ""}
  ]
}

AUTO POST RULES:
- auto_post_safe = true ONLY for: pure emojis, single word hype, clear compliments with no question
- auto_post_safe = false for: ANY question, price mention, complaint, brand deal, anything needing thought
- When auto_post_safe is true — the reply must be SHORT and PERFECT. No human will check it.
- When in doubt — false`;

// ── Generate AI Replies ──────────────────────────────
async function generateReplies(comment, postCaption, postType, authorName, mediaUrl, mediaType) {

  const founderNames = ['Abhishek', 'Abhishek Jain', 'earthrevibe'];
  const isFounder = founderNames.some(name =>
    authorName?.toLowerCase().includes(name?.toLowerCase())
  );

  const founderContext = isFounder ? `
SPECIAL: This person is Abhishek, Earth Revibe's founder.
Make it warm and fun.` : '';

  // If we have an image URL — use vision model to describe it first
  let imageDescription = '';
  if (mediaUrl) {
    try {
      const visionRes = await groq.chat.completions.create({
        model: 'llama-3.2-90b-vision-preview',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: mediaUrl }
            },
            {
              type: 'text',
              text: 'Describe this image in 2-3 sentences focusing on: the clothing/outfit shown, the setting/location, the mood and aesthetic, and any travel vibes. Be specific and visual.'
            }
          ]
        }]
      });
      imageDescription = visionRes.choices[0].message.content;
      console.log('👁️ Image analysed:', imageDescription.substring(0, 80));
    } catch (e) {
      console.log('Vision model unavailable, using caption only');
    }
  }

  const response = await groq.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    max_tokens: 1000,
    messages: [
      { role: 'system', content: BRAND_PROMPT + founderContext },
      { role: 'user', content: `POST CONTEXT:
Caption: "${postCaption}"
Post type: ${mediaType || postType}
${imageDescription ? `Visual description of the post: "${imageDescription}"` : ''}

Use ALL this context — the caption, the image description, the overall feeling — to understand what this post is really about before crafting replies.

COMMENT TO REPLY TO: "${comment}"
Commenter: ${authorName || 'a follower'}

Generate 3 replies. Return ONLY valid JSON.` }
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

    const aiResult = await generateReplies(commentText, 'Earth Revibe collab post', 'collab', from?.name || from?.username);
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
  try {
    const records = await base('Comments').select({
      sort: [{ field: 'Timestamp', direction: 'desc' }]
    }).all();
    const limited = records.slice(0, 500);
    res.json(limited.map(r => ({ id: r.id, ...r.fields })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
    const OUR_ID = process.env.INSTAGRAM_PAGE_ID;

    console.log(`🔧 Polling with IG_ID=${igId}, OUR_ID=${OUR_ID}, token=${token?.substring(0,10)}...`);

    const mediaRes = await axios.get(
      `https://graph.facebook.com/v19.0/${igId}/media` +
      `?fields=id,caption,timestamp,permalink,media_type,media_url,thumbnail_url&limit=25&access_token=${token}`
    );

    const posts = mediaRes.data?.data || [];
    console.log(`📄 Fetched ${posts.length} posts from Instagram`);
    console.log(`🔍 Checking ${posts.length} posts for new comments...`);

    for (const post of posts) {
      console.log(`📝 Processing post ${post.id} - caption: "${post.caption?.substring(0,40)}..."`);
      const commentsRes = await axios.get(
        `https://graph.facebook.com/v19.0/${post.id}/comments` +
        `?fields=id,text,from,timestamp,replies{id,text,from,timestamp}&access_token=${token}`
      );

      const comments = commentsRes.data?.data || [];
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

      console.log(`💬 Found ${allComments.length} comments on this post (after own-filter)`);

      for (const comment of allComments) {
        console.log(`🔍 Checking comment ${comment.id} by ${comment.from?.username || comment.from?.id}: "${comment.text?.substring(0,40)}"`);

        if (processedComments.has(comment.id)) {
          console.log(`⏭️  Skipping ${comment.id} - already in processedComments cache`);
          continue;
        }
        processedComments.add(comment.id);

        // Check Airtable — skip if already processed
        const existing = await base('Comments').select({
          filterByFormula: `{CommentID} = '${comment.id}'`,
          maxRecords: 1
        }).firstPage();

        if (existing.length > 0) {
          console.log(`⏭️  Skipping ${comment.id} - already in Airtable`);
          continue;
        }

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

        console.log(`✨ NEW COMMENT - processing ${comment.id}: "${comment.text}"`);
        console.log(`💬 New comment: "${comment.text}" by ${comment.from?.name}`);

        const mediaUrl = post.media_url || post.thumbnail_url || null;
        console.log(`🤖 Calling generateReplies for ${comment.id}`);
        let aiResult;
        try {
          aiResult = await generateReplies(
            comment.text,
            post.caption || 'Earth Revibe post',
            post.media_type || 'instagram_post',
            comment.from?.name || comment.from?.username,
            mediaUrl,
            post.media_type
          );
          console.log(`✅ AI returned: intent=${aiResult.intent}, auto_post_safe=${aiResult.auto_post_safe}`);
        } catch (err) {
          console.error(`❌ generateReplies failed for ${comment.id}:`, err.message);
          continue;
        }

        try {
          await saveComment({
            commentId:   comment.id,
            commentText: comment.text,
            authorName:  comment.from?.name || comment.from?.username || 'Instagram User',
            postCaption: post.caption || 'Earth Revibe post',
            postType:    'instagram_post',
            aiResult
          });
          console.log(`💾 Saved ${comment.id} to Airtable`);
        } catch (err) {
          console.error(`❌ saveComment failed for ${comment.id}:`, err.message);
          continue;
        }

        if (aiResult.auto_post_safe) {
          const best = aiResult.replies[aiResult.best_reply_index].reply;
          try {
            await postReply(comment.id, best);
            console.log(`✅ Auto-posted: "${best}"`);
          } catch (err) {
            console.error(`❌ postReply failed for ${comment.id}:`, err.message);
            console.error('   ↳ Full error:', JSON.stringify(err.response?.data, null, 2));
          }
        } else {
          console.log(`📋 Queued for approval — intent: ${aiResult.intent}`);
        }

        await new Promise(r => setTimeout(r, 3000));
      }
    }
  } catch (err) {
    console.error('❌ Poll error:', err.message);
    console.error('   ↳ Full error:', JSON.stringify(err.response?.data, null, 2));
  }
}

// Start polling immediately, then every 2 minutes
setTimeout(pollComments, 3000);
setInterval(pollComments, 2 * 60 * 1000);
console.log('🔄 Polling engine started — checking every 2 minutes');
console.log(`🆔 OUR_ID configured as: ${process.env.INSTAGRAM_PAGE_ID}`);

// Keep-alive — prevents Render free tier from sleeping
const RENDER_URL = 'https://earthrevibe-ai.onrender.com';
setInterval(async () => {
  try {
    await axios.get(`${RENDER_URL}/api/comments?limit=1`);
    console.log('💓 Keep-alive ping');
  } catch (e) {
    // silent
  }
}, 4 * 60 * 1000);

// Auto-refresh token every 50 days
async function refreshToken() {
  try {
    const current = process.env.INSTAGRAM_ACCESS_TOKEN;
    const url = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${process.env.FB_APP_ID}&client_secret=${process.env.FB_APP_SECRET}&fb_exchange_token=${current}`;
    const res = await axios.get(url);
    process.env.INSTAGRAM_ACCESS_TOKEN = res.data.access_token;
    console.log('🔄 Token auto-refreshed successfully');
  } catch (e) {
    console.error('Token refresh failed:', e.message);
  }
}

// Refresh every 24 hours, check if token is older than 45 days
setInterval(refreshToken, 24 * 60 * 60 * 1000);

// ── Start server ─────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`🚀 Server live on port ${PORT}`));
