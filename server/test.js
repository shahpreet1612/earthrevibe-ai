const axios = require('axios');

const testComments = [
  "🔥🔥🔥",
  "😍",
  "nice",
  "this is everything",
  "Color of the tshirt looks amazing",
  "itna costly kyun hai yaar 😭"
];

async function runTest() {
  for (const comment of testComments) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('COMMENT:', comment);
    try {
      const res = await axios.post('http://localhost:3001/api/test-reply', {
        comment,
        caption: 'Earth Revibe vacation vibe collab post',
        type: 'collab'
      });
      console.log('INTENT:', res.data.intent);
      console.log('PRIORITY:', res.data.priority);
      console.log('AUTO POST:', res.data.auto_post_safe);
      res.data.replies.forEach((r, i) => {
        const star = i === res.data.best_reply_index ? ' ⭐' : '';
        console.log(`\nReply ${i+1} [${r.tone}]${star}`);
        console.log(`"${r.reply}"`);
      });
    } catch (e) {
      console.error('Error:', e.message);
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

runTest();
