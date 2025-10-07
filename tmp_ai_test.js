const key = process.env.EXPO_PUBLIC_OPENAI_API_KEY;
async function main(){
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ping' }] })
  });
  console.log('status', res.status);
  const text = await res.text();
  console.log(text);
}
main().catch(e => console.error('ERR', e));
