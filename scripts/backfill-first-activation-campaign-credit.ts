import 'dotenv/config';
import { billingRepository } from '../src/billing/billing.repository';
import { normalizeSubscriptionPlans } from '../src/billing/defaultPlans';
import { walletRepository } from '../src/wallet/wallet.repository';
import { walletService } from '../src/wallet/wallet.service';
import type { BusinessSubscription, SubscriptionPlan } from '../src/billing/billing.types';

// One-off backfill for businesses whose one-time campaign credit was never
// granted because the wallet table was missing the promotional-credit
// columns at the time they first activated a paid plan. Safe to re-run:
// grantPromotionalCredit is idempotent per business (referenceId
// 'first_activation_credit'), so anyone already credited is skipped.
const main = async (): Promise<void> => {
  const [allSubscriptions, plans] = await Promise.all([
    billingRepository.listBusinessSubscriptions(),
    (async (): Promise<SubscriptionPlan[]> => normalizeSubscriptionPlans(await billingRepository.listSubscriptionPlans()))()
  ]);

  const subscriptionsByBusinessId = new Map<string, BusinessSubscription[]>();
  for (const subscription of allSubscriptions) {
    const list = subscriptionsByBusinessId.get(subscription.businessId) ?? [];
    list.push(subscription);
    subscriptionsByBusinessId.set(subscription.businessId, list);
  }

  let granted = 0;
  let skippedAlreadyCredited = 0;
  let skippedNoPaidActivation = 0;
  let skippedNoCreditOnPlan = 0;

  for (const [businessId, subscriptions] of subscriptionsByBusinessId) {
    const paidSubscriptions = subscriptions
      .filter((subscription) => subscription.provider !== 'trial')
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

    const firstPaidSubscription = paidSubscriptions[0];

    if (!firstPaidSubscription) {
      skippedNoPaidActivation += 1;
      continue;
    }

    const plan = plans.find((entry) => entry.id === firstPaidSubscription.planId);

    if (!plan || plan.entitlements.campaignCreditCents <= 0) {
      skippedNoCreditOnPlan += 1;
      continue;
    }

    const existing = await walletRepository.findTransactionByReference(
      businessId,
      'first_activation_credit',
      'promotional_credit'
    );

    if (existing) {
      skippedAlreadyCredited += 1;
      continue;
    }

    await walletService.grantPromotionalCredit(
      businessId,
      plan.entitlements.campaignCreditCents,
      `One-time campaign credit for first paid activation (${plan.name}) [backfilled]`
    );
    granted += 1;
    console.log(`Granted Rs${(plan.entitlements.campaignCreditCents / 100).toFixed(0)} to ${businessId} (${plan.name})`);
  }

  console.log('---');
  console.log(`Granted: ${granted}`);
  console.log(`Already credited: ${skippedAlreadyCredited}`);
  console.log(`No paid activation: ${skippedNoPaidActivation}`);
  console.log(`Plan has no campaign credit: ${skippedNoCreditOnPlan}`);
};

main().catch((error) => {
  console.error('Backfill failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
