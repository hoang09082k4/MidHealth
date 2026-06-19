try {
  require.resolve('@supabase/supabase-js');
  require.resolve('nodemailer');
} catch {
  // These calls are build-time hints for Vercel's file tracer.
}

module.exports = async function midhealthApi(request, response) {
  const { handleRequest } = await import('../backend/src/server.js');
  return handleRequest(request, response);
};
