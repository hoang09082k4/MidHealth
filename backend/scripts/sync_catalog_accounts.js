import { syncCatalogManagedAccounts } from '../src/catalog_account_service.js';

try {
  const result = await syncCatalogManagedAccounts();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
