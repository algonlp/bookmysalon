import request from 'supertest';
import { app } from '../../src/app';
import { resetClientPlatformRepositoryForTests } from '../../src/platform/clientPlatform.repository';

const createAdminSession = async (): Promise<{ clientId: string; adminCookie: string[] }> => {
  const response = await request(app).post('/api/platform/clients').send({
    email: 'homepage-admin@example.com',
    provider: 'email'
  });

  return {
    clientId: response.body.client.id as string,
    adminCookie: response.headers['set-cookie'] ?? []
  };
};

describe('GET /', () => {
  beforeEach(async () => {
    await resetClientPlatformRepositoryForTests();
  });

  it('serves the single landing page', async () => {
    const response = await request(app).get('/');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('QR schedule.com');
    expect(response.text).toContain('Book local selfcare services');
    expect(response.text).toContain('450,904');
    expect(response.text).toContain('List your business');
    expect(response.text).toContain('href="/login"');
    expect(response.text).toContain('href="/for-businesses"');
    expect(response.text).toContain('id="service-query-dropdown"');
    expect(response.text).toContain('id="city-location-trigger"');
    expect(response.text).toContain('id="time-query" name="time" type="date"');
    expect(response.text).toContain('Showing all salons ready for booking.');
    expect(response.text).toContain('For customers');
    expect(response.text).toContain('For businesses');
  });

  it('serves the login page', async () => {
    const response = await request(app).get('/login');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Create an account or log in to manage your business.');
    expect(response.text).toContain('Fresha for professionals');
    expect(response.text).toContain('Enter your email address');
    expect(response.text).toContain('Enter your mobile number');
  });

  it('serves the business landing page', async () => {
    const response = await request(app).get('/for-businesses');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('The #1 software for Salons and Spas');
    expect(response.text).toContain('Business types');
    expect(response.text).toContain('Spa &amp; sauna');
    expect(response.text).toContain('Tattooing &amp; piercing');
    expect(response.text).toContain('Get started now');
    expect(response.text).toContain('class="business-cta primary" href="/signup"');
    expect(response.text).toContain('href="/pricing"');
  });

  it('serves the pricing page', async () => {
    const response = await request(app).get('/pricing');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Choose a plan for your business workspace');
    expect(response.text).toContain('Plans and limits are loaded from the billing API');
    expect(response.text).toContain('id="pricing-grid"');
    expect(response.text).toContain('id="pricing-checkout"');
  });

  it('serves the professional signup page', async () => {
    const response = await request(app).get('/signup');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Fresha for professionals');
    expect(response.text).toContain('Enter your email address');
    expect(response.text).toContain('Enter your mobile number');
    expect(response.text).toContain('Continue with Facebook');
    expect(response.text).toContain('Continue with Google');
    expect(response.text).toContain('Continue with Apple');
  });

  it('serves the public manage booking page', async () => {
    const response = await request(app).get('/book/demo-business/manage/demo-appointment');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Manage booking');
    expect(response.text).toContain('Live appointment timer');
    expect(response.text).toContain('id="manage-booking-countdown-heading"');
    expect(response.text).toContain('id="manage-booking-countdown-days"');
    expect(response.text).toContain('Reschedule appointment');
    expect(response.text).toContain('Cancel appointment');
  });

  it('serves the onboarding business name page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/business-name?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain("What's your business name?");
    expect(response.text).toContain('Business name');
    expect(response.text).toContain('Website');
    expect(response.text).toContain('Continue');
  });

  it('serves the legendary learner guide page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/guides/legendary-learner?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Legendary Learner');
    expect(response.text).toContain('Create your Fresha account');
    expect(response.text).toContain('Create your first appointment');
    expect(response.text).toContain('Help center');
  });

  it('serves the onboarding service types page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/service-types?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Select categories that best describe your business');
    expect(response.text).toContain('Choose every category that matches your business');
    expect(response.text).toContain('Hair salon');
    expect(response.text).toContain('Eyebrows & lashes');
    expect(response.text).toContain('Waxing salon');
  });

  it('serves the onboarding account type page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/account-type?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Select account type');
    expect(response.text).toContain("I'm an independent");
    expect(response.text).toContain('I have a team');
  });

  it('serves the onboarding service location page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/service-location?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Where do you provide your services?');
    expect(response.text).toContain('Choose every way clients can receive your services');
    expect(response.text).toContain('Clients come to me at a physical location');
    expect(response.text).toContain('I visit my clients as a mobile operator');
    expect(response.text).toContain('I provide virtual services online');
    expect(response.text).toContain('Close');
  });

  it('serves the onboarding venue location page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/venue-location?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain("Set your venue's physical location");
    expect(response.text).toContain('Enter your venue address');
    expect(response.text).toContain('Enter the exact address clients should see when they book with you.');
    expect(response.text).toContain('Live preview');
    expect(response.text).toContain('Client-facing location');
  });

  it('serves the onboarding launch links page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/launch-links?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Review your launch links');
    expect(response.text).toContain('Dashboard link');
    expect(response.text).toContain('Booking page link');
    expect(response.text).toContain('Instagram bio link');
    expect(response.text).toContain('Facebook booking link');
    expect(response.text).toContain('Apple Maps booking link');
    expect(response.text).toContain('QR code link');
    expect(response.text).toContain('Continue');
  });

  it('serves the onboarding complete page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/complete?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Your business is set up!');
    expect(response.text).toContain('Enjoy 7 days free of using Fresha for business');
    expect(response.text).toContain('Done');
    expect(response.text).toContain('<script src="/main.js"></script>');
  });

  it('serves the onboarding language page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/onboarding/language?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Select your default language');
    expect(response.text).toContain('id="preferred-language-grid"');
  });

  it('exposes preferred languages through public config', async () => {
    const response = await request(app).get('/api/public-config');

    expect(response.status).toBe(200);
    expect(response.body.preferredLanguages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ value: 'english', label: 'English' }),
        expect.objectContaining({ value: 'urdu', label: 'Urdu' }),
        expect.objectContaining({ value: 'arabic', label: 'Arabic' }),
        expect.objectContaining({ value: 'hindi', label: 'Hindi' }),
        expect.objectContaining({ value: 'spanish', label: 'Spanish' }),
        expect.objectContaining({ value: 'french', label: 'French' }),
        expect.objectContaining({ value: 'german', label: 'German' }),
        expect.objectContaining({ value: 'turkish', label: 'Turkish' }),
        expect.objectContaining({ value: 'portuguese', label: 'Portuguese' }),
        expect.objectContaining({ value: 'chinese', label: 'Chinese' })
      ])
    );
  });

  it('serves the calendar dashboard page', async () => {
    const { clientId, adminCookie } = await createAdminSession();
    const response = await request(app)
      .get(`/calendar?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('fresha');
    expect(response.text).toContain('Continue setup');
    expect(response.text).toContain('Today');
    expect(response.text).toContain('Owner');
    expect(response.text).toContain('--:--');
    expect(response.text).toContain('Book appointment');
    expect(response.text).toContain('Show QR code');
  });

  it('redirects protected admin pages to signup without a valid session', async () => {
    const response = await request(app).get('/calendar');

    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/signup');
  });

  it('serves the public booking page', async () => {
    const response = await request(app).get('/book/demo-salon');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/html');
    expect(response.text).toContain('Book your appointment');
    expect(response.text).toContain('Confirm appointment');
    expect(response.text).toContain('Phone number');
    expect(response.text).toContain('id="booking-customer-phone-country-code"');
    expect(response.text).toContain('id="booking-service-location-field"');
    expect(response.text).toContain('id="booking-customer-address-field"');
    expect(response.text).not.toContain('placeholder="+92 300 1234567"');
  });

  it('does not expose removed client preview routes', async () => {
    const response = await request(app).get('/clients/lunaluxe');

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Route not found');
  });
});
