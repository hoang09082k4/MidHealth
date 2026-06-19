module.exports = async function midhealthApi(request, response) {
  const { handleRequest } = await import('../src/server.js');
  return handleRequest(request, response);
};
