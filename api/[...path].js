module.exports = async function midhealthApi(request, response) {
  const { handleRequest } = await import('../backend/src/server.js');
  return handleRequest(request, response);
};
