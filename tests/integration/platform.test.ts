import request from 'supertest';
import { vi } from 'vitest';
import { app } from '../../src/app';
import { appointmentRepository } from '../../src/appointments/appointment.repository';
import { resetAppointmentRepositoryForTests } from '../../src/appointments/appointment.repository';
import { resetClientPlatformRepositoryForTests } from '../../src/platform/clientPlatform.repository';

describe('Client platform API', () => {
  const uploadedProfileImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
  const largeUploadedProfileImage = `data:image/png;base64,${'a'.repeat(180000)}`;
  const completedReviewAppointmentId = '11111111-1111-4111-8111-111111111111';

  beforeEach(async () => {
    vi.useRealTimers();
    await resetClientPlatformRepositoryForTests();
    await resetAppointmentRepositoryForTests();
  });

  it('sets an admin session cookie for the whole app and accepts it on protected routes', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'cookie-admin@example.com',
      provider: 'email'
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.headers['set-cookie']).toEqual(
      expect.arrayContaining([expect.stringContaining('Path=/')])
    );

    const clientId = createResponse.body.client.id as string;
    const adminCookie = createResponse.headers['set-cookie'] ?? [];

    const authorizedPageResponse = await request(app)
      .get(`/calendar?clientId=${clientId}`)
      .set('Cookie', adminCookie);

    expect(authorizedPageResponse.status).toBe(200);

    const authorizedApiResponse = await request(app)
      .get(`/api/platform/clients/${clientId}`)
      .set('Cookie', adminCookie);

    expect(authorizedApiResponse.status).toBe(200);
  });

  it('creates a client, saves onboarding data, and serves a dashboard payload', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'owner@example.com',
      provider: 'email'
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.client.email).toBe('owner@example.com');

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const businessProfileResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Maqsood Studio',
        website: 'www.maqsoodstudio.com',
        profileImageUrl: uploadedProfileImage
      });

    expect(businessProfileResponse.status).toBe(200);
    expect(businessProfileResponse.body.client.businessName).toBe('Maqsood Studio');

    const serviceTypesResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Hair salon', 'Barber']
      });

    expect(serviceTypesResponse.status).toBe(200);
    expect(serviceTypesResponse.body.client.serviceTypes).toEqual(['Hair salon', 'Barber']);

    const addBarberResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/team-members`)
      .set('x-admin-token', adminToken)
      .send({
        name: 'Asad',
        phone: '+923001234560',
        expertise: 'Fade specialist'
      });

    expect(addBarberResponse.status).toBe(201);
    expect(addBarberResponse.body.client.teamMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Asad',
          role: 'Barber',
          phone: '+923001234560',
          expertise: 'Fade specialist'
        })
      ])
    );

    const addServiceResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/services`)
      .set('x-admin-token', adminToken)
      .send({
        name: 'Kids haircut',
        categoryName: 'Barber',
        durationMinutes: 30,
        priceLabel: 'PKR 900',
        description: 'Quick haircut for younger clients.'
      });

    expect(addServiceResponse.status).toBe(201);
    expect(addServiceResponse.body.client.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Kids haircut',
          categoryName: 'Barber',
          durationMinutes: 30,
          priceLabel: 'PKR 900'
        })
      ])
    );

    const accountTypeResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/account-type`)
      .set('x-admin-token', adminToken)
      .send({
        accountType: 'team'
      });

    expect(accountTypeResponse.status).toBe(200);
    expect(accountTypeResponse.body.client.accountType).toBe('team');

    const serviceLocationResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/service-location`)
      .set('x-admin-token', adminToken)
      .send({
        serviceLocation: ['physical', 'mobile', 'virtual']
      });

    expect(serviceLocationResponse.status).toBe(200);
    expect(serviceLocationResponse.body.client.serviceLocation).toEqual([
      'physical',
      'mobile',
      'virtual'
    ]);

    const venueLocationResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/venue-location`)
      .set('x-admin-token', adminToken)
      .send({
        venueAddress: 'MM Alam Road, Gulberg III, Lahore, Punjab, Pakistan'
      });

    expect(venueLocationResponse.status).toBe(200);
    expect(venueLocationResponse.body.client.venueAddress).toContain('MM Alam Road');

    const preferredLanguageResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/preferred-language`)
      .set('x-admin-token', adminToken)
      .send({
        preferredLanguage: 'urdu'
      });

    expect(preferredLanguageResponse.status).toBe(200);
    expect(preferredLanguageResponse.body.client.preferredLanguage).toBe('urdu');

    const completeResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/complete`)
      .set('x-admin-token', adminToken);

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.client.onboardingCompleted).toBe(true);

    const clientResponse = await request(app)
      .get(`/api/platform/clients/${clientId}`)
      .set('x-admin-token', adminToken);

    expect(clientResponse.status).toBe(200);
    expect(clientResponse.body.client.website).toBe('www.maqsoodstudio.com');
    expect(clientResponse.body.client.profileImageUrl).toBe(uploadedProfileImage);
    expect(clientResponse.body.client.preferredLanguage).toBe('urdu');

    const dashboardResponse = await request(app).get(
      `/api/platform/clients/${clientId}/dashboard`
    ).set('x-admin-token', adminToken);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.dashboard.businessName).toBe('Maqsood Studio');
    expect(dashboardResponse.body.dashboard.ownerName).toBe('Maqsood Studio');
    expect(dashboardResponse.body.dashboard.profileImageUrl).toBe(uploadedProfileImage);
    expect(dashboardResponse.body.dashboard.setupButtonLabel).toBe('Setup complete');
    expect(dashboardResponse.body.dashboard.setupButtonPath).toBe('/guides/legendary-learner');
    expect(dashboardResponse.body.dashboard.currentDateLabel).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
    expect(dashboardResponse.body.dashboard.currentTimeLabel).toMatch(/^\d{2}:\d{2}$/);
    expect(dashboardResponse.body.dashboard.sideDrawers.sales.title).toBe('Sales');
    expect(dashboardResponse.body.dashboard.sideDrawers.sales.sections[0].items).toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'Daily sales summary' })])
    );
    expect(dashboardResponse.body.dashboard.sideDrawers.clients.title).toBe('Clients');
    expect(dashboardResponse.body.dashboard.sideDrawers.catalog.sections[1].title).toBe(
      'Inventory'
    );
    expect(dashboardResponse.body.dashboard.sideDrawers.team.sections[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: 'Timesheets', meta: { type: 'dot' } }),
        expect.objectContaining({
          label: 'Team members',
          subtitle: expect.stringContaining('1 active barber')
        })
      ])
    );
    expect(dashboardResponse.body.dashboard.sideDrawers.team.sections[1].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Asad',
          subtitle: expect.stringContaining('Fade specialist')
        })
      ])
    );
    expect(dashboardResponse.body.dashboard.reportsView.pageTitle).toBe(
      'Reporting and analytics'
    );
    expect(dashboardResponse.body.dashboard.reportsView.menu[0]).toEqual(
      expect.objectContaining({ label: 'All reports', active: true })
    );
    expect(dashboardResponse.body.dashboard.reportsView.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ title: 'Performance dashboard' })
      ])
    );

    const dashboardLaunchLinks = dashboardResponse.body.dashboard.launchLinks;
    expect(new URL(dashboardLaunchLinks.dashboardLink).pathname).toBe('/calendar');
    expect(new URL(dashboardLaunchLinks.dashboardLink).searchParams.get('clientId')).toBe(clientId);
    expect(new URL(dashboardLaunchLinks.bookingPageLink).pathname).toBe(`/book/${clientId}`);
    expect(new URL(dashboardLaunchLinks.bookingPageLink).searchParams.get('source')).toBeNull();
    expect(new URL(dashboardLaunchLinks.instagramBookingLink).searchParams.get('source')).toBe(
      'instagram'
    );
    expect(new URL(dashboardLaunchLinks.facebookBookingLink).searchParams.get('source')).toBe(
      'facebook'
    );
    expect(new URL(dashboardLaunchLinks.appleMapsBookingLink).searchParams.get('source')).toBe(
      'applemaps'
    );
    expect(new URL(dashboardLaunchLinks.qrBookingPageLink).searchParams.get('source')).toBe(
      'qr'
    );
    expect(new URL(dashboardLaunchLinks.qrCodeImageLink).pathname).toBe(
      `/api/public/book/${clientId}/qr`
    );

    const launchLinksResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/launch-links`)
      .set('x-admin-token', adminToken);

    expect(launchLinksResponse.status).toBe(200);
    const launchLinksPayload = launchLinksResponse.body.launchLinks;
    expect(new URL(launchLinksPayload.dashboardLink).pathname).toBe(
      new URL(dashboardLaunchLinks.dashboardLink).pathname
    );
    expect(new URL(launchLinksPayload.dashboardLink).search).toBe(
      new URL(dashboardLaunchLinks.dashboardLink).search
    );
    expect(new URL(launchLinksPayload.bookingPageLink).pathname).toBe(
      new URL(dashboardLaunchLinks.bookingPageLink).pathname
    );
    expect(new URL(launchLinksPayload.instagramBookingLink).search).toBe(
      new URL(dashboardLaunchLinks.instagramBookingLink).search
    );
    expect(new URL(launchLinksPayload.facebookBookingLink).search).toBe(
      new URL(dashboardLaunchLinks.facebookBookingLink).search
    );
    expect(new URL(launchLinksPayload.appleMapsBookingLink).search).toBe(
      new URL(dashboardLaunchLinks.appleMapsBookingLink).search
    );
    expect(new URL(launchLinksPayload.qrBookingPageLink).search).toBe(
      new URL(dashboardLaunchLinks.qrBookingPageLink).search
    );
    expect(new URL(launchLinksPayload.qrCodeImageLink).pathname).toBe(
      new URL(dashboardLaunchLinks.qrCodeImageLink).pathname
    );
  });

  it('updates business settings and uses them for slots, reports, and service templates', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'settings@example.com',
      provider: 'email'
    });

    expect(createResponse.status).toBe(201);

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const businessSettingsResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/business-settings`)
      .set('x-admin-token', adminToken)
      .send({
        currencyCode: 'usd',
        currencyLocale: 'en-US',
        slotTimes: ['08:30', '09:30'],
        useServiceTemplates: false,
        reportMetadata: {
          pageTitle: 'Business analytics hub',
          pageSubtitle: 'Track bookings, finance, and client momentum.'
        }
      });

    expect(businessSettingsResponse.status).toBe(200);
    expect(businessSettingsResponse.body.client.businessSettings).toEqual(
      expect.objectContaining({
        currencyCode: 'USD',
        currencyLocale: 'en-US',
        slotTimes: ['08:30', '09:30'],
        useServiceTemplates: false,
        reportMetadata: {
          pageTitle: 'Business analytics hub',
          pageSubtitle: 'Track bookings, finance, and client momentum.'
        }
      })
    );

    const serviceTypesResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    expect(serviceTypesResponse.status).toBe(200);
    expect(serviceTypesResponse.body.client.services).toEqual([]);

    const dashboardResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/dashboard`)
      .set('x-admin-token', adminToken);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.dashboard.reportsView.pageTitle).toBe('Business analytics hub');
    expect(dashboardResponse.body.dashboard.reportsView.pageSubtitle).toBe(
      'Track bookings, finance, and client momentum.'
    );

    const slotsResponse = await request(app).get(
      `/api/public/book/${clientId}/slots?date=2026-04-10`
    );

    expect(slotsResponse.status).toBe(200);
    expect(slotsResponse.body.slots).toEqual(['08:30', '09:30']);
  });

  it('creates a client with a mobile number for professional signup', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      mobileNumber: '+923001234567',
      provider: 'email'
    });

    expect(createResponse.status).toBe(201);
    expect(createResponse.body.client.mobileNumber).toBe('+923001234567');
    expect(createResponse.body.client.email).toContain('@platform.local');
  });

  it('accepts larger uploaded profile images from pc file selection', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'upload@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const businessProfileResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Upload Studio',
        website: 'upload.example',
        profileImageUrl: largeUploadedProfileImage
      });

    expect(businessProfileResponse.status).toBe(200);
    expect(businessProfileResponse.body.client.profileImageUrl).toBe(largeUploadedProfileImage);
  });

  it('validates service types payloads', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      provider: 'google'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    const invalidResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: []
      });

    expect(invalidResponse.status).toBe(400);
    expect(invalidResponse.body.error).toBeDefined();
  });

  it('accepts saving all selected service categories', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      provider: 'google'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;
    const allServiceTypes = [
      'Hair salon',
      'Nails',
      'Eyebrows & lashes',
      'Beauty salon',
      'Medspa',
      'Barber',
      'Massage',
      'Spa & sauna',
      'Waxing salon'
    ];

    const response = await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: allServiceTypes
      });

    expect(response.status).toBe(200);
    expect(response.body.client.serviceTypes).toEqual(allServiceTypes);
  });

  it('lets an admin edit and remove a saved team member without hardcoded barber data', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'team-admin@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Team House',
        website: 'teamhouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    const addTeamMemberResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/team-members`)
      .set('x-admin-token', adminToken)
      .send({
        name: 'Sameer',
        role: 'Junior Barber',
        phone: '+923001010101',
        expertise: 'Skin fades'
      });

    expect(addTeamMemberResponse.status).toBe(201);
    expect(addTeamMemberResponse.body.client.teamMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Sameer',
          role: 'Junior Barber',
          phone: '+923001010101',
          expertise: 'Skin fades',
          isActive: true
        })
      ])
    );

    const teamMemberId = addTeamMemberResponse.body.client.teamMembers[0].id as string;

    const updateTeamMemberResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/team-members/${teamMemberId}`)
      .set('x-admin-token', adminToken)
      .send({
        name: 'Sameer Khan',
        role: 'Lead Barber',
        phone: '+923001010109',
        expertise: 'Beard shaping'
      });

    expect(updateTeamMemberResponse.status).toBe(200);
    expect(updateTeamMemberResponse.body.client.teamMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: teamMemberId,
          name: 'Sameer Khan',
          role: 'Lead Barber',
          phone: '+923001010109',
          expertise: 'Beard shaping',
          isActive: true
        })
      ])
    );

    const removeTeamMemberResponse = await request(app)
      .delete(`/api/platform/clients/${clientId}/team-members/${teamMemberId}`)
      .set('x-admin-token', adminToken);

    expect(removeTeamMemberResponse.status).toBe(200);
    expect(removeTeamMemberResponse.body.client.teamMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: teamMemberId,
          name: 'Sameer Khan',
          role: 'Lead Barber',
          isActive: false
        })
      ])
    );

    const dashboardResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/dashboard`)
      .set('x-admin-token', adminToken);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.dashboard.sideDrawers.team.sections[0].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Team members',
          subtitle: expect.stringContaining('0 active barbers')
        })
      ])
    );
    expect(dashboardResponse.body.dashboard.sideDrawers.team.sections[1].items).toEqual([
      expect.objectContaining({
        label: 'No team members yet',
        subtitle: 'Add your first barber from the team panel.'
      })
    ]);
  });

  it('lets an admin edit a booked appointment from the platform routes', async () => {
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDateValue = `${bookingDate.getFullYear()}-${String(
      bookingDate.getMonth() + 1
    ).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'appointments-admin@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Appointments House',
        website: 'appointmentshouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    const bookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        customerName: 'Umair',
        customerPhone: '+923002220000',
        source: 'direct'
      });

    expect(bookingResponse.status).toBe(201);

    const appointmentId = bookingResponse.body.appointment.id as string;

    const updateResponse = await request(app)
      .patch(`/api/platform/clients/${clientId}/appointments/${appointmentId}`)
      .set('x-admin-token', adminToken)
      .send({
        appointmentDate: bookingDateValue,
        appointmentTime: '10:00'
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.appointment).toEqual(
      expect.objectContaining({
        id: appointmentId,
        appointmentDate: bookingDateValue,
        appointmentTime: '10:00',
        status: 'booked'
      })
    );

    const appointmentsResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/appointments`)
      .set('x-admin-token', adminToken);

    expect(appointmentsResponse.status).toBe(200);
    expect(appointmentsResponse.body.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: appointmentId,
          appointmentTime: '10:00'
        })
      ])
    );

    const cancelResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/appointments/${appointmentId}/cancel`)
      .set('x-admin-token', adminToken)
      .send({});

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.appointment).toEqual(
      expect.objectContaining({
        id: appointmentId,
        status: 'cancelled'
      })
    );
  });

  it('lets an admin send a running-late sms and manually complete a booked appointment', async () => {
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDateValue = `${bookingDate.getFullYear()}-${String(
      bookingDate.getMonth() + 1
    ).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'ops-admin@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Ops House',
        website: 'opshouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    const bookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        customerName: 'Hamza',
        customerPhone: '+923003330000',
        source: 'direct'
      });

    expect(bookingResponse.status).toBe(201);

    const appointmentId = bookingResponse.body.appointment.id as string;

    const runningLateResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/appointments/${appointmentId}/running-late`)
      .set('x-admin-token', adminToken)
      .send({
        delayMinutes: 15,
        note: 'Traffic is heavier than expected'
      });

    expect(runningLateResponse.status).toBe(200);
    expect(runningLateResponse.body.appointment).toEqual(
      expect.objectContaining({
        id: appointmentId,
        status: 'booked'
      })
    );
    expect(runningLateResponse.body.notifications).toEqual([
      expect.objectContaining({ recipient: 'customer', status: 'skipped' })
    ]);

    const completeResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/appointments/${appointmentId}/complete`)
      .set('x-admin-token', adminToken)
      .send({});

    expect(completeResponse.status).toBe(200);
    expect(completeResponse.body.appointment).toEqual(
      expect.objectContaining({
        id: appointmentId,
        status: 'completed'
      })
    );

    const appointmentsResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/appointments`)
      .set('x-admin-token', adminToken);

    expect(appointmentsResponse.status).toBe(200);
    expect(appointmentsResponse.body.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: appointmentId,
          status: 'completed'
        })
      ])
    );

    const dashboardResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/dashboard`)
      .set('x-admin-token', adminToken);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.client.customerProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerName: 'Hamza',
          totalVisits: 1,
          completedVisits: 1
        })
      ])
    );
    expect(dashboardResponse.body.dashboard.sideDrawers.clients.sections[1].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Hamza'
        })
      ])
    );
  });

  it('records payments against appointment balances and returns a real finance snapshot', async () => {
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDateValue = `${bookingDate.getFullYear()}-${String(
      bookingDate.getMonth() + 1
    ).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'finance-admin@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Finance House',
        website: 'financehouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    const bookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        customerName: 'Bilal',
        customerPhone: '+923004440000',
        source: 'direct'
      });

    expect(bookingResponse.status).toBe(201);
    const appointmentId = bookingResponse.body.appointment.id as string;

    const initialPaymentsResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/payments`)
      .set('x-admin-token', adminToken);

    expect(initialPaymentsResponse.status).toBe(200);
    expect(initialPaymentsResponse.body.summary.recordedPaymentsCount).toBe(0);
    expect(initialPaymentsResponse.body.summary.collectedAmountValue).toBe(0);

    const initialBalance = initialPaymentsResponse.body.balances.find(
      (entry: { appointmentId: string }) => entry.appointmentId === appointmentId
    ) as {
      appointmentId: string;
      currencyCode: string;
      expectedAmountValue: number;
      outstandingAmountValue: number;
    };

    expect(initialBalance.expectedAmountValue).toBeGreaterThan(0);
    expect(initialBalance.outstandingAmountValue).toBe(initialBalance.expectedAmountValue);

    const paymentAmount = Math.max(1, Math.floor(initialBalance.expectedAmountValue / 2));

    const createPaymentResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/appointments/${appointmentId}/payments`)
      .set('x-admin-token', adminToken)
      .send({
        amountValue: paymentAmount,
        method: 'cash',
        note: 'Front desk payment'
      });

    expect(createPaymentResponse.status).toBe(201);
    expect(createPaymentResponse.body.payment).toEqual(
      expect.objectContaining({
        appointmentId,
        amountValue: paymentAmount,
        method: 'cash',
        status: 'posted',
        note: 'Front desk payment'
      })
    );
    expect(createPaymentResponse.body.balance).toEqual(
      expect.objectContaining({
        appointmentId,
        paidAmountValue: paymentAmount,
        outstandingAmountValue: initialBalance.expectedAmountValue - paymentAmount
      })
    );

    const finalPaymentsResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/payments`)
      .set('x-admin-token', adminToken);

    expect(finalPaymentsResponse.status).toBe(200);
    expect(finalPaymentsResponse.body.summary).toEqual(
      expect.objectContaining({
        currencyCode: initialBalance.currencyCode,
        expectedAmountValue: initialBalance.expectedAmountValue,
        collectedAmountValue: paymentAmount,
        pendingAmountValue: initialBalance.expectedAmountValue - paymentAmount,
        recordedPaymentsCount: 1,
        outstandingAppointmentsCount: 1
      })
    );
    expect(finalPaymentsResponse.body.payments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          appointmentId,
          amountValue: paymentAmount,
          method: 'cash'
        })
      ])
    );

    const appointmentsResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/appointments`)
      .set('x-admin-token', adminToken);

    expect(appointmentsResponse.status).toBe(200);
    expect(appointmentsResponse.body.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: appointmentId,
          serviceAmountValue: initialBalance.expectedAmountValue,
          currencyCode: initialBalance.currencyCode
        })
      ])
    );
  });

  it('creates a QR booking appointment, exposes it on the dashboard, and skips sms in tests', async () => {
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDateValue = `${bookingDate.getFullYear()}-${String(
      bookingDate.getMonth() + 1
    ).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'salon@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Trim House',
        website: 'trimhouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber', 'Hair salon']
      });

    const addBarberResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/team-members`)
      .set('x-admin-token', adminToken)
      .send({
        name: 'Asad',
        phone: '+923001234560',
        expertise: 'Fade specialist'
      });

    await request(app)
      .post(`/api/platform/clients/${clientId}/complete`)
      .set('x-admin-token', adminToken);

    const bookingPageResponse = await request(app).get(`/api/public/book/${clientId}`);

    expect(bookingPageResponse.status).toBe(200);
    expect(bookingPageResponse.body.businessName).toBe('Trim House');
    expect(bookingPageResponse.body.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'Haircut',
          priceLabel: expect.stringMatching(/1,200/)
        })
      ])
    );
    expect(bookingPageResponse.body.teamMembers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: addBarberResponse.body.client.teamMembers[0].id,
          name: 'Asad',
          role: 'Barber'
        })
      ])
    );

    const publicSalonsResponse = await request(app).get('/api/public/salons');

    expect(publicSalonsResponse.status).toBe(200);
    expect(publicSalonsResponse.body.salons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          clientId,
          businessName: 'Trim House',
          bookingLink: `/book/${clientId}`
        })
      ])
    );

    const slotsResponse = await request(app).get(
      `/api/public/book/${clientId}/slots?date=${bookingDateValue}`
    );

    expect(slotsResponse.status).toBe(200);
    expect(slotsResponse.body.slots).toContain('09:00');

    const qrResponse = await request(app).get(`/api/public/book/${clientId}/qr`);

    expect(qrResponse.status).toBe(200);
    expect(qrResponse.headers['content-type']).toContain('image/svg+xml');
    expect(String(qrResponse.body)).toContain('<svg');

    const bookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        teamMemberId: addBarberResponse.body.client.teamMembers[0].id,
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        customerName: 'Ali Khan',
        customerPhone: '+923001234567',
        customerEmail: 'ali@example.com'
      });

    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.appointment.customerName).toBe('Ali Khan');
    expect(bookingResponse.body.appointment.teamMemberName).toBe('Asad');
    expect(bookingResponse.body.notifications).toEqual([
      expect.objectContaining({ recipient: 'customer', status: 'skipped' })
    ]);

    const appointmentId = bookingResponse.body.appointment.id as string;
    const publicAccessToken = bookingResponse.body.publicAccessToken as string;

    const manageResponse = await request(app).get(
      `/api/public/book/${clientId}/appointments/${appointmentId}?accessToken=${encodeURIComponent(publicAccessToken)}`
    );

    expect(manageResponse.status).toBe(200);
    expect(manageResponse.body.appointment).toEqual(
      expect.objectContaining({
        id: appointmentId,
        serviceName: 'Haircut',
        appointmentTime: '09:00',
        status: 'booked'
      })
    );

    const rescheduleResponse = await request(app)
      .patch(`/api/public/book/${clientId}/appointments/${appointmentId}/reschedule`)
      .send({
        accessToken: publicAccessToken,
        appointmentDate: bookingDateValue,
        appointmentTime: '10:00'
      });

    expect(rescheduleResponse.status).toBe(200);
    expect(rescheduleResponse.body.appointment.appointmentTime).toBe('10:00');
    expect(rescheduleResponse.body.notifications).toEqual([
      expect.objectContaining({ recipient: 'customer', status: 'skipped' })
    ]);

    const duplicateSlotResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        teamMemberId: addBarberResponse.body.client.teamMembers[0].id,
        appointmentDate: bookingDateValue,
        appointmentTime: '10:00',
        customerName: 'Sara',
        customerPhone: '+923001234568'
      });

    expect(duplicateSlotResponse.status).toBe(409);
    expect(duplicateSlotResponse.body.error).toBe(
      'Selected appointment time is no longer available'
    );

    const cancelResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments/${appointmentId}/cancel`)
      .send({ accessToken: publicAccessToken });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.appointment.status).toBe('cancelled');

    const bookingHistoryResponse = await request(app).get(
      `/api/public/book/${clientId}/history?phone=%2B923001234567`
    );

    expect(bookingHistoryResponse.status).toBe(200);
    expect(bookingHistoryResponse.body.history).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          reference: bookingResponse.body.appointment.id.slice(0, 8),
          serviceName: 'Haircut',
          appointmentDate: bookingDateValue,
          appointmentTime: '10:00',
          status: 'cancelled',
          customerName: 'Ali Khan',
          customerEmail: 'ali@example.com'
        })
      ])
    );

    const missingHistoryResponse = await request(app).get(
      `/api/public/book/${clientId}/history?phone=%2B923000000000`
    );

    expect(missingHistoryResponse.status).toBe(200);
    expect(missingHistoryResponse.body.history).toEqual([]);

    const dashboardResponse = await request(app).get(
      `/api/platform/clients/${clientId}/dashboard`
    ).set('x-admin-token', adminToken);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.dashboard.bookingLink).toBe(`/book/${clientId}`);
    expect(dashboardResponse.body.dashboard.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerName: 'Ali Khan',
          serviceName: 'Haircut',
          teamMemberName: 'Asad',
          appointmentTime: '10:00',
          status: 'cancelled',
          source: 'qr'
        })
      ])
    );
    expect(dashboardResponse.body.dashboard.sideDrawers.clients.sections[1].items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Ali Khan',
          subtitle: expect.stringContaining('+923001234567')
        })
      ])
    );

    const appointmentsResponse = await request(app).get(
      `/api/platform/clients/${clientId}/appointments`
    ).set('x-admin-token', adminToken);

    expect(appointmentsResponse.status).toBe(200);
    expect(appointmentsResponse.body.appointments).toHaveLength(1);

    const forbiddenDashboardResponse = await request(app).get(
      `/api/platform/clients/${clientId}/dashboard`
    );

    expect(forbiddenDashboardResponse.status).toBe(403);
  });

  it('tracks social booking sources on appointments created from channel links', async () => {
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDateValue = `${bookingDate.getFullYear()}-${String(
      bookingDate.getMonth() + 1
    ).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'channels@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Channel House',
        website: 'channelhouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    const bookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        customerName: 'Imran',
        customerPhone: '+923001111111',
        source: 'instagram'
      });

    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.appointment.source).toBe('instagram');

    const dashboardResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/dashboard`)
      .set('x-admin-token', adminToken);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.dashboard.appointments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerName: 'Imran',
          source: 'instagram'
        })
      ])
    );
  });

  it('supports package sales and loyalty rewards through the booking flow', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 11, 8, 0, 0));

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'commerce@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Commerce House',
        website: 'commercehouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    const createPackageResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/packages`)
      .set('x-admin-token', adminToken)
      .send({
        name: 'Haircut Duo',
        includedServiceIds: ['barber-haircut'],
        totalUses: 2,
        priceLabel: 'PKR 2,000'
      });

    expect(createPackageResponse.status).toBe(201);
    expect(createPackageResponse.body.client.packagePlans).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Haircut Duo' })])
    );

    const loyaltyResponse = await request(app)
      .put(`/api/platform/clients/${clientId}/loyalty-program`)
      .set('x-admin-token', adminToken)
      .send({
        isEnabled: true,
        triggerCompletedVisits: 1,
        rewardValue: 15,
        includedServiceIds: ['barber-haircut']
      });

    expect(loyaltyResponse.status).toBe(200);
    expect(loyaltyResponse.body.client.loyaltyProgram).toEqual(
      expect.objectContaining({
        isEnabled: true,
        triggerCompletedVisits: 1,
        rewardValue: 15
      })
    );

    const soldPackageResponse = await request(app)
      .post(`/api/platform/clients/${clientId}/package-sales`)
      .set('x-admin-token', adminToken)
      .send({
        packagePlanId: createPackageResponse.body.client.packagePlans[0].id,
        customerName: 'Sara',
        customerPhone: '+923001555555',
        customerEmail: 'sara@example.com'
      });

    expect(soldPackageResponse.status).toBe(201);
    expect(soldPackageResponse.body.packagePurchase.remainingUses).toBe(2);

    const initialBenefitsResponse = await request(app).get(
      `/api/public/book/${clientId}/benefits?phone=%2B923001555555`
    );

    expect(initialBenefitsResponse.status).toBe(200);
    expect(initialBenefitsResponse.body.benefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'package',
          title: 'Haircut Duo'
        })
      ])
    );

    const bookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: '2026-03-11',
        appointmentTime: '09:00',
        customerName: 'Sara',
        customerPhone: '+923001555555',
        customerEmail: 'sara@example.com',
        packagePurchaseId: soldPackageResponse.body.packagePurchase.id,
        source: 'direct'
      });

    expect(bookingResponse.status).toBe(201);
    expect(bookingResponse.body.appointment.packageName).toBe('Haircut Duo');

    vi.setSystemTime(new Date(2026, 2, 11, 10, 30, 0));

    const appointmentsResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/appointments`)
      .set('x-admin-token', adminToken);

    expect(appointmentsResponse.status).toBe(200);
    expect(appointmentsResponse.body.appointments).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'completed' })])
    );

    const postCompletionBenefitsResponse = await request(app).get(
      `/api/public/book/${clientId}/benefits?phone=%2B923001555555`
    );

    expect(postCompletionBenefitsResponse.status).toBe(200);
    expect(postCompletionBenefitsResponse.body.benefits).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'package',
          title: 'Haircut Duo',
          description: expect.stringContaining('1 of 2 uses remaining')
        }),
        expect.objectContaining({
          type: 'loyalty',
          title: '15% loyalty reward'
        })
      ])
    );

    const dashboardResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/dashboard`)
      .set('x-admin-token', adminToken);

    expect(dashboardResponse.status).toBe(200);
    expect(dashboardResponse.body.dashboard.commerce).toEqual(
      expect.objectContaining({
        activePackagePlans: 1,
        packagesSold: 1,
        activePackageBalances: 1,
        availableLoyaltyRewards: 1,
        loyaltyProgramEnabled: true
      })
    );

    vi.useRealTimers();
  });

  it('automatically completes spent appointments and frees the live calendar slot', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 11, 10, 30, 0));

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'salon@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Trim House',
        website: 'trimhouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    await appointmentRepository.saveAppointment({
      id: 'appt-finished-slot',
      businessId: clientId,
      businessName: 'Trim House',
      categoryName: 'Barber',
      serviceName: 'Haircut',
      customerName: 'Ali Khan',
      customerPhone: '+923001234567',
      customerEmail: 'ali@example.com',
      appointmentDate: '2026-03-11',
      appointmentTime: '09:00',
      startAt: new Date(2026, 2, 11, 9, 0, 0).toISOString(),
      endAt: new Date(2026, 2, 11, 9, 45, 0).toISOString(),
      status: 'booked',
      source: 'qr',
      createdAt: new Date(2026, 2, 11, 8, 55, 0).toISOString(),
      updatedAt: new Date(2026, 2, 11, 8, 55, 0).toISOString()
    });

    const appointmentsResponse = await request(app).get(
      `/api/platform/clients/${clientId}/appointments`
    ).set('x-admin-token', adminToken);

    expect(appointmentsResponse.status).toBe(200);
    expect(appointmentsResponse.body.appointments).toEqual(
      expect.arrayContaining([expect.objectContaining({ status: 'completed' })])
    );

    const slotsResponse = await request(app).get(
      `/api/public/book/${clientId}/slots?date=2026-03-11`
    );

    expect(slotsResponse.status).toBe(200);
    expect(slotsResponse.body.slots).not.toContain('09:00');
    expect(slotsResponse.body.slots).toContain('11:00');

    vi.useRealTimers();
  });

  it('accepts reviews for completed appointments and exposes them publicly', async () => {
    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'reviews@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Review House',
        website: 'reviewhouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    await appointmentRepository.saveAppointment({
      id: completedReviewAppointmentId,
      businessId: clientId,
      businessName: 'Review House',
      categoryName: 'Barber',
      serviceName: 'Haircut',
      customerName: 'Ali Khan',
      customerPhone: '+923001234567',
      customerEmail: 'ali@example.com',
      appointmentDate: '2026-03-11',
      appointmentTime: '09:00',
      startAt: new Date(2026, 2, 11, 9, 0, 0).toISOString(),
      endAt: new Date(2026, 2, 11, 9, 45, 0).toISOString(),
      status: 'completed',
      source: 'qr',
      createdAt: new Date(2026, 2, 11, 8, 55, 0).toISOString(),
      updatedAt: new Date(2026, 2, 11, 10, 0, 0).toISOString()
    });

    const createReviewResponse = await request(app)
      .post(`/api/public/book/${clientId}/reviews`)
      .send({
        appointmentId: completedReviewAppointmentId,
        customerPhone: '+923001234567',
        reviewerName: 'Ali',
        rating: 5,
        comment: 'Great haircut and smooth experience.'
      });

    expect(createReviewResponse.status).toBe(201);
    expect(createReviewResponse.body.review.rating).toBe(5);
    expect(createReviewResponse.body.summary).toEqual({
      averageRating: 5,
      totalReviews: 1
    });

    const duplicateReviewResponse = await request(app)
      .post(`/api/public/book/${clientId}/reviews`)
      .send({
        appointmentId: completedReviewAppointmentId,
        customerPhone: '+923001234567',
        rating: 4
      });

    expect(duplicateReviewResponse.status).toBe(409);
    expect(duplicateReviewResponse.body.error).toBe(
      'A review has already been submitted for this appointment'
    );

    const publicReviewsResponse = await request(app).get(`/api/public/book/${clientId}/reviews`);

    expect(publicReviewsResponse.status).toBe(200);
    expect(publicReviewsResponse.body.summary).toEqual({
      averageRating: 5,
      totalReviews: 1
    });
    expect(publicReviewsResponse.body.reviews).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerName: 'Ali',
          rating: 5,
          comment: 'Great haircut and smooth experience.'
        })
      ])
    );

    const bookingPageResponse = await request(app).get(`/api/public/book/${clientId}`);

    expect(bookingPageResponse.status).toBe(200);
    expect(bookingPageResponse.body.reviewSummary).toEqual({
      averageRating: 5,
      totalReviews: 1
    });

    const platformReviewsResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/reviews`)
      .set('x-admin-token', adminToken);

    expect(platformReviewsResponse.status).toBe(200);
    expect(platformReviewsResponse.body.reviews).toHaveLength(1);
  });

  it('offers cancelled slots to matching waitlist customers and reserves the slot until claimed', async () => {
    const bookingDate = new Date();
    bookingDate.setDate(bookingDate.getDate() + 1);
    const bookingDateValue = `${bookingDate.getFullYear()}-${String(
      bookingDate.getMonth() + 1
    ).padStart(2, '0')}-${String(bookingDate.getDate()).padStart(2, '0')}`;

    const createResponse = await request(app).post('/api/platform/clients').send({
      email: 'waitlist@example.com',
      provider: 'email'
    });

    const clientId = createResponse.body.client.id as string;
    const adminToken = createResponse.body.adminToken as string;

    await request(app)
      .patch(`/api/platform/clients/${clientId}/business-profile`)
      .set('x-admin-token', adminToken)
      .send({
        businessName: 'Waitlist House',
        website: 'waitlisthouse.example'
      });

    await request(app)
      .patch(`/api/platform/clients/${clientId}/service-types`)
      .set('x-admin-token', adminToken)
      .send({
        serviceTypes: ['Barber']
      });

    const initialBookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        customerName: 'Booked Client',
        customerPhone: '+923001010101',
        source: 'direct'
      });

    expect(initialBookingResponse.status).toBe(201);

    const waitlistJoinResponse = await request(app)
      .post(`/api/public/book/${clientId}/waitlist`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        preferredTime: '09:00',
        customerName: 'Waitlist Client',
        customerPhone: '+923001020202',
        customerEmail: 'waitlist.client@example.com',
        source: 'direct'
      });

    expect(waitlistJoinResponse.status).toBe(201);
    expect(waitlistJoinResponse.body.waitlistEntry.status).toBe('active');

    const cancelResponse = await request(app)
      .post(
        `/api/public/book/${clientId}/appointments/${initialBookingResponse.body.appointment.id}/cancel`
      )
      .send({
        accessToken: initialBookingResponse.body.publicAccessToken
      });

    expect(cancelResponse.status).toBe(200);
    expect(cancelResponse.body.waitlistOffers).toEqual([
      expect.objectContaining({
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        notification: expect.objectContaining({
          recipient: 'customer',
          status: 'skipped'
        })
      })
    ]);

    const publicSlotsResponse = await request(app).get(
      `/api/public/book/${clientId}/slots?date=${bookingDateValue}`
    );

    expect(publicSlotsResponse.status).toBe(200);
    expect(publicSlotsResponse.body.slots).not.toContain('09:00');

    const waitlistResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/waitlist`)
      .set('x-admin-token', adminToken);

    expect(waitlistResponse.status).toBe(200);
    expect(waitlistResponse.body.waitlist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerName: 'Waitlist Client',
          serviceName: 'Haircut',
          status: 'offered'
        })
      ])
    );

    const claimLink = waitlistResponse.body.waitlist[0].claimLink as string;
    const claimUrl = new URL(claimLink);
    const waitlistEntryId = claimUrl.searchParams.get('waitlistEntryId') as string;
    const waitlistOfferToken = claimUrl.searchParams.get('waitlistOfferToken') as string;

    const claimedBookingPageResponse = await request(app).get(
      `/api/public/book/${clientId}?waitlistEntryId=${encodeURIComponent(waitlistEntryId)}&waitlistOfferToken=${encodeURIComponent(waitlistOfferToken)}`
    );

    expect(claimedBookingPageResponse.status).toBe(200);
    expect(claimedBookingPageResponse.body.waitlistOffer).toEqual(
      expect.objectContaining({
        waitlistEntryId,
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00'
      })
    );

    const claimedSlotsResponse = await request(app).get(
      `/api/public/book/${clientId}/slots?date=${bookingDateValue}&waitlistEntryId=${encodeURIComponent(waitlistEntryId)}&waitlistOfferToken=${encodeURIComponent(waitlistOfferToken)}`
    );

    expect(claimedSlotsResponse.status).toBe(200);
    expect(claimedSlotsResponse.body.slots).toContain('09:00');

    const claimedBookingResponse = await request(app)
      .post(`/api/public/book/${clientId}/appointments`)
      .send({
        serviceName: 'Haircut',
        appointmentDate: bookingDateValue,
        appointmentTime: '09:00',
        customerName: 'Waitlist Client',
        customerPhone: '+923001020202',
        customerEmail: 'waitlist.client@example.com',
        source: 'direct',
        waitlistEntryId,
        waitlistOfferToken
      });

    expect(claimedBookingResponse.status).toBe(201);
    expect(claimedBookingResponse.body.appointment.customerName).toBe('Waitlist Client');
    expect(claimedBookingResponse.body.appointment.appointmentTime).toBe('09:00');

    const claimedWaitlistResponse = await request(app)
      .get(`/api/platform/clients/${clientId}/waitlist`)
      .set('x-admin-token', adminToken);

    expect(claimedWaitlistResponse.status).toBe(200);
    expect(claimedWaitlistResponse.body.waitlist).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          customerName: 'Waitlist Client',
          status: 'claimed',
          claimedAppointmentId: claimedBookingResponse.body.appointment.id
        })
      ])
    );
  });
});
