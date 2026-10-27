process.env.NODE_ENV = 'test';
for (const key of Object.keys(process.env)) {
  if (/SUPABASE|GMAIL|PAYPAL|GEMINI/.test(key)) delete process.env[key];
}
