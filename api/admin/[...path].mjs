import {
  deleteHealthArticleAsAdmin,
  getAdminDashboard,
  reviewProviderAsAdmin,
  saveHealthArticleAsAdmin,
  syncCatalogAccountsAsAdmin,
  updateCatalogEntityAsAdmin,
  updateUserAsAdmin,
} from '../../backend/src/admin_service.js';
import { applyCorsHeaders } from '../../backend/src/cors.js';
import { verifyIdToken } from '../../backend/src/firebase_auth.js';

function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function getAdminPath(request) {
  const value = request.query.path;
  return Array.isArray(value) ? value : String(value || '').split('/').filter(Boolean);
}

function getBearerToken(request) {
  const header = request.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

async function getFirebaseUser(request) {
  const token = getBearerToken(request);
  return token ? verifyIdToken(token) : null;
}

export default async function handler(request, response) {
  applyCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    response.status(204).end();
    return;
  }

  if (!['GET', 'POST', 'PATCH', 'DELETE'].includes(request.method)) {
    sendJson(response, 405, { message: 'Method not allowed.' });
    return;
  }

  const firebaseUser = await getFirebaseUser(request);
  if (!firebaseUser) {
    sendJson(response, 401, { message: 'Vui lòng đăng nhập bằng tài khoản admin.' });
    return;
  }

  const path = getAdminPath(request);

  try {
    if (request.method === 'GET' && path.length === 1 && path[0] === 'dashboard') {
      const result = await getAdminDashboard(firebaseUser);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
      return;
    }

    if (request.method === 'PATCH' && path.length === 2 && path[0] === 'provider-workspaces') {
      const result = await reviewProviderAsAdmin(firebaseUser, decodeURIComponent(path[1]), request.body || {});
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
      return;
    }

    if (request.method === 'PATCH' && path.length === 2 && path[0] === 'users') {
      const result = await updateUserAsAdmin(firebaseUser, decodeURIComponent(path[1]), request.body || {});
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
      return;
    }

    if (request.method === 'PATCH' && path.length === 1 && path[0] === 'catalog-entities') {
      const result = await updateCatalogEntityAsAdmin(firebaseUser, request.body || {});
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
      return;
    }

    if (request.method === 'POST' && path.length === 2 && path[0] === 'catalog-accounts' && path[1] === 'sync') {
      const result = await syncCatalogAccountsAsAdmin(firebaseUser);
      sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
      return;
    }

    if (path[0] === 'health-articles') {
      if (request.method === 'POST' && path.length === 1) {
        const result = await saveHealthArticleAsAdmin(firebaseUser, request.body || {});
        sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
        return;
      }

      if (path.length === 2) {
        const articleId = decodeURIComponent(path[1]);
        if (request.method === 'PATCH') {
          const result = await saveHealthArticleAsAdmin(firebaseUser, { ...(request.body || {}), id: articleId });
          sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
          return;
        }

        if (request.method === 'DELETE') {
          const result = await deleteHealthArticleAsAdmin(firebaseUser, articleId);
          sendJson(response, result.status, result.ok ? { data: result.data } : result.data);
          return;
        }
      }
    }

    sendJson(response, 404, { message: 'Không tìm thấy API admin.' });
  } catch (error) {
    sendJson(response, 500, { message: error.message || 'Không thể xử lý yêu cầu admin.' });
  }
}
