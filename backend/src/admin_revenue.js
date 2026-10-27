export async function sumPaidRevenuePages(fetchPage, pageSize = 500) {
  let total = 0;
  let lastId = null;
  for (;;) {
    const rows = await fetchPage(lastId, pageSize);
    for (const payment of rows) total += Number(payment.amount || 0);
    if (rows.length < pageSize) return total;
    lastId = rows[rows.length - 1].id;
  }
}
