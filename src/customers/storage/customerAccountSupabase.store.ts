import type { CustomerAccount } from '../customerAccount.types';
import type { CustomerAccountStore } from '../customerAccount.store';
import { getSupabaseClient } from '../../shared/supabase/client';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';

const customerAccountTable = new SupabaseJsonbTable<CustomerAccount>({
  tableName: 'customer_account_records',
  mapToRow: (customer) => ({
    id: customer.id,
    phone: customer.phone,
    email: customer.email,
    email_lower: customer.email.toLowerCase(),
    session_token: customer.sessionToken,
    payload: toJsonValue(customer)
  })
});

const getCustomerByColumnEq = async (
  column: string,
  value: string
): Promise<CustomerAccount | undefined> => {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('customer_account_records')
    .select('payload')
    .eq(column, value)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read customer_account_records by ${column}: ${error.message}`);
  }

  return data?.payload as CustomerAccount | undefined;
};

export class CustomerAccountSupabaseStore implements CustomerAccountStore {
  listCustomers(): Promise<CustomerAccount[]> {
    return customerAccountTable.list();
  }

  getCustomerById(customerId: string): Promise<CustomerAccount | undefined> {
    return customerAccountTable.getById(customerId);
  }

  getCustomerByPhone(phone: string): Promise<CustomerAccount | undefined> {
    return getCustomerByColumnEq('phone', phone);
  }

  getCustomerByEmail(email: string): Promise<CustomerAccount | undefined> {
    return getCustomerByColumnEq('email_lower', email.toLowerCase());
  }

  getCustomerBySessionToken(sessionToken: string): Promise<CustomerAccount | undefined> {
    if (!sessionToken) {
      return Promise.resolve(undefined);
    }

    return getCustomerByColumnEq('session_token', sessionToken);
  }

  saveCustomer(customer: CustomerAccount): Promise<CustomerAccount> {
    return customerAccountTable.upsert(customer);
  }

  reset(): Promise<void> {
    return customerAccountTable.reset();
  }
}
