import type {
  BillingInvoice,
  BusinessSubscription,
  SubscriptionPlan
} from '../billing.types';
import type { BillingStore } from '../billing.store';
import { SupabaseJsonbTable, toJsonValue } from '../../shared/supabase/jsonbTable';
import { defaultSubscriptionPlans } from '../defaultPlans';
import { HttpError } from '../../shared/errors/httpError';

const subscriptionPlanTable = new SupabaseJsonbTable<SubscriptionPlan>({
  tableName: 'subscription_plan_records',
  mapToRow: (plan) => ({
    id: plan.id,
    plan_key: plan.key,
    is_active: plan.isActive,
    display_order: plan.displayOrder,
    payload: toJsonValue(plan)
  })
});

const businessSubscriptionTable = new SupabaseJsonbTable<BusinessSubscription>({
  tableName: 'business_subscription_records',
  mapToRow: (subscription) => ({
    id: subscription.id,
    business_id: subscription.businessId,
    plan_id: subscription.planId,
    status: subscription.status,
    payload: toJsonValue(subscription)
  })
});

const billingInvoiceTable = new SupabaseJsonbTable<BillingInvoice>({
  tableName: 'billing_invoice_records',
  mapToRow: (invoice) => ({
    id: invoice.id,
    business_id: invoice.businessId,
    subscription_id: invoice.subscriptionId,
    status: invoice.status,
    payload: toJsonValue(invoice)
  })
});

const isMissingTableError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes('Could not find the table') ||
    (message.includes('relation') && message.includes('does not exist'))
  );
};

const missingBillingTablesError = (): HttpError =>
  new HttpError(
    503,
    'Supabase billing tables are missing. Run the billing table section from supabase/schema.sql in the Supabase SQL editor, then retry.'
  );

export class BillingSupabaseStore implements BillingStore {
  async listSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    try {
      const plans = await subscriptionPlanTable.list();
      return plans.length > 0 ? plans : defaultSubscriptionPlans;
    } catch (error) {
      if (isMissingTableError(error)) {
        return defaultSubscriptionPlans;
      }

      throw error;
    }
  }

  async listBusinessSubscriptions(): Promise<BusinessSubscription[]> {
    try {
      return await businessSubscriptionTable.list();
    } catch (error) {
      if (isMissingTableError(error)) {
        return [];
      }

      throw error;
    }
  }

  async listBillingInvoices(): Promise<BillingInvoice[]> {
    try {
      return await billingInvoiceTable.list();
    } catch (error) {
      if (isMissingTableError(error)) {
        return [];
      }

      throw error;
    }
  }

  saveBusinessSubscription(
    subscription: BusinessSubscription
  ): Promise<BusinessSubscription> {
    return businessSubscriptionTable.upsert(subscription).catch((error: unknown) => {
      if (isMissingTableError(error)) {
        throw missingBillingTablesError();
      }

      throw error;
    });
  }

  saveBillingInvoice(invoice: BillingInvoice): Promise<BillingInvoice> {
    return billingInvoiceTable.upsert(invoice).catch((error: unknown) => {
      if (isMissingTableError(error)) {
        throw missingBillingTablesError();
      }

      throw error;
    });
  }

  async reset(): Promise<void> {
    await Promise.all([
      businessSubscriptionTable.reset(),
      billingInvoiceTable.reset()
    ]);
  }
}
