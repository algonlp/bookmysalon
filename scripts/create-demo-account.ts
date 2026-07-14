import { clientPlatformService } from '../src/platform/clientPlatform.service';
import { billingService } from '../src/billing/billing.service';

const DEMO_EMAIL = 'demo@bookmysalon.com';
const DEMO_PASSWORD = 'Demo@12345';
const DEMO_BUSINESS_NAME = 'Demo Salon';
const DEMO_PLAN_ID = 'plan_team_premium';

const run = async (): Promise<void> => {
  const { client, plainAdminToken } = await clientPlatformService.createClient({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    businessName: DEMO_BUSINESS_NAME,
    provider: 'email'
  });

  console.log(`Created demo account: ${client.id}`);

  const { subscription, overview } = await billingService.checkoutDemoSubscription(client.id, {
    planId: DEMO_PLAN_ID,
    cardholderName: 'Demo Account',
    cardNumber: '4242424242424242',
    expMonth: 12,
    expYear: 2030,
    cvc: '123'
  });

  console.log(`Activated plan: ${subscription.planId} (status: ${subscription.status})`);
  console.log(
    `Credits granted -> appointments: ${subscription.appointmentCreditsGranted}, messages: ${subscription.messageCreditsGranted}, marketing emails: ${subscription.marketingEmailCreditsGranted}`
  );
  console.log(`Locked features remaining: ${overview.lockedFeatureKeys.join(', ') || 'none'}`);
  console.log('\nLogin credentials:');
  console.log(`  Email: ${DEMO_EMAIL}`);
  console.log(`  Password: ${DEMO_PASSWORD}`);
  console.log(`  Admin token: ${plainAdminToken}`);
};

run().catch((error) => {
  console.error('Failed to create demo account:', error);
  process.exit(1);
});
