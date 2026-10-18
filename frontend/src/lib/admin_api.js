const STATUS_MESSAGES = Object.freeze({
  401: 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.',
  403: 'Tài khoản hiện tại không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy tài khoản hoặc API được yêu cầu.',
  409: 'Tài khoản hoặc yêu cầu hiện không đủ điều kiện để thực hiện thao tác.',
  422: 'Thông tin gửi lên chưa hợp lệ. Hãy kiểm tra lại.',
  500: 'Backend gặp lỗi khi xử lý yêu cầu. Hãy thử lại sau.',
});

export async function adminApiRequest(url, token, options = {}, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Không kết nối được máy chủ quản trị. Hãy kiểm tra backend đang chạy và tải lại trang.');
    }
    throw error;
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || STATUS_MESSAGES[response.status] || 'Không thể xử lý yêu cầu admin.');
    error.status = response.status;
    throw error;
  }
  return payload.data;
}

export function requireCompletePasswordReset(result) {
  if (!result?.email || result.sessionsRevoked !== true) {
    throw new Error('Backend chưa xác nhận Firebase đã cập nhật mật khẩu và thu hồi phiên cũ. Không thể báo reset thành công.');
  }
  return result;
}
