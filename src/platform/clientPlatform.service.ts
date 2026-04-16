import { randomUUID } from 'crypto';
import { env } from '../config/env';
import { HttpError } from '../shared/errors/httpError';
import { clientPlatformRepository } from './clientPlatform.repository';
import { appointmentService } from '../appointments/appointment.service';
import {
  buildPlatformClientPagePath,
  platformClientAuthMessages,
  platformClientPagePaths
} from './clientPlatform.paths';
import {
  defaultServiceLocation,
  normalizeServiceLocations
} from './serviceLocation.constants';
import {
  getDashboardContentForLanguage,
  getDashboardLocaleKey,
  getDashboardUiCopyForLanguage,
  interpolateDashboardLabel
} from './dashboardLocalization';
import { preferredLanguageValues } from './clientPlatform.types';
import type { AppointmentRecord } from '../appointments/appointment.types';
import {
  createSeededBusinessServices,
  normalizeBusinessServices,
  syncBusinessServicesWithTypes
} from './businessServices';
import { formatInTimeZone } from '../shared/time';
import type {
  AccountTypeInput,
  BusinessProfileInput,
  BusinessSettingsRecord,
  ClientRecord,
  CreateProductInput,
  CustomerProfileRecord,
  CreateBusinessServiceInput,
  CreateClientInput,
  CreatePackagePlanInput,
  CreateTeamMemberInput,
  DashboardAppointmentViewModel,
  DashboardCommerceViewModel,
  DashboardUiCopy,
  DashboardViewModel,
  LaunchLinksViewModel,
  LoyaltyProgramRecord,
  PackagePlanRecord,
  ProductRecord,
  ProductSaleRecord,
  PublicClientRecord,
  PublicSalonShowcaseItem,
  PreferredLanguage,
  ReportMetadataRecord,
  ServiceLocationInput,
  SellProductInput,
  ServiceTypesInput,
  TeamMemberRecord,
  UpdateTeamMemberInput,
  UpdateBusinessSettingsInput,
  UpdateBusinessServiceInput,
  UpdateProductInput,
  UpdatePackagePlanInput,
  UpdatePreferredLanguageInput,
  UpdateLoyaltyProgramInput,
  VenueLocationInput,
  WeekdayId
} from './clientPlatform.types';

const DEFAULT_BUSINESS_SLOT_TIMES = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];

const DEFAULT_REPORT_METADATA: ReportMetadataRecord = {
  pageTitle: 'Reporting and analytics',
  pageSubtitle: 'Access all of your business reports in one workspace.'
};

const DEFAULT_BUSINESS_SETTINGS: BusinessSettingsRecord = {
  currencyCode: 'PKR',
  currencyLocale: 'en-PK',
  slotTimes: DEFAULT_BUSINESS_SLOT_TIMES,
  useServiceTemplates: true,
  reportMetadata: DEFAULT_REPORT_METADATA
};

const WEEKDAY_IDS: WeekdayId[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

const DASHBOARD_UI_COPY_BY_LANGUAGE: Record<PreferredLanguage, DashboardUiCopy> = {
  english: {
    locale: 'en-GB',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'Direct',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple Maps'
    },
    appointmentStatusLabels: {
      booked: 'BOOKED',
      completed: 'COMPLETED',
      cancelled: 'CANCELLED'
    },
    bookedAppointmentActionLabels: {
      edit: 'Edit',
      runningLate: 'Running late',
      complete: 'Complete',
      cancel: 'Cancel'
    },
    calendar: {
      today: 'Today',
      day: 'Day',
      agenda: 'Agenda',
      dateTimeConnector: 'at',
      bookingSourceTemplate: '{source} booking',
      add: 'Add',
      addMenuAria: 'Add menu',
      bookAppointment: 'Book appointment',
      showQrCode: 'Show QR code',
      groupAppointment: 'Group appointment',
      blockedTime: 'Blocked time',
      sale: 'Sale',
      quickPayment: 'Quick payment',
      onlineBookingsTitle: 'Online bookings',
      onlineBookingsDescription:
        'Appointments booked through your public salon links, social links, and QR code.',
      bookingLinkLabel: 'Open booking page',
      filterAll: 'All',
      filterBooked: 'Booked',
      filterQr: 'QR source',
      overviewSelectedDayLabel: 'Selected day',
      overviewSelectedDayMeta: 'appointments on this date',
      overviewComingAppointmentLabel: 'Coming appointment',
      overviewComingAppointmentMeta: 'currently active appointments',
      overviewNextClientLabel: 'Next client',
      overviewNextClientMeta: 'upcoming on the selected day',
      overviewNextClientEmpty: 'No bookings yet',
      appointmentsEmptyTitle: 'No bookings yet',
      appointmentsEmptyDescription:
        'Share your booking page, social links, or QR code to start collecting appointments.',
      qrEyebrow: 'Share booking QR',
      qrTitle: 'Scan to book',
      qrDescription:
        'Place this QR code on your salon door so clients can scan and book instantly.',
      qrPrint: 'Print QR code'
    },
    reports: {
      allFolders: 'All folders',
      rangeToday: 'Today',
      range7Days: '7 days',
      range30Days: '30 days',
      range90Days: '90 days',
      lastDaysTemplate: 'Last {days} days',
      exportCsv: 'Export CSV',
      print: 'Print',
      newCustomReport: 'New custom report',
      revenue: 'Revenue',
      appointments: 'Appointments',
      completed: 'Completed',
      clients: 'Clients',
      bookedInRangeTemplate: '{count} booked in range',
      completionFlowTemplate: '{label} completion flow',
      repeatClientsTeamTemplate: '{repeat} repeat â€¢ {team} team'
    }
  },
  chinese: {
    locale: 'zh-CN',
    bookingSourceLabels: {
      qr: '\u4e8c\u7ef4\u7801',
      direct: '\u76f4\u63a5',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple \u5730\u56fe'
    },
    appointmentStatusLabels: {
      booked: '\u5df2\u9884\u7ea6',
      completed: '\u5df2\u5b8c\u6210',
      cancelled: '\u5df2\u53d6\u6d88'
    },
    bookedAppointmentActionLabels: {
      edit: '\u7f16\u8f91',
      runningLate: '\u5ef6\u8fdf\u901a\u77e5',
      complete: '\u5b8c\u6210',
      cancel: '\u53d6\u6d88'
    },
    calendar: {
      today: '\u4eca\u5929',
      day: '\u65e5\u89c6\u56fe',
      agenda: '\u5217\u8868\u89c6\u56fe',
      dateTimeConnector: '',
      bookingSourceTemplate: '{source}\u9884\u7ea6',
      add: '\u65b0\u589e',
      addMenuAria: '\u65b0\u589e\u83dc\u5355',
      bookAppointment: '\u9884\u7ea6\u670d\u52a1',
      showQrCode: '\u663e\u793a\u4e8c\u7ef4\u7801',
      groupAppointment: '\u56e2\u4f53\u9884\u7ea6',
      blockedTime: '\u5c01\u9501\u65f6\u95f4',
      sale: '\u9500\u552e',
      quickPayment: '\u5feb\u901f\u6536\u6b3e',
      onlineBookingsTitle: '\u5728\u7ebf\u9884\u7ea6',
      onlineBookingsDescription: '\u8fd9\u91cc\u663e\u793a\u901a\u8fc7\u516c\u5f00\u9884\u7ea6\u9875\u3001\u793e\u4ea4\u94fe\u63a5\u548c\u4e8c\u7ef4\u7801\u4ea7\u751f\u7684\u9884\u7ea6\u3002',
      bookingLinkLabel: '\u6253\u5f00\u9884\u7ea6\u9875\u9762',
      filterAll: '\u5168\u90e8',
      filterBooked: '\u5df2\u9884\u7ea6',
      filterQr: '\u4e8c\u7ef4\u7801\u6765\u6e90',
      overviewSelectedDayLabel: '\u6240\u9009\u65e5\u671f',
      overviewSelectedDayMeta: '\u8be5\u65e5\u671f\u7684\u9884\u7ea6\u6570\u91cf',
      overviewComingAppointmentLabel: '\u5373\u5c06\u5f00\u59cb',
      overviewComingAppointmentMeta: '\u5f53\u524d\u6709\u6548\u9884\u7ea6',
      overviewNextClientLabel: '\u4e0b\u4e00\u4f4d\u5ba2\u6237',
      overviewNextClientMeta: '\u6240\u9009\u65e5\u671f\u5185\u7684\u4e0b\u4e00\u4e2a\u9884\u7ea6',
      overviewNextClientEmpty: '\u6682\u65e0\u9884\u7ea6',
      appointmentsEmptyTitle: '\u6682\u65e0\u9884\u7ea6',
      appointmentsEmptyDescription: '\u5206\u4eab\u4f60\u7684\u9884\u7ea6\u9875\u9762\u3001\u793e\u4ea4\u94fe\u63a5\u6216\u4e8c\u7ef4\u7801\u6765\u5f00\u59cb\u63a5\u6536\u9884\u7ea6\u3002',
      qrEyebrow: '\u5206\u4eab\u9884\u7ea6\u4e8c\u7ef4\u7801',
      qrTitle: '\u626b\u7801\u9884\u7ea6',
      qrDescription: '\u628a\u8fd9\u4e2a\u4e8c\u7ef4\u7801\u653e\u5728\u5e97\u95e8\u53e3\uff0c\u5ba2\u6237\u626b\u7801\u540e\u5c31\u80fd\u7acb\u5373\u9884\u7ea6\u3002',
      qrPrint: '\u6253\u5370\u4e8c\u7ef4\u7801'
    },
    reports: {
      allFolders: '\u5168\u90e8\u6587\u4ef6\u5939',
      rangeToday: '\u4eca\u5929',
      range7Days: '7\u5929',
      range30Days: '30\u5929',
      range90Days: '90\u5929',
      lastDaysTemplate: '\u6700\u8fd1 {days} \u5929',
      exportCsv: '\u5bfc\u51fa CSV',
      print: '\u6253\u5370',
      newCustomReport: '\u65b0\u5efa\u81ea\u5b9a\u4e49\u62a5\u8868',
      revenue: '\u6536\u5165',
      appointments: '\u9884\u7ea6',
      completed: '\u5df2\u5b8c\u6210',
      clients: '\u5ba2\u6237',
      bookedInRangeTemplate: '\u533a\u95f4\u5185\u5df2\u9884\u7ea6 {count} \u4e2a',
      completionFlowTemplate: '{label} \u5b8c\u6210\u8d8b\u52bf',
      repeatClientsTeamTemplate: '\u56de\u5934\u5ba2 {repeat} \u2022 \u56e2\u961f {team}'
    }
  },
  urdu: {
    locale: 'ur-PK',
    bookingSourceLabels: {
      qr: 'QR',
      direct: '\u0633\u06cc\u062f\u06be\u0627',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: '\u0627\u06cc\u067e\u0644 \u0645\u06cc\u067e\u0633'
    },
    appointmentStatusLabels: {
      booked: '\u0628\u06a9',
      completed: '\u0645\u06a9\u0645\u0644',
      cancelled: '\u0645\u0646\u0633\u0648\u062e'
    },
    bookedAppointmentActionLabels: {
      edit: '\u062a\u0631\u0645\u06cc\u0645',
      runningLate: '\u062a\u0627\u062e\u06cc\u0631',
      complete: '\u0645\u06a9\u0645\u0644',
      cancel: '\u0645\u0646\u0633\u0648\u062e'
    },
    calendar: {
      today: '\u0622\u062c',
      day: '\u062f\u0646',
      agenda: '\u0641\u06c1\u0631\u0633\u062a',
      add: '\u0634\u0627\u0645\u0644 \u06a9\u0631\u06cc\u06ba',
      addMenuAria: '\u0645\u06cc\u0646\u0648',
      bookAppointment: '\u0627\u067e\u0627\u0626\u0646\u0679 \u0645\u0646\u0679',
      showQrCode: 'QR \u06a9\u0648\u0688',
      groupAppointment: '\u06af\u0631\u0648\u067e \u0627\u067e\u0627\u0626\u0646\u0679 \u0645\u0646\u0679',
      blockedTime: '\u0628\u0644\u0627\u06a9 \u0648\u0642\u062a',
      sale: '\u0633\u06cc\u0644',
      quickPayment: '\u0641\u0648\u0631\u06cc \u0627\u062f\u0627\u0626\u06cc\u06af\u06cc',
      onlineBookingsTitle: '\u0622\u0646 \u0644\u0627\u0626\u0646 \u0628\u06a9\u0646\u06af\u0632',
      onlineBookingsDescription: '\u067e\u0628\u0644\u06a9 \u0644\u0646\u06a9\u0632 \u0627\u0648\u0631 QR \u06a9\u0648\u0688 \u0633\u06d2 \u0622\u0646\u06d2 \u0648\u0627\u0644\u06cc \u0628\u06a9\u0646\u06af\u0632 \u06cc\u06c1\u0627\u06ba \u062f\u06a9\u06be\u0627\u0626\u06cc \u062c\u0627\u062a\u06cc \u06c1\u06cc\u06ba\u06d4',
      bookingLinkLabel: '\u0628\u06a9\u0646\u06af \u067e\u06cc\u062c',
      filterAll: '\u0633\u0628',
      filterBooked: '\u0628\u06a9',
      filterQr: 'QR',
      overviewSelectedDayLabel: '\u0645\u0646\u062a\u062e\u0628 \u062f\u0646',
      overviewSelectedDayMeta: '\u0627\u0633 \u062f\u0646 \u06a9\u06cc \u0628\u06a9\u0646\u06af\u0632',
      overviewComingAppointmentLabel: '\u0622\u0646\u06d2 \u0648\u0627\u0644\u06cc \u0627\u067e\u0627\u0626\u0646\u0679 \u0645\u0646\u0679',
      overviewComingAppointmentMeta: '\u0641\u0639\u0627\u0644 \u0628\u06a9\u0646\u06af\u0632',
      overviewNextClientLabel: '\u0627\u06af\u0644\u0627 \u06a9\u0644\u0627\u0626\u0646\u0679',
      overviewNextClientMeta: '\u0627\u06af\u0644\u06cc \u0628\u06a9\u0646\u06af',
      overviewNextClientEmpty: '\u0627\u0628\u06be\u06cc \u06a9\u0648\u0626\u06cc \u0628\u06a9\u0646\u06af \u0646\u06c1\u06cc\u06ba',
      appointmentsEmptyTitle: '\u0627\u0628\u06be\u06cc \u06a9\u0648\u0626\u06cc \u0628\u06a9\u0646\u06af \u0646\u06c1\u06cc\u06ba',
      appointmentsEmptyDescription: '\u0628\u06a9\u0646\u06af \u067e\u06cc\u062c \u06cc\u0627 QR \u06a9\u0648\u0688 \u0634\u06cc\u0626\u0631 \u06a9\u0631\u06cc\u06ba \u062a\u0627\u06a9\u06c1 \u0628\u06a9\u0646\u06af \u0634\u0631\u0648\u0639 \u06c1\u0648\u06d4',
      qrEyebrow: 'QR',
      qrTitle: '\u0627\u0633\u06a9\u06cc\u0646 \u06a9\u0631\u06cc\u06ba',
      qrDescription: 'QR \u06a9\u0648\u0688 \u062f\u0631\u0648\u0627\u0632\u06d2 \u067e\u0631 \u0631\u06a9\u06be\u06cc\u06ba \u062a\u0627\u06a9\u06c1 \u06a9\u0644\u0627\u0626\u0646\u0679 \u0641\u0648\u0631\u0627\u064b \u0628\u06a9 \u06a9\u0631 \u0633\u06a9\u06cc\u06ba\u06d4',
      qrPrint: '\u067e\u0631\u0646\u0679'
    },
    reports: {
      allFolders: '\u062a\u0645\u0627\u0645 \u0641\u0648\u0644\u0688\u0631\u0632',
      rangeToday: '\u0622\u062c',
      range7Days: '7 \u062f\u0646',
      range30Days: '30 \u062f\u0646',
      range90Days: '90 \u062f\u0646',
      lastDaysTemplate: '\u067e\u0686\u06be\u0644\u06d2 {days} \u062f\u0646',
      exportCsv: 'CSV',
      print: '\u067e\u0631\u0646\u0679',
      newCustomReport: '\u0646\u06cc\u0627 \u0631\u067e\u0648\u0631\u0679',
      revenue: '\u0622\u0645\u062f\u0646',
      appointments: '\u0627\u067e\u0627\u0626\u0646\u0679 \u0645\u0646\u0679\u0632',
      completed: '\u0645\u06a9\u0645\u0644',
      clients: '\u06a9\u0644\u0627\u0626\u0646\u0679\u0632',
      bookedInRangeTemplate: '{count} \u0628\u06a9',
      completionFlowTemplate: '{label} \u0641\u0644\u0648',
      repeatClientsTeamTemplate: '{repeat} \u062f\u0648\u0628\u0627\u0631\u06c1 â€¢ {team} \u0679\u06cc\u0645'
    }
  },
  arabic: {
    locale: 'ar-SA',
    bookingSourceLabels: {
      qr: 'QR',
      direct: '\u0645\u0628\u0627\u0634\u0631',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: '\u062e\u0631\u0627\u0626\u0637 Apple'
    },
    appointmentStatusLabels: {
      booked: '\u0645\u062d\u062c\u0648\u0632',
      completed: '\u0645\u0643\u062a\u0645\u0644',
      cancelled: '\u0645\u0644\u063a\u0649'
    },
    bookedAppointmentActionLabels: {
      edit: '\u062a\u0639\u062f\u064a\u0644',
      runningLate: '\u062a\u0623\u062e\u064a\u0631',
      complete: '\u0625\u0643\u0645\u0627\u0644',
      cancel: '\u0625\u0644\u063a\u0627\u0621'
    },
    calendar: {
      today: '\u0627\u0644\u064a\u0648\u0645',
      day: '\u0627\u0644\u064a\u0648\u0645',
      agenda: '\u0627\u0644\u062c\u062f\u0648\u0644',
      add: '\u0625\u0636\u0627\u0641\u0629',
      addMenuAria: '\u0642\u0627\u0626\u0645\u0629',
      bookAppointment: '\u062d\u062c\u0632 \u0645\u0648\u0639\u062f',
      showQrCode: 'QR',
      groupAppointment: '\u0645\u0648\u0639\u062f \u062c\u0645\u0627\u0639\u064a',
      blockedTime: '\u0648\u0642\u062a \u0645\u062d\u062c\u0648\u0632',
      sale: '\u0628\u064a\u0639',
      quickPayment: '\u062f\u0641\u0639 \u0633\u0631\u064a\u0639',
      onlineBookingsTitle: '\u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a \u0639\u0628\u0631 \u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a',
      onlineBookingsDescription: '\u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a \u0645\u0646 \u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0627\u0644\u0631\u0648\u0627\u0628\u0637 \u0627\u0644\u0627\u062c\u062a\u0645\u0627\u0639\u064a\u0629 \u0648 QR \u062a\u0638\u0647\u0631 \u0647\u0646\u0627.',
      bookingLinkLabel: '\u0635\u0641\u062d\u0629 \u0627\u0644\u062d\u062c\u0632',
      filterAll: '\u0627\u0644\u0643\u0644',
      filterBooked: '\u0645\u062d\u062c\u0648\u0632',
      filterQr: 'QR',
      overviewSelectedDayLabel: '\u0627\u0644\u064a\u0648\u0645 \u0627\u0644\u0645\u062d\u062f\u062f',
      overviewSelectedDayMeta: '\u062d\u062c\u0648\u0632\u0627\u062a \u0647\u0630\u0627 \u0627\u0644\u064a\u0648\u0645',
      overviewComingAppointmentLabel: '\u0627\u0644\u0645\u0648\u0639\u062f \u0627\u0644\u0642\u0627\u062f\u0645',
      overviewComingAppointmentMeta: '\u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a \u0627\u0644\u0641\u0639\u0627\u0644\u0629',
      overviewNextClientLabel: '\u0627\u0644\u0639\u0645\u064a\u0644 \u0627\u0644\u062a\u0627\u0644\u064a',
      overviewNextClientMeta: '\u0627\u0644\u062d\u062c\u0632 \u0627\u0644\u062a\u0627\u0644\u064a',
      overviewNextClientEmpty: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u062c\u0648\u0632\u0627\u062a',
      appointmentsEmptyTitle: '\u0644\u0627 \u062a\u0648\u062c\u062f \u062d\u062c\u0648\u0632\u0627\u062a',
      appointmentsEmptyDescription: '\u0634\u0627\u0631\u0643 \u0635\u0641\u062d\u0629 \u0627\u0644\u062d\u062c\u0632 \u0623\u0648 QR \u0644\u0628\u062f\u0621 \u0627\u0644\u062d\u062c\u0648\u0632\u0627\u062a.',
      qrEyebrow: 'QR',
      qrTitle: '\u0627\u0645\u0633\u062d \u0644\u0644\u062d\u062c\u0632',
      qrDescription: '\u0636\u0639 QR \u0639\u0644\u0649 \u0628\u0627\u0628 \u0627\u0644\u0635\u0627\u0644\u0648\u0646 \u0644\u064a\u062d\u062c\u0632 \u0627\u0644\u0639\u0645\u0644\u0627\u0621 \u0641\u0648\u0631\u0627.',
      qrPrint: '\u0637\u0628\u0627\u0639\u0629'
    },
    reports: {
      allFolders: '\u062c\u0645\u064a\u0639 \u0627\u0644\u0645\u062c\u0644\u062f\u0627\u062a',
      rangeToday: '\u0627\u0644\u064a\u0648\u0645',
      range7Days: '7 \u0623\u064a\u0627\u0645',
      range30Days: '30 \u064a\u0648\u0645',
      range90Days: '90 \u064a\u0648\u0645',
      lastDaysTemplate: '\u0622\u062e\u0631 {days} \u064a\u0648\u0645',
      exportCsv: 'CSV',
      print: '\u0637\u0628\u0627\u0639\u0629',
      newCustomReport: '\u062a\u0642\u0631\u064a\u0631 \u062c\u062f\u064a\u062f',
      revenue: '\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a',
      appointments: '\u0627\u0644\u0645\u0648\u0627\u0639\u064a\u062f',
      completed: '\u0645\u0643\u062a\u0645\u0644',
      clients: '\u0627\u0644\u0639\u0645\u0644\u0627\u0621',
      bookedInRangeTemplate: '{count} \u062d\u062c\u0632',
      completionFlowTemplate: '{label} \u0627\u0643\u062a\u0645\u0627\u0644',
      repeatClientsTeamTemplate: '{repeat} \u0639\u0645\u0644\u0627\u0621 â€¢ {team} \u0641\u0631\u064a\u0642'
    }
  },
  hindi: {
    locale: 'hi-IN',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'à¤¸à¥€à¤§à¤¾',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple Maps'
    },
    appointmentStatusLabels: {
      booked: 'à¤¬à¥à¤•à¥à¤¡',
      completed: 'à¤ªà¥‚à¤°à¥à¤£',
      cancelled: 'à¤°à¤¦à¥à¤¦'
    },
    bookedAppointmentActionLabels: {
      edit: 'à¤¸à¤‚à¤ªà¤¾à¤¦à¤¿à¤¤',
      runningLate: 'à¤¦à¥‡à¤°à¥€',
      complete: 'à¤ªà¥‚à¤°à¤¾',
      cancel: 'à¤°à¤¦à¥à¤¦'
    },
    calendar: {
      today: 'à¤†à¤œ',
      day: 'à¤¦à¤¿à¤¨',
      agenda: 'à¤¸à¥‚à¤šà¥€',
      add: 'à¤œà¥‹à¤¡à¤¼à¥‡à¤‚',
      addMenuAria: 'à¤®à¥‡à¤¨à¥‚',
      bookAppointment: 'à¤…à¤ªà¥‰à¤‡à¤‚à¤Ÿà¤®à¥‡à¤‚à¤Ÿ',
      showQrCode: 'QR à¤•à¥‹à¤¡',
      groupAppointment: 'à¤¸à¤®à¥‚à¤¹ à¤…à¤ªà¥‰à¤‡à¤‚à¤Ÿà¤®à¥‡à¤‚à¤Ÿ',
      blockedTime: 'à¤¬à¥à¤²à¥‰à¤• à¤¸à¤®à¤¯',
      sale: 'à¤¬à¤¿à¤•à¥à¤°à¥€',
      quickPayment: 'à¤¤à¥à¤µà¤°à¤¿à¤¤ à¤­à¥à¤—à¤¤à¤¾à¤¨',
      onlineBookingsTitle: 'à¤‘à¤¨à¤²à¤¾à¤‡à¤¨ à¤¬à¥à¤•à¤¿à¤‚à¤—',
      onlineBookingsDescription: 'à¤ªà¤¬à¥à¤²à¤¿à¤• à¤²à¤¿à¤‚à¤•, à¤¸à¥‹à¤¶à¤² à¤²à¤¿à¤‚à¤• à¤”à¤° QR à¤¸à¥‡ à¤†à¤¨à¥‡ à¤µà¤¾à¤²à¥€ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¯à¤¹à¤¾à¤ à¤¦à¤¿à¤–à¤¤à¥€ à¤¹à¥ˆà¤‚à¥¤',
      bookingLinkLabel: 'à¤¬à¥à¤•à¤¿à¤‚à¤— à¤ªà¥‡à¤œ',
      filterAll: 'à¤¸à¤­à¥€',
      filterBooked: 'à¤¬à¥à¤•à¥à¤¡',
      filterQr: 'QR',
      overviewSelectedDayLabel: 'à¤šà¥à¤¨à¤¾ à¤¦à¤¿à¤¨',
      overviewSelectedDayMeta: 'à¤‡à¤¸ à¤¦à¤¿à¤¨ à¤•à¥€ à¤¬à¥à¤•à¤¿à¤‚à¤—',
      overviewComingAppointmentLabel: 'à¤…à¤—à¤²à¥€ à¤…à¤ªà¥‰à¤‡à¤‚à¤Ÿà¤®à¥‡à¤‚à¤Ÿ',
      overviewComingAppointmentMeta: 'à¤¸à¤•à¥à¤°à¤¿à¤¯ à¤¬à¥à¤•à¤¿à¤‚à¤—',
      overviewNextClientLabel: 'à¤…à¤—à¤²à¤¾ à¤—à¥à¤°à¤¾à¤¹à¤•',
      overviewNextClientMeta: 'à¤…à¤—à¤²à¥€ à¤¬à¥à¤•à¤¿à¤‚à¤—',
      overviewNextClientEmpty: 'à¤…à¤­à¥€ à¤•à¥‹à¤ˆ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¨à¤¹à¥€à¤‚',
      appointmentsEmptyTitle: 'à¤…à¤­à¥€ à¤•à¥‹à¤ˆ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤¨à¤¹à¥€à¤‚',
      appointmentsEmptyDescription: 'à¤¬à¥à¤•à¤¿à¤‚à¤— à¤ªà¥‡à¤œ à¤¯à¤¾ QR à¤¸à¤¾à¤à¤¾ à¤•à¤°à¥‡à¤‚ à¤¤à¤¾à¤•à¤¿ à¤¬à¥à¤•à¤¿à¤‚à¤— à¤®à¤¿à¤²à¤¨à¤¾ à¤¶à¥à¤°à¥‚ à¤¹à¥‹à¥¤',
      qrEyebrow: 'QR à¤¸à¤¾à¤à¤¾ à¤•à¤°à¥‡à¤‚',
      qrTitle: 'à¤¸à¥à¤•à¥ˆà¤¨ à¤•à¤°à¥‡à¤‚',
      qrDescription: 'QR à¤•à¥‹à¤¡ à¤¦à¤°à¤µà¤¾à¤œà¥‡ à¤ªà¤° à¤°à¤–à¥‡à¤‚ à¤¤à¤¾à¤•à¤¿ à¤—à¥à¤°à¤¾à¤¹à¤• à¤¤à¥à¤°à¤‚à¤¤ à¤¬à¥à¤• à¤•à¤° à¤¸à¤•à¥‡à¤‚à¥¤',
      qrPrint: 'à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ'
    },
    reports: {
      allFolders: 'à¤¸à¤­à¥€ à¤«à¤¼à¥‹à¤²à¥à¤¡à¤°',
      rangeToday: 'à¤†à¤œ',
      range7Days: '7 à¤¦à¤¿à¤¨',
      range30Days: '30 à¤¦à¤¿à¤¨',
      range90Days: '90 à¤¦à¤¿à¤¨',
      lastDaysTemplate: 'à¤ªà¤¿à¤›à¤²à¥‡ {days} à¤¦à¤¿à¤¨',
      exportCsv: 'CSV',
      print: 'à¤ªà¥à¤°à¤¿à¤‚à¤Ÿ',
      newCustomReport: 'à¤¨à¤ˆ à¤°à¤¿à¤ªà¥‹à¤°à¥à¤Ÿ',
      revenue: 'à¤†à¤¯',
      appointments: 'à¤…à¤ªà¥‰à¤‡à¤‚à¤Ÿà¤®à¥‡à¤‚à¤Ÿ',
      completed: 'à¤ªà¥‚à¤°à¥à¤£',
      clients: 'à¤—à¥à¤°à¤¾à¤¹à¤•',
      bookedInRangeTemplate: '{count} à¤¬à¥à¤•à¤¿à¤‚à¤—',
      completionFlowTemplate: '{label} à¤ªà¥à¤°à¤µà¤¾à¤¹',
      repeatClientsTeamTemplate: '{repeat} à¤¦à¥‹à¤¬à¤¾à¤°à¤¾ â€¢ {team} à¤Ÿà¥€à¤®'
    }
  },
  spanish: {
    locale: 'es-ES',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'Directo',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple Maps'
    },
    appointmentStatusLabels: {
      booked: 'RESERVADO',
      completed: 'COMPLETADO',
      cancelled: 'CANCELADO'
    },
    bookedAppointmentActionLabels: {
      edit: 'Editar',
      runningLate: 'Retraso',
      complete: 'Completar',
      cancel: 'Cancelar'
    },
    calendar: {
      today: 'Hoy',
      day: 'Dia',
      agenda: 'Agenda',
      add: 'Agregar',
      addMenuAria: 'Menu',
      bookAppointment: 'Reservar cita',
      showQrCode: 'Mostrar QR',
      groupAppointment: 'Cita grupal',
      blockedTime: 'Tiempo bloqueado',
      sale: 'Venta',
      quickPayment: 'Pago rapido',
      onlineBookingsTitle: 'Reservas online',
      onlineBookingsDescription: 'Las reservas desde tu pagina publica, enlaces sociales y QR aparecen aqui.',
      bookingLinkLabel: 'Abrir reservas',
      filterAll: 'Todo',
      filterBooked: 'Reservado',
      filterQr: 'QR',
      overviewSelectedDayLabel: 'Dia seleccionado',
      overviewSelectedDayMeta: 'citas en esta fecha',
      overviewComingAppointmentLabel: 'Proxima cita',
      overviewComingAppointmentMeta: 'citas activas',
      overviewNextClientLabel: 'Proximo cliente',
      overviewNextClientMeta: 'siguiente cita',
      overviewNextClientEmpty: 'Aun no hay reservas',
      appointmentsEmptyTitle: 'Aun no hay reservas',
      appointmentsEmptyDescription: 'Comparte tu pagina de reservas o QR para empezar a recibir reservas.',
      qrEyebrow: 'Compartir QR',
      qrTitle: 'Escanea para reservar',
      qrDescription: 'Coloca este QR en la puerta del salon para que los clientes reserven al instante.',
      qrPrint: 'Imprimir QR'
    },
    reports: {
      allFolders: 'Todas las carpetas',
      rangeToday: 'Hoy',
      range7Days: '7 dias',
      range30Days: '30 dias',
      range90Days: '90 dias',
      lastDaysTemplate: 'Ultimos {days} dias',
      exportCsv: 'Exportar CSV',
      print: 'Imprimir',
      newCustomReport: 'Nuevo reporte',
      revenue: 'Ingresos',
      appointments: 'Citas',
      completed: 'Completadas',
      clients: 'Clientes',
      bookedInRangeTemplate: '{count} reservas',
      completionFlowTemplate: 'Flujo {label}',
      repeatClientsTeamTemplate: '{repeat} recurrentes â€¢ {team} equipo'
    }
  },
  french: {
    locale: 'fr-FR',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'Direct',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Plans Apple'
    },
    appointmentStatusLabels: {
      booked: 'RESERVE',
      completed: 'TERMINE',
      cancelled: 'ANNULE'
    },
    bookedAppointmentActionLabels: {
      edit: 'Modifier',
      runningLate: 'Retard',
      complete: 'Terminer',
      cancel: 'Annuler'
    },
    calendar: {
      today: "Aujourd'hui",
      day: 'Jour',
      agenda: 'Agenda',
      add: 'Ajouter',
      addMenuAria: 'Menu',
      bookAppointment: 'Prendre rendez-vous',
      showQrCode: 'Afficher QR',
      groupAppointment: 'Rendez-vous groupe',
      blockedTime: 'Temps bloque',
      sale: 'Vente',
      quickPayment: 'Paiement rapide',
      onlineBookingsTitle: 'Reservations en ligne',
      onlineBookingsDescription: 'Les reservations depuis votre page publique, vos liens sociaux et le QR apparaissent ici.',
      bookingLinkLabel: 'Ouvrir reservations',
      filterAll: 'Tout',
      filterBooked: 'Reserve',
      filterQr: 'QR',
      overviewSelectedDayLabel: 'Jour selectionne',
      overviewSelectedDayMeta: 'rendez-vous a cette date',
      overviewComingAppointmentLabel: 'Prochain rendez-vous',
      overviewComingAppointmentMeta: 'rendez-vous actifs',
      overviewNextClientLabel: 'Prochain client',
      overviewNextClientMeta: 'prochain rendez-vous',
      overviewNextClientEmpty: 'Aucune reservation',
      appointmentsEmptyTitle: 'Aucune reservation',
      appointmentsEmptyDescription: 'Partagez votre page de reservation ou votre QR pour commencer a recevoir des reservations.',
      qrEyebrow: 'Partager QR',
      qrTitle: 'Scannez pour reserver',
      qrDescription: 'Placez ce QR sur la porte du salon pour que les clients reservent instantanement.',
      qrPrint: 'Imprimer QR'
    },
    reports: {
      allFolders: 'Tous les dossiers',
      rangeToday: "Aujourd'hui",
      range7Days: '7 jours',
      range30Days: '30 jours',
      range90Days: '90 jours',
      lastDaysTemplate: 'Derniers {days} jours',
      exportCsv: 'Exporter CSV',
      print: 'Imprimer',
      newCustomReport: 'Nouveau rapport',
      revenue: 'Revenus',
      appointments: 'Rendez-vous',
      completed: 'Termines',
      clients: 'Clients',
      bookedInRangeTemplate: '{count} reservations',
      completionFlowTemplate: 'Flux {label}',
      repeatClientsTeamTemplate: '{repeat} recurrents â€¢ {team} equipe'
    }
  },
  german: {
    locale: 'de-DE',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'Direkt',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple Karten'
    },
    appointmentStatusLabels: {
      booked: 'GEBUCHT',
      completed: 'ABGESCHLOSSEN',
      cancelled: 'STORNIERT'
    },
    bookedAppointmentActionLabels: {
      edit: 'Bearbeiten',
      runningLate: 'Verspaetung',
      complete: 'Abschliessen',
      cancel: 'Stornieren'
    },
    calendar: {
      today: 'Heute',
      day: 'Tag',
      agenda: 'Agenda',
      add: 'Hinzufuegen',
      addMenuAria: 'Menue',
      bookAppointment: 'Termin buchen',
      showQrCode: 'QR-Code anzeigen',
      groupAppointment: 'Gruppentermin',
      blockedTime: 'Blockierte Zeit',
      sale: 'Verkauf',
      quickPayment: 'Schnellzahlung',
      onlineBookingsTitle: 'Online-Buchungen',
      onlineBookingsDescription: 'Buchungen von Ihrer oeffentlichen Seite, Social-Links und QR erscheinen hier.',
      bookingLinkLabel: 'Buchungsseite oeffnen',
      filterAll: 'Alle',
      filterBooked: 'Gebucht',
      filterQr: 'QR',
      overviewSelectedDayLabel: 'Ausgewaehlter Tag',
      overviewSelectedDayMeta: 'Termine an diesem Datum',
      overviewComingAppointmentLabel: 'Naechster Termin',
      overviewComingAppointmentMeta: 'aktive Buchungen',
      overviewNextClientLabel: 'Naechster Kunde',
      overviewNextClientMeta: 'naechster Termin',
      overviewNextClientEmpty: 'Noch keine Buchungen',
      appointmentsEmptyTitle: 'Noch keine Buchungen',
      appointmentsEmptyDescription: 'Teilen Sie Ihre Buchungsseite oder den QR-Code, um Buchungen zu erhalten.',
      qrEyebrow: 'QR teilen',
      qrTitle: 'Scannen zum Buchen',
      qrDescription: 'Platzieren Sie diesen QR-Code an der Salontuer fuer sofortige Buchungen.',
      qrPrint: 'QR drucken'
    },
    reports: {
      allFolders: 'Alle Ordner',
      rangeToday: 'Heute',
      range7Days: '7 Tage',
      range30Days: '30 Tage',
      range90Days: '90 Tage',
      lastDaysTemplate: 'Letzte {days} Tage',
      exportCsv: 'CSV exportieren',
      print: 'Drucken',
      newCustomReport: 'Neuer Bericht',
      revenue: 'Umsatz',
      appointments: 'Termine',
      completed: 'Abgeschlossen',
      clients: 'Kunden',
      bookedInRangeTemplate: '{count} Buchungen',
      completionFlowTemplate: '{label} Ablauf',
      repeatClientsTeamTemplate: '{repeat} wiederkehrend â€¢ {team} Team'
    }
  },
  turkish: {
    locale: 'tr-TR',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'Dogrudan',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple Maps'
    },
    appointmentStatusLabels: {
      booked: 'REZERVE',
      completed: 'TAMAMLANDI',
      cancelled: 'IPTAL'
    },
    bookedAppointmentActionLabels: {
      edit: 'Duzenle',
      runningLate: 'Gecikme',
      complete: 'Tamamla',
      cancel: 'Iptal'
    },
    calendar: {
      today: 'Bugun',
      day: 'Gun',
      agenda: 'Ajanda',
      add: 'Ekle',
      addMenuAria: 'Menu',
      bookAppointment: 'Randevu olustur',
      showQrCode: 'QR goster',
      groupAppointment: 'Grup randevusu',
      blockedTime: 'Bloke zaman',
      sale: 'Satis',
      quickPayment: 'Hizli odeme',
      onlineBookingsTitle: 'Online rezervasyonlar',
      onlineBookingsDescription: 'Acik sayfa, sosyal baglantilar ve QR kodundan gelen rezervasyonlar burada gorunur.',
      bookingLinkLabel: 'Rezervasyon sayfasi',
      filterAll: 'Tum',
      filterBooked: 'Rezerve',
      filterQr: 'QR',
      overviewSelectedDayLabel: 'Secilen gun',
      overviewSelectedDayMeta: 'bu tarihteki randevular',
      overviewComingAppointmentLabel: 'Yaklasan randevu',
      overviewComingAppointmentMeta: 'aktif rezervasyonlar',
      overviewNextClientLabel: 'Siradaki musteri',
      overviewNextClientMeta: 'siradaki rezervasyon',
      overviewNextClientEmpty: 'Henuz rezervasyon yok',
      appointmentsEmptyTitle: 'Henuz rezervasyon yok',
      appointmentsEmptyDescription: 'Rezervasyon sayfanizi veya QR kodunu paylasarak rezervasyon almaya baslayin.',
      qrEyebrow: 'QR paylas',
      qrTitle: 'Tara ve ayirt',
      qrDescription: 'Bu QR kodunu salon kapisina koyun; musteriler hemen rezervasyon yapabilsin.',
      qrPrint: 'Yazdir'
    },
    reports: {
      allFolders: 'Tum klasorler',
      rangeToday: 'Bugun',
      range7Days: '7 gun',
      range30Days: '30 gun',
      range90Days: '90 gun',
      lastDaysTemplate: 'Son {days} gun',
      exportCsv: 'CSV disa aktar',
      print: 'Yazdir',
      newCustomReport: 'Yeni rapor',
      revenue: 'Gelir',
      appointments: 'Randevular',
      completed: 'Tamamlanan',
      clients: 'Musteriler',
      bookedInRangeTemplate: '{count} rezervasyon',
      completionFlowTemplate: '{label} akis',
      repeatClientsTeamTemplate: '{repeat} geri gelen â€¢ {team} ekip'
    }
  },
  portuguese: {
    locale: 'pt-PT',
    bookingSourceLabels: {
      qr: 'QR',
      direct: 'Direto',
      instagram: 'Instagram',
      facebook: 'Facebook',
      applemaps: 'Apple Maps'
    },
    appointmentStatusLabels: {
      booked: 'RESERVADO',
      completed: 'CONCLUIDO',
      cancelled: 'CANCELADO'
    },
    bookedAppointmentActionLabels: {
      edit: 'Editar',
      runningLate: 'Atraso',
      complete: 'Concluir',
      cancel: 'Cancelar'
    },
    calendar: {
      today: 'Hoje',
      day: 'Dia',
      agenda: 'Agenda',
      add: 'Adicionar',
      addMenuAria: 'Menu',
      bookAppointment: 'Marcar horario',
      showQrCode: 'Mostrar QR',
      groupAppointment: 'Marcacao em grupo',
      blockedTime: 'Tempo bloqueado',
      sale: 'Venda',
      quickPayment: 'Pagamento rapido',
      onlineBookingsTitle: 'Reservas online',
      onlineBookingsDescription: 'As reservas da pagina publica, links sociais e QR aparecem aqui.',
      bookingLinkLabel: 'Abrir reservas',
      filterAll: 'Todos',
      filterBooked: 'Reservado',
      filterQr: 'QR',
      overviewSelectedDayLabel: 'Dia selecionado',
      overviewSelectedDayMeta: 'marcacoes nesta data',
      overviewComingAppointmentLabel: 'Proxima marcacao',
      overviewComingAppointmentMeta: 'marcacoes ativas',
      overviewNextClientLabel: 'Proximo cliente',
      overviewNextClientMeta: 'proxima marcacao',
      overviewNextClientEmpty: 'Ainda nao ha reservas',
      appointmentsEmptyTitle: 'Ainda nao ha reservas',
      appointmentsEmptyDescription: 'Partilhe a sua pagina de reservas ou QR para comecar a receber reservas.',
      qrEyebrow: 'Partilhar QR',
      qrTitle: 'Digitalize para reservar',
      qrDescription: 'Coloque este QR na porta do salao para reservas imediatas.',
      qrPrint: 'Imprimir QR'
    },
    reports: {
      allFolders: 'Todas as pastas',
      rangeToday: 'Hoje',
      range7Days: '7 dias',
      range30Days: '30 dias',
      range90Days: '90 dias',
      lastDaysTemplate: 'Ultimos {days} dias',
      exportCsv: 'Exportar CSV',
      print: 'Imprimir',
      newCustomReport: 'Novo relatorio',
      revenue: 'Receita',
      appointments: 'Marcacoes',
      completed: 'Concluidas',
      clients: 'Clientes',
      bookedInRangeTemplate: '{count} reservas',
      completionFlowTemplate: 'Fluxo {label}',
      repeatClientsTeamTemplate: '{repeat} recorrentes â€¢ {team} equipa'
    }
  }
};

const buildFallbackEmail = (provider: CreateClientInput['provider']): string =>
  `${provider}-${randomUUID().slice(0, 8)}@platform.local`;

const normalizeClientEmail = (value: string | undefined): string =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const normalizeClientMobileNumber = (value: string | undefined): string =>
  typeof value === 'string' ? value.trim() : '';

const getNextIncompleteOnboardingPath = (
  client: ClientRecord
): string | null => {
  const hydratedClient = hydrateClientRecord(client);

  if (!hydratedClient.businessName.trim()) {
    return platformClientPagePaths.onboarding.businessName;
  }

  if (hydratedClient.serviceTypes.length === 0) {
    return platformClientPagePaths.onboarding.serviceTypes;
  }

  if (!hydratedClient.accountType) {
    return platformClientPagePaths.onboarding.accountType;
  }

  if (hydratedClient.serviceLocation.length === 0) {
    return platformClientPagePaths.onboarding.serviceLocation;
  }

  if (!hydratedClient.venueAddress.trim()) {
    return platformClientPagePaths.onboarding.venueLocation;
  }

  if (!hydratedClient.preferredLanguage) {
    return platformClientPagePaths.onboarding.launchLinks;
  }

  return null;
};

const getNextClientStep = (client: ClientRecord): string => {
  const hydratedClient = hydrateClientRecord(client);
  const incompleteOnboardingPath = getNextIncompleteOnboardingPath(hydratedClient);

  if (incompleteOnboardingPath) {
    return buildPlatformClientPagePath(incompleteOnboardingPath, hydratedClient.id);
  }

  if (hydratedClient.onboardingCompleted) {
    return buildPlatformClientPagePath(platformClientPagePaths.calendar, hydratedClient.id);
  }

  return buildPlatformClientPagePath(platformClientPagePaths.onboarding.complete, hydratedClient.id);
};

const normalizeCurrencyCode = (value: unknown): string => {
  const normalizedValue =
    typeof value === 'string' ? value.trim().toUpperCase().replace(/[^A-Z]/g, '') : '';
  return normalizedValue.length === 3 ? normalizedValue : DEFAULT_BUSINESS_SETTINGS.currencyCode;
};

const normalizeCurrencyLocale = (value: unknown): string => {
  const normalizedValue = typeof value === 'string' ? value.trim() : '';
  return normalizedValue.length > 0
    ? normalizedValue
    : DEFAULT_BUSINESS_SETTINGS.currencyLocale;
};

const parseMoneyLabel = (
  priceLabel: string,
  fallbackCurrencyCode = DEFAULT_BUSINESS_SETTINGS.currencyCode
): { amountValue: number; currencyCode: string } => {
  const trimmedLabel = typeof priceLabel === 'string' ? priceLabel.trim() : '';
  const currencyMatch = trimmedLabel.match(/\b([A-Za-z]{3})\b/);
  const normalizedValue = Number(trimmedLabel.replace(/[^\d.]/g, ''));

  return {
    amountValue: Number.isFinite(normalizedValue) ? normalizedValue : 0,
    currencyCode: currencyMatch?.[1]?.toUpperCase() ?? fallbackCurrencyCode
  };
};

const formatMoneyLabel = (
  amountValue: number,
  currencyCode: string,
  currencyLocale: string
): string => {
  const normalizedAmountValue = Number.isFinite(amountValue) ? amountValue : 0;

  try {
    return new Intl.NumberFormat(currencyLocale || DEFAULT_BUSINESS_SETTINGS.currencyLocale, {
      style: 'currency',
      currency: currencyCode || DEFAULT_BUSINESS_SETTINGS.currencyCode,
      maximumFractionDigits: normalizedAmountValue % 1 === 0 ? 0 : 2
    }).format(normalizedAmountValue);
  } catch (_error) {
    return `${currencyCode || DEFAULT_BUSINESS_SETTINGS.currencyCode} ${normalizedAmountValue}`;
  }
};

const normalizeSlotTimes = (value: unknown): string[] => {
  const rawValues = Array.isArray(value) ? value : [];
  const uniqueSlots = new Set<string>();

  for (const slotValue of rawValues) {
    const normalizedValue = typeof slotValue === 'string' ? slotValue.trim() : '';

    if (!TIME_PATTERN.test(normalizedValue)) {
      continue;
    }

    uniqueSlots.add(normalizedValue);
  }

  return uniqueSlots.size > 0
    ? [...uniqueSlots].sort((left, right) => left.localeCompare(right))
    : [...DEFAULT_BUSINESS_SETTINGS.slotTimes];
};

const normalizeReportMetadata = (
  value: Partial<ReportMetadataRecord> | null | undefined
): ReportMetadataRecord => ({
  pageTitle:
    typeof value?.pageTitle === 'string' && value.pageTitle.trim().length > 0
      ? value.pageTitle.trim()
      : DEFAULT_REPORT_METADATA.pageTitle,
  pageSubtitle:
    typeof value?.pageSubtitle === 'string' && value.pageSubtitle.trim().length > 0
      ? value.pageSubtitle.trim()
      : DEFAULT_REPORT_METADATA.pageSubtitle
});

const normalizeBusinessSettings = (
  value: Partial<BusinessSettingsRecord> | null | undefined
): BusinessSettingsRecord => ({
  currencyCode: normalizeCurrencyCode(value?.currencyCode),
  currencyLocale: normalizeCurrencyLocale(value?.currencyLocale),
  slotTimes: normalizeSlotTimes(value?.slotTimes),
  useServiceTemplates:
    typeof value?.useServiceTemplates === 'boolean'
      ? value.useServiceTemplates
      : DEFAULT_BUSINESS_SETTINGS.useServiceTemplates,
  reportMetadata: normalizeReportMetadata(value?.reportMetadata)
});

const parseTimeToMinutes = (value: string): number => {
  const [hoursValue, minutesValue] = value.split(':');
  const hours = Number(hoursValue);
  const minutes = Number(minutesValue);
  return hours * 60 + minutes;
};

const formatMinutesAsTime = (value: number): string => {
  const normalizedValue = Math.max(0, Math.min(24 * 60 - 1, Math.round(value)));
  const hours = Math.floor(normalizedValue / 60);
  const minutes = normalizedValue % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getDefaultTeamMemberTimeRange = (
  businessSettings: BusinessSettingsRecord | null | undefined
): { openingTime: string; closingTime: string } => {
  const normalizedSettings = normalizeBusinessSettings(businessSettings);
  const slotTimes = normalizedSettings.slotTimes;
  const openingTime = slotTimes[0] ?? '09:00';
  const lastSlot = slotTimes[slotTimes.length - 1] ?? '17:00';
  const slotMinutes = slotTimes.map(parseTimeToMinutes);
  const fallbackGapMinutes =
    slotMinutes.length > 1
      ? Math.max(
          15,
          slotMinutes
            .slice(1)
            .map((slotMinute, index) => slotMinute - slotMinutes[index])
            .find((gapMinutes) => gapMinutes > 0) ?? 60
        )
      : 60;
  const closingTime = formatMinutesAsTime(parseTimeToMinutes(lastSlot) + fallbackGapMinutes);
  return { openingTime, closingTime };
};

const normalizeTeamMemberOffDays = (value: unknown): WeekdayId[] => {
  const offDays = Array.isArray(value) ? value : [];
  const uniqueOffDays = new Set<WeekdayId>();

  for (const offDay of offDays) {
    const normalizedOffDay = typeof offDay === 'string' ? offDay.trim().toLowerCase() : '';

    if (WEEKDAY_IDS.includes(normalizedOffDay as WeekdayId)) {
      uniqueOffDays.add(normalizedOffDay as WeekdayId);
    }
  }

  return WEEKDAY_IDS.filter((weekdayId) => uniqueOffDays.has(weekdayId));
};

const getServiceTemplateOptions = (
  businessSettings: BusinessSettingsRecord | null | undefined
): {
  currencyCode: string;
  currencyLocale: string;
  useServiceTemplates: boolean;
} => {
  const normalizedSettings = normalizeBusinessSettings(businessSettings);

  return {
    currencyCode: normalizedSettings.currencyCode,
    currencyLocale: normalizedSettings.currencyLocale,
    useServiceTemplates: normalizedSettings.useServiceTemplates
  };
};

const formatOwnerName = (email: string): string => {
  const localPart = email.split('@')[0] ?? 'owner';
  return localPart
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
};

const getDefaultTeamMemberRole = (client: Pick<ClientRecord, 'serviceTypes'>): string =>
  client.serviceTypes.some(
    (serviceType) => typeof serviceType === 'string' && serviceType.trim().toLowerCase() === 'barber'
  )
    ? 'Barber'
    : 'Team member';

const getAvatarInitial = (label: string): string => label.trim().charAt(0).toLowerCase() || 'm';

const sanitizeTeamMember = (
  teamMember: Partial<TeamMemberRecord>,
  fallbackIndex: number,
  businessSettings: BusinessSettingsRecord | null | undefined
): TeamMemberRecord | undefined => {
  const name = typeof teamMember.name === 'string' ? teamMember.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const defaultTimeRange = getDefaultTeamMemberTimeRange(businessSettings);
  const openingTime =
    typeof teamMember.openingTime === 'string' && TIME_PATTERN.test(teamMember.openingTime.trim())
      ? teamMember.openingTime.trim()
      : defaultTimeRange.openingTime;
  const closingTime =
    typeof teamMember.closingTime === 'string' && TIME_PATTERN.test(teamMember.closingTime.trim())
      ? teamMember.closingTime.trim()
      : defaultTimeRange.closingTime;
  const normalizedOpeningTimeMinutes = parseTimeToMinutes(openingTime);
  const normalizedClosingTimeMinutes = parseTimeToMinutes(closingTime);
  const hasValidTimeRange = normalizedClosingTimeMinutes > normalizedOpeningTimeMinutes;

  return {
    id:
      typeof teamMember.id === 'string' && teamMember.id.trim().length > 0
        ? teamMember.id.trim()
        : `team-${fallbackIndex + 1}`,
    name,
    role:
      typeof teamMember.role === 'string' && teamMember.role.trim().length > 0
        ? teamMember.role.trim()
        : 'Barber',
    phone: typeof teamMember.phone === 'string' ? teamMember.phone.trim() : '',
    expertise:
      typeof teamMember.expertise === 'string' ? teamMember.expertise.trim() : '',
    openingTime: hasValidTimeRange ? openingTime : defaultTimeRange.openingTime,
    closingTime: hasValidTimeRange ? closingTime : defaultTimeRange.closingTime,
    offDays: normalizeTeamMemberOffDays(teamMember.offDays),
    isActive: teamMember.isActive !== false,
    createdAt:
      typeof teamMember.createdAt === 'string' && teamMember.createdAt.trim().length > 0
        ? teamMember.createdAt
        : timestamp,
    updatedAt:
      typeof teamMember.updatedAt === 'string' && teamMember.updatedAt.trim().length > 0
        ? teamMember.updatedAt
        : timestamp
  };
};

const normalizeTeamMembers = (
  teamMembers: TeamMemberRecord[] = [],
  businessSettings: BusinessSettingsRecord | null | undefined
): TeamMemberRecord[] =>
  teamMembers
    .map((teamMember, index) => sanitizeTeamMember(teamMember, index, businessSettings))
    .filter((teamMember): teamMember is TeamMemberRecord => !!teamMember);

const sanitizePackagePlan = (
  packagePlan: Partial<PackagePlanRecord>,
  fallbackIndex: number
): PackagePlanRecord | undefined => {
  const name = typeof packagePlan.name === 'string' ? packagePlan.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const totalUses = Number(packagePlan.totalUses);

  return {
    id:
      typeof packagePlan.id === 'string' && packagePlan.id.trim().length > 0
        ? packagePlan.id.trim()
        : `package-${fallbackIndex + 1}`,
    name,
    includedServiceIds: Array.isArray(packagePlan.includedServiceIds)
      ? packagePlan.includedServiceIds.filter(
          (serviceId): serviceId is string =>
            typeof serviceId === 'string' && serviceId.trim().length > 0
        )
      : [],
    totalUses: Number.isFinite(totalUses) && totalUses > 0 ? Math.floor(totalUses) : 1,
    priceLabel: typeof packagePlan.priceLabel === 'string' ? packagePlan.priceLabel.trim() : '',
    isActive: packagePlan.isActive !== false,
    createdAt:
      typeof packagePlan.createdAt === 'string' && packagePlan.createdAt.trim().length > 0
        ? packagePlan.createdAt
        : timestamp,
    updatedAt:
      typeof packagePlan.updatedAt === 'string' && packagePlan.updatedAt.trim().length > 0
        ? packagePlan.updatedAt
        : timestamp
  };
};

const normalizePackagePlans = (packagePlans: PackagePlanRecord[] = []): PackagePlanRecord[] =>
  packagePlans
    .map((packagePlan, index) => sanitizePackagePlan(packagePlan, index))
    .filter((packagePlan): packagePlan is PackagePlanRecord => !!packagePlan);

const sanitizeProduct = (
  product: Partial<ProductRecord>,
  fallbackIndex: number
): ProductRecord | undefined => {
  const name = typeof product.name === 'string' ? product.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const stockQuantity = Number(product.stockQuantity);

  return {
    id:
      typeof product.id === 'string' && product.id.trim().length > 0
        ? product.id.trim()
        : `product-${fallbackIndex + 1}`,
    name,
    categoryName:
      typeof product.categoryName === 'string' && product.categoryName.trim().length > 0
        ? product.categoryName.trim()
        : 'Retail',
    sku: typeof product.sku === 'string' ? product.sku.trim() : '',
    priceLabel: typeof product.priceLabel === 'string' ? product.priceLabel.trim() : '',
    stockQuantity: Number.isFinite(stockQuantity) && stockQuantity >= 0 ? Math.floor(stockQuantity) : 0,
    description: typeof product.description === 'string' ? product.description.trim() : '',
    isActive: product.isActive !== false,
    createdAt:
      typeof product.createdAt === 'string' && product.createdAt.trim().length > 0
        ? product.createdAt
        : timestamp,
    updatedAt:
      typeof product.updatedAt === 'string' && product.updatedAt.trim().length > 0
        ? product.updatedAt
        : timestamp
  };
};

const normalizeProducts = (products: ProductRecord[] = []): ProductRecord[] =>
  products
    .map((product, index) => sanitizeProduct(product, index))
    .filter((product): product is ProductRecord => !!product);

const sanitizeProductSale = (
  productSale: Partial<ProductSaleRecord>,
  fallbackIndex: number
): ProductSaleRecord | undefined => {
  const productId = typeof productSale.productId === 'string' ? productSale.productId.trim() : '';
  const productName = typeof productSale.productName === 'string' ? productSale.productName.trim() : '';
  const customerName =
    typeof productSale.customerName === 'string' ? productSale.customerName.trim() : '';
  const quantity = Number(productSale.quantity);

  if (!productId || !productName || !customerName) {
    return undefined;
  }

  const timestamp = new Date().toISOString();

  return {
    id:
      typeof productSale.id === 'string' && productSale.id.trim().length > 0
        ? productSale.id.trim()
        : `product-sale-${fallbackIndex + 1}`,
    productId,
    productName,
    sku: typeof productSale.sku === 'string' ? productSale.sku.trim() : '',
    quantity: Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1,
    unitPriceLabel: typeof productSale.unitPriceLabel === 'string' ? productSale.unitPriceLabel.trim() : '',
    totalPriceLabel:
      typeof productSale.totalPriceLabel === 'string' ? productSale.totalPriceLabel.trim() : '',
    customerName,
    customerPhone:
      typeof productSale.customerPhone === 'string' ? productSale.customerPhone.trim() : '',
    customerEmail:
      typeof productSale.customerEmail === 'string' ? productSale.customerEmail.trim() : '',
    soldAt:
      typeof productSale.soldAt === 'string' && productSale.soldAt.trim().length > 0
        ? productSale.soldAt
        : timestamp,
    createdAt:
      typeof productSale.createdAt === 'string' && productSale.createdAt.trim().length > 0
        ? productSale.createdAt
        : timestamp,
    updatedAt:
      typeof productSale.updatedAt === 'string' && productSale.updatedAt.trim().length > 0
        ? productSale.updatedAt
        : timestamp
  };
};

const normalizeProductSales = (productSales: ProductSaleRecord[] = []): ProductSaleRecord[] =>
  productSales
    .map((productSale, index) => sanitizeProductSale(productSale, index))
    .filter((productSale): productSale is ProductSaleRecord => !!productSale)
    .sort((left, right) => right.soldAt.localeCompare(left.soldAt));

const normalizeLoyaltyProgram = (
  loyaltyProgram: LoyaltyProgramRecord | null | undefined
): LoyaltyProgramRecord | null => {
  if (!loyaltyProgram || typeof loyaltyProgram !== 'object') {
    return null;
  }

  const timestamp = new Date().toISOString();
  const triggerCompletedVisits = Number(loyaltyProgram.triggerCompletedVisits);
  const rewardValue = Number(loyaltyProgram.rewardValue);

  return {
    id:
      typeof loyaltyProgram.id === 'string' && loyaltyProgram.id.trim().length > 0
        ? loyaltyProgram.id.trim()
        : 'loyalty-program',
    isEnabled: loyaltyProgram.isEnabled === true,
    triggerCompletedVisits:
      Number.isFinite(triggerCompletedVisits) && triggerCompletedVisits > 0
        ? Math.floor(triggerCompletedVisits)
        : 5,
    rewardType: 'discount_percent',
    rewardValue: Number.isFinite(rewardValue) && rewardValue > 0 ? rewardValue : 10,
    includedServiceIds: Array.isArray(loyaltyProgram.includedServiceIds)
      ? loyaltyProgram.includedServiceIds.filter(
          (serviceId): serviceId is string =>
            typeof serviceId === 'string' && serviceId.trim().length > 0
        )
      : [],
    createdAt:
      typeof loyaltyProgram.createdAt === 'string' && loyaltyProgram.createdAt.trim().length > 0
        ? loyaltyProgram.createdAt
        : timestamp,
    updatedAt:
      typeof loyaltyProgram.updatedAt === 'string' && loyaltyProgram.updatedAt.trim().length > 0
        ? loyaltyProgram.updatedAt
        : timestamp
  };
};

const normalizePreferredLanguage = (value: unknown): PreferredLanguage | null => {
  return typeof value === 'string' && preferredLanguageValues.includes(value as PreferredLanguage)
    ? (value as PreferredLanguage)
    : null;
};

const buildCustomerProfileId = (appointment: AppointmentRecord): string => {
  const phoneKey = typeof appointment.customerPhone === 'string' ? appointment.customerPhone.trim() : '';

  if (phoneKey) {
    return `phone:${phoneKey}`;
  }

  const emailKey =
    typeof appointment.customerEmail === 'string' ? appointment.customerEmail.trim().toLowerCase() : '';

  if (emailKey) {
    return `email:${emailKey}`;
  }

  return `name:${appointment.customerName.trim().toLowerCase()}`;
};

const sanitizeCustomerProfile = (
  customerProfile: Partial<CustomerProfileRecord>,
  fallbackIndex: number
): CustomerProfileRecord | undefined => {
  const customerName =
    typeof customerProfile.customerName === 'string' ? customerProfile.customerName.trim() : '';

  if (!customerName) {
    return undefined;
  }

  const timestamp = new Date().toISOString();
  const totalVisits = Number(customerProfile.totalVisits);
  const bookedVisits = Number(customerProfile.bookedVisits);
  const completedVisits = Number(customerProfile.completedVisits);
  const cancelledVisits = Number(customerProfile.cancelledVisits);

  return {
    id:
      typeof customerProfile.id === 'string' && customerProfile.id.trim().length > 0
        ? customerProfile.id.trim()
        : `customer-${fallbackIndex + 1}`,
    customerName,
    customerPhone:
      typeof customerProfile.customerPhone === 'string' ? customerProfile.customerPhone.trim() : '',
    customerEmail:
      typeof customerProfile.customerEmail === 'string' ? customerProfile.customerEmail.trim() : '',
    totalVisits: Number.isFinite(totalVisits) && totalVisits >= 0 ? Math.floor(totalVisits) : 0,
    bookedVisits: Number.isFinite(bookedVisits) && bookedVisits >= 0 ? Math.floor(bookedVisits) : 0,
    completedVisits:
      Number.isFinite(completedVisits) && completedVisits >= 0 ? Math.floor(completedVisits) : 0,
    cancelledVisits:
      Number.isFinite(cancelledVisits) && cancelledVisits >= 0 ? Math.floor(cancelledVisits) : 0,
    lastService:
      typeof customerProfile.lastService === 'string' ? customerProfile.lastService.trim() : '',
    lastAppointmentDate:
      typeof customerProfile.lastAppointmentDate === 'string'
        ? customerProfile.lastAppointmentDate.trim()
        : '',
    lastAppointmentTime:
      typeof customerProfile.lastAppointmentTime === 'string'
        ? customerProfile.lastAppointmentTime.trim()
        : '',
    firstSeenAt:
      typeof customerProfile.firstSeenAt === 'string' && customerProfile.firstSeenAt.trim().length > 0
        ? customerProfile.firstSeenAt
        : timestamp,
    lastSeenAt:
      typeof customerProfile.lastSeenAt === 'string' && customerProfile.lastSeenAt.trim().length > 0
        ? customerProfile.lastSeenAt
        : timestamp,
    createdAt:
      typeof customerProfile.createdAt === 'string' && customerProfile.createdAt.trim().length > 0
        ? customerProfile.createdAt
        : timestamp,
    updatedAt:
      typeof customerProfile.updatedAt === 'string' && customerProfile.updatedAt.trim().length > 0
        ? customerProfile.updatedAt
        : timestamp
  };
};

const normalizeCustomerProfiles = (customerProfiles: CustomerProfileRecord[] = []): CustomerProfileRecord[] =>
  customerProfiles
    .map((customerProfile, index) => sanitizeCustomerProfile(customerProfile, index))
    .filter((customerProfile): customerProfile is CustomerProfileRecord => !!customerProfile)
    .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));

const buildCustomerProfilesFromAppointments = (
  appointments: AppointmentRecord[]
): CustomerProfileRecord[] => {
  const customerProfiles = new Map<string, CustomerProfileRecord>();

  for (const appointment of [...appointments].sort((left, right) =>
    left.startAt.localeCompare(right.startAt)
  )) {
    const profileId = buildCustomerProfileId(appointment);
    const seenAt = appointment.updatedAt || appointment.createdAt || appointment.startAt;
    const createdAt = appointment.createdAt || appointment.startAt;
    const existingProfile = customerProfiles.get(profileId);

    if (!existingProfile) {
      customerProfiles.set(profileId, {
        id: profileId,
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone,
        customerEmail: appointment.customerEmail,
        totalVisits: 1,
        bookedVisits: appointment.status === 'booked' ? 1 : 0,
        completedVisits: appointment.status === 'completed' ? 1 : 0,
        cancelledVisits: appointment.status === 'cancelled' ? 1 : 0,
        lastService: appointment.serviceName,
        lastAppointmentDate: appointment.appointmentDate,
        lastAppointmentTime: appointment.appointmentTime,
        firstSeenAt: createdAt,
        lastSeenAt: seenAt,
        createdAt,
        updatedAt: seenAt
      });
      continue;
    }

    existingProfile.totalVisits += 1;
    if (appointment.status === 'booked') {
      existingProfile.bookedVisits += 1;
    }
    if (appointment.status === 'completed') {
      existingProfile.completedVisits += 1;
    }
    if (appointment.status === 'cancelled') {
      existingProfile.cancelledVisits += 1;
    }

    if (
      `${appointment.appointmentDate}T${appointment.appointmentTime}`.localeCompare(
        `${existingProfile.lastAppointmentDate}T${existingProfile.lastAppointmentTime}`
      ) >= 0
    ) {
      existingProfile.customerName = appointment.customerName;
      existingProfile.customerPhone = appointment.customerPhone;
      existingProfile.customerEmail = appointment.customerEmail;
      existingProfile.lastService = appointment.serviceName;
      existingProfile.lastAppointmentDate = appointment.appointmentDate;
      existingProfile.lastAppointmentTime = appointment.appointmentTime;
    }

    if (seenAt.localeCompare(existingProfile.lastSeenAt) > 0) {
      existingProfile.lastSeenAt = seenAt;
      existingProfile.updatedAt = seenAt;
    }

    if (createdAt.localeCompare(existingProfile.firstSeenAt) < 0) {
      existingProfile.firstSeenAt = createdAt;
      existingProfile.createdAt = createdAt;
    }
  }

  return [...customerProfiles.values()].sort((left, right) =>
    right.lastSeenAt.localeCompare(left.lastSeenAt)
  );
};

const buildProductCommerceView = (
  client: Pick<ClientRecord, 'products' | 'productSales'>
): Pick<
  DashboardCommerceViewModel,
  'activeProducts' | 'productsSold' | 'productUnitsSold' | 'lowStockProducts'
> => {
  const activeProducts = normalizeProducts(client.products ?? []).filter(
    (product) => product.isActive !== false
  );
  const productSales = normalizeProductSales(client.productSales ?? []);

  return {
    activeProducts: activeProducts.length,
    productsSold: productSales.length,
    productUnitsSold: productSales.reduce((sum, productSale) => sum + productSale.quantity, 0),
    lowStockProducts: activeProducts.filter((product) => product.stockQuantity <= 3).length
  };
};

const toPublicClientRecord = (client: ClientRecord): PublicClientRecord => ({
  id: client.id,
  email: client.email,
  mobileNumber: client.mobileNumber,
  businessPhoneNumber: client.businessPhoneNumber,
  provider: client.provider,
  businessName: client.businessName,
  website: client.website,
  profileImageUrl: client.profileImageUrl ?? '',
  serviceTypes: client.serviceTypes,
  services: normalizeBusinessServices(
    client.serviceTypes,
    client.services ?? [],
    getServiceTemplateOptions(client.businessSettings)
  ),
  products: normalizeProducts(client.products ?? []),
  productSales: normalizeProductSales(client.productSales ?? []),
  packagePlans: normalizePackagePlans(client.packagePlans ?? []),
  loyaltyProgram: normalizeLoyaltyProgram(client.loyaltyProgram),
  businessSettings: normalizeBusinessSettings(client.businessSettings),
  customerProfiles: normalizeCustomerProfiles(client.customerProfiles ?? []),
  teamMembers: normalizeTeamMembers(client.teamMembers ?? [], client.businessSettings),
  accountType: client.accountType,
  serviceLocation: normalizeServiceLocations(client.serviceLocation),
  venueAddress: client.venueAddress,
  preferredLanguage: normalizePreferredLanguage(client.preferredLanguage),
  onboardingCompleted: client.onboardingCompleted,
  createdAt: client.createdAt,
  updatedAt: client.updatedAt
});

const shouldSeedDemoSalons = (): boolean => env.APP_ENV === 'dev';

const DEMO_SALONS: ClientRecord[] = [
  {
    id: 'demo-luna-luxe',
    adminToken: 'demo-admin-luna-luxe',
    email: 'hello@lunaluxe.demo',
    mobileNumber: '',
    businessPhoneNumber: '+92 300 1110001',
    provider: 'email',
    businessName: 'Luna Luxe Salon',
    website: 'www.lunaluxe.demo',
    profileImageUrl: '',
    serviceTypes: ['Hair salon', 'Beauty salon'],
    services: createSeededBusinessServices(
      ['Hair salon', 'Beauty salon'],
      getServiceTemplateOptions(DEFAULT_BUSINESS_SETTINGS)
    ),
    products: [],
    productSales: [],
    packagePlans: [],
    loyaltyProgram: null,
    businessSettings: normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS),
    customerProfiles: [],
    teamMembers: [
      {
        id: 'team-luna-1',
        name: 'Mina',
        role: 'Stylist',
        phone: '+923001110001',
        expertise: 'Colour and blow-dry',
        openingTime: '09:00',
        closingTime: '18:00',
        offDays: [],
        isActive: true,
        createdAt: '2026-03-01T09:00:00.000Z',
        updatedAt: '2026-03-12T08:30:00.000Z'
      }
    ],
    accountType: 'team',
    serviceLocation: [defaultServiceLocation],
    venueAddress: 'Clifton Block 5, Schon Circle, Karachi, Sindh, Pakistan',
    preferredLanguage: 'english',
    onboardingCompleted: true,
    createdAt: '2026-03-01T09:00:00.000Z',
    updatedAt: '2026-03-12T08:30:00.000Z'
  },
  {
    id: 'demo-urban-trim',
    adminToken: 'demo-admin-urban-trim',
    email: 'hello@urbantrim.demo',
    mobileNumber: '',
    businessPhoneNumber: '+92 300 1110003',
    provider: 'email',
    businessName: 'Urban Trim Studio',
    website: 'www.urbantrim.demo',
    profileImageUrl: '',
    serviceTypes: ['Barber'],
    services: createSeededBusinessServices(['Barber'], getServiceTemplateOptions(DEFAULT_BUSINESS_SETTINGS)),
    products: [],
    productSales: [],
    packagePlans: [],
    loyaltyProgram: null,
    businessSettings: normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS),
    customerProfiles: [],
    teamMembers: [],
    accountType: 'independent',
    serviceLocation: [defaultServiceLocation],
    venueAddress: 'MM Alam Road, Gulberg III, Lahore, Punjab, Pakistan',
    preferredLanguage: 'english',
    onboardingCompleted: true,
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-12T08:00:00.000Z'
  },
  {
    id: 'demo-serene-glow',
    adminToken: 'demo-admin-serene-glow',
    email: 'hello@sereneglow.demo',
    mobileNumber: '',
    businessPhoneNumber: '+92 300 1110002',
    provider: 'email',
    businessName: 'Serene Glow Spa',
    website: 'www.sereneglow.demo',
    profileImageUrl: '',
    serviceTypes: ['Massage', 'Spa & sauna'],
    services: createSeededBusinessServices(
      ['Massage', 'Spa & sauna'],
      getServiceTemplateOptions(DEFAULT_BUSINESS_SETTINGS)
    ),
    products: [],
    productSales: [],
    packagePlans: [],
    loyaltyProgram: null,
    businessSettings: normalizeBusinessSettings(DEFAULT_BUSINESS_SETTINGS),
    customerProfiles: [],
    teamMembers: [
      {
        id: 'team-serene-1',
        name: 'Hira',
        role: 'Therapist',
        phone: '+923001110002',
        expertise: 'Deep tissue massage',
        openingTime: '09:00',
        closingTime: '18:00',
        offDays: [],
        isActive: true,
        createdAt: '2026-03-03T11:00:00.000Z',
        updatedAt: '2026-03-12T07:30:00.000Z'
      }
    ],
    accountType: 'team',
    serviceLocation: [defaultServiceLocation],
    venueAddress: 'Blue Area, Jinnah Avenue, Islamabad, Islamabad Capital Territory, Pakistan',
    preferredLanguage: 'english',
    onboardingCompleted: true,
    createdAt: '2026-03-03T11:00:00.000Z',
    updatedAt: '2026-03-12T07:30:00.000Z'
  }
];

const ensureDemoSalons = async (): Promise<void> => {
  if (!shouldSeedDemoSalons()) {
    return;
  }

  const existingClients = await clientPlatformRepository.listClients();
  const existingIds = new Set(existingClients.map((client) => client.id));

  await Promise.all(
    DEMO_SALONS.filter((client) => !existingIds.has(client.id)).map((client) =>
      clientPlatformRepository.saveClient(hydrateClientRecord(client))
    )
  );
};

const formatDashboardDate = (
  date: Date,
  preferredLanguage: PreferredLanguage | null | undefined
): string =>
  formatInTimeZone(
    date,
    getDashboardUiCopyForLanguage(preferredLanguage, DASHBOARD_UI_COPY_BY_LANGUAGE).locale,
    env.APP_TIMEZONE,
    {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    }
  )
    .replace(',', '');

const formatDashboardTime = (
  date: Date,
  preferredLanguage: PreferredLanguage | null | undefined
): string =>
  formatInTimeZone(
    date,
    getDashboardUiCopyForLanguage(preferredLanguage, DASHBOARD_UI_COPY_BY_LANGUAGE).locale,
    env.APP_TIMEZONE,
    {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }
  );

const buildDashboardLink = (clientId: string, origin: string): string =>
  `${origin}/calendar?clientId=${encodeURIComponent(clientId)}`;

const buildQrCodeImageLink = (clientId: string, origin: string): string =>
  `${origin}/api/public/book/${encodeURIComponent(clientId)}/qr`;

const buildLaunchLinks = async (
  clientId: string,
  origin: string
): Promise<LaunchLinksViewModel> => {
  const [
    bookingPageLink,
    instagramBookingLink,
    facebookBookingLink,
    appleMapsBookingLink,
    qrBookingPageLink
  ] = await Promise.all([
    appointmentService.getBookingUrl(clientId, origin, 'direct'),
    appointmentService.getBookingUrl(clientId, origin, 'instagram'),
    appointmentService.getBookingUrl(clientId, origin, 'facebook'),
    appointmentService.getBookingUrl(clientId, origin, 'applemaps'),
    appointmentService.getBookingUrl(clientId, origin, 'qr')
  ]);

  return {
    dashboardLink: buildDashboardLink(clientId, origin),
    bookingPageLink,
    instagramBookingLink,
    facebookBookingLink,
    appleMapsBookingLink,
    qrCodeImageLink: buildQrCodeImageLink(clientId, origin),
    qrBookingPageLink
  };
};

const buildClientDrawerItems = (appointments: AppointmentRecord[]) => {
  const uniqueClients = new Map<string, AppointmentRecord>();

  for (const appointment of [...appointments].sort((left, right) =>
    right.startAt.localeCompare(left.startAt)
  )) {
    const key = appointment.customerPhone || appointment.customerEmail || appointment.customerName;

    if (!uniqueClients.has(key)) {
      uniqueClients.set(key, appointment);
    }
  }

  const recentClients = [...uniqueClients.values()].slice(0, 6);

  if (recentClients.length === 0) {
    return [
      {
        label: 'No booked clients yet',
        subtitle: 'Customer details from new bookings will appear here.'
      }
    ];
  }

  return recentClients.map((appointment) => ({
    label: appointment.customerName,
    subtitle: `${appointment.customerPhone}${appointment.customerEmail ? ` â€¢ ${appointment.customerEmail}` : ''} â€¢ ${appointment.serviceName}`
  }));
};

const buildStoredClientDrawerItems = (
  customerProfiles: CustomerProfileRecord[],
  preferredLanguage: PreferredLanguage | null
) => {
  const recentClients = normalizeCustomerProfiles(customerProfiles).slice(0, 6);
  const dashboardContent = getDashboardContentForLanguage(preferredLanguage);

  if (recentClients.length === 0) {
    return [
      {
        label: dashboardContent.noClientsYet,
        subtitle: dashboardContent.noClientsSubtitle
      }
    ];
  }

  return recentClients.map((customerProfile) => ({
    label: customerProfile.customerName,
    subtitle:
      `${customerProfile.customerPhone}${customerProfile.customerEmail ? ` - ${customerProfile.customerEmail}` : ''} - ` +
      interpolateDashboardLabel(dashboardContent.visitCountTemplate, {
        count: customerProfile.totalVisits
      })
  }));
};

const buildTeamDrawerSections = (client: ClientRecord) => {
  const activeTeamMembers = normalizeTeamMembers(client.teamMembers ?? [], client.businessSettings).filter(
    (teamMember) => teamMember.isActive
  );
  const localeKey = getDashboardLocaleKey(client.preferredLanguage);
  const dashboardContent = getDashboardContentForLanguage(client.preferredLanguage);
  const teamRoleLabel = client.serviceTypes.includes('Barber')
    ? dashboardContent.barberRole
    : dashboardContent.teamMemberRole;
  const activeTeamRoleLabel =
    localeKey === 'english' && activeTeamMembers.length !== 1 ? `${teamRoleLabel}s` : teamRoleLabel;

  return [
    {
      items: [
        {
          label: dashboardContent.teamMembers,
          subtitle: interpolateDashboardLabel(dashboardContent.activeTeamMembersTemplate, {
            count: activeTeamMembers.length,
            role: activeTeamRoleLabel
          })
        },
        { label: dashboardContent.scheduledShifts },
        { label: dashboardContent.timesheets, meta: { type: 'dot' as const } },
        { label: dashboardContent.payRuns, meta: { type: 'dot' as const } }
      ]
    },
    {
      title: activeTeamMembers.length > 0 ? dashboardContent.currentTeam : dashboardContent.teamSetup,
      items:
        activeTeamMembers.length > 0
          ? activeTeamMembers.map((teamMember) => ({
              label: teamMember.name,
              subtitle: `${teamMember.expertise || teamMember.role}${teamMember.phone ? ` - ${teamMember.phone}` : ''}`
            }))
          : [
              {
                label: dashboardContent.noTeamMembers,
                subtitle: interpolateDashboardLabel(dashboardContent.addFirstTeamMemberTemplate, {
                  role: teamRoleLabel
                })
              }
            ]
    }
  ];
};

const buildDashboardViewModel = (
  client: ClientRecord,
  appointments: DashboardAppointmentViewModel[],
  bookedAppointments: AppointmentRecord[],
  launchLinks: LaunchLinksViewModel,
  commerce: DashboardCommerceViewModel
): DashboardViewModel => {
  const uiCopy = getDashboardUiCopyForLanguage(client.preferredLanguage, DASHBOARD_UI_COPY_BY_LANGUAGE);
  const dashboardContent = getDashboardContentForLanguage(client.preferredLanguage);
  const businessName = client.businessName || 'fresha';
  const ownerName = client.businessName || formatOwnerName(client.email) || dashboardContent.ownerFallback;
  const businessSettings = normalizeBusinessSettings(client.businessSettings);
  const now = new Date();
  const reportPageTitle =
    businessSettings.reportMetadata.pageTitle === DEFAULT_REPORT_METADATA.pageTitle
      ? dashboardContent.reportPageTitle
      : businessSettings.reportMetadata.pageTitle;
  const reportPageSubtitle =
    businessSettings.reportMetadata.pageSubtitle === DEFAULT_REPORT_METADATA.pageSubtitle
      ? dashboardContent.reportPageSubtitle
      : businessSettings.reportMetadata.pageSubtitle;

  return {
    businessName,
    ownerName,
    avatarInitial: getAvatarInitial(ownerName),
    profileImageUrl: client.profileImageUrl ?? '',
    setupButtonLabel: client.onboardingCompleted
      ? dashboardContent.setupComplete
      : dashboardContent.continueSetup,
    setupButtonPath: '/guides/legendary-learner',
    bookingLink: `/book/${client.id}`,
    launchLinks,
    commerce,
    currentDateLabel: formatDashboardDate(now, client.preferredLanguage),
    currentTimeLabel: formatDashboardTime(now, client.preferredLanguage),
    appointments,
    uiCopy,
    sideDrawers: {
      sales: {
        title: dashboardContent.salesTitle,
        sections: [
          {
            items: [
              { label: dashboardContent.dailySalesSummary },
              { label: dashboardContent.appointments },
              { label: dashboardContent.sales },
              { label: dashboardContent.payments },
              { label: dashboardContent.giftCardsSold },
              { label: dashboardContent.packagesSold }
            ]
          }
        ]
      },
      clients: {
        title: dashboardContent.clientsTitle,
        sections: [
          {
            items: [
              { label: dashboardContent.clientsList },
              { label: dashboardContent.clientLoyalty }
            ]
          },
          {
            title: dashboardContent.clientsTitle,
            items: buildStoredClientDrawerItems(client.customerProfiles ?? [], client.preferredLanguage)
          }
        ]
      },
      catalog: {
        title: dashboardContent.catalogTitle,
        sections: [
          {
            items: [
              { label: dashboardContent.serviceMenu },
              { label: dashboardContent.packages },
              {
                label: dashboardContent.products,
                subtitle:
                  commerce.activeProducts > 0
                    ? interpolateDashboardLabel(dashboardContent.activeProductsTemplate, {
                        count: commerce.activeProducts
                      })
                    : dashboardContent.noProducts
              }
            ]
          },
          {
            title: dashboardContent.inventoryTitle,
            items: [
              { label: dashboardContent.stocktakes },
              { label: dashboardContent.stockOrders },
              { label: dashboardContent.suppliers }
            ]
          }
        ]
      },
      team: {
        title: dashboardContent.teamTitle,
        sections: buildTeamDrawerSections(client)
      }
    },
    reportsView: {
      sidebarTitle: dashboardContent.reportsTitle,
      menu: [
        { label: dashboardContent.allReports, active: true, meta: { type: 'count', value: '0' } },
        { label: dashboardContent.favourites, meta: { type: 'count', value: '0' } },
        { label: dashboardContent.dashboards, meta: { type: 'count', value: '0' } },
        { label: dashboardContent.standard, meta: { type: 'count', value: '0' } },
        { label: dashboardContent.premium, meta: { type: 'count', value: '0' } },
        { label: dashboardContent.custom, meta: { type: 'count', value: '0' } },
        { label: dashboardContent.targets, meta: { type: 'count', value: '0' } }
      ],
      folderTitle: dashboardContent.folders,
      folderActionLabel: dashboardContent.addFolder,
      connectorLabel: dashboardContent.dataConnector,
      pageTitle: reportPageTitle,
      pageSubtitle: reportPageSubtitle,
      totalLabel: '0',
      searchPlaceholder: dashboardContent.searchReports,
      filters: [dashboardContent.filterCreatedBy, dashboardContent.filterCategory],
      tabs: [
        { label: dashboardContent.allReports, active: true },
        { label: dashboardContent.salesTitle },
        { label: dashboardContent.finance },
        { label: dashboardContent.appointments },
        { label: dashboardContent.teamTitle },
        { label: dashboardContent.clientsTitle },
        { label: dashboardContent.inventoryTitle }
      ],
      cards: [
        {
          title: dashboardContent.performanceDashboard,
          description: dashboardContent.performanceDashboardDescription
        },
        {
          title: dashboardContent.onlinePresenceDashboard,
          description: dashboardContent.onlinePresenceDashboardDescription
        },
        {
          title: dashboardContent.loyaltyDashboard,
          description: dashboardContent.loyaltyDashboardDescription
        }
      ]
    }
  };
};

const getClientOrThrow = async (clientId: string): Promise<ClientRecord> => {
  const client = await clientPlatformRepository.getClientById(clientId);

  if (!client) {
    throw new HttpError(404, 'Client not found');
  }

  return hydrateClientRecord(client);
};

const hydrateClientRecord = (client: ClientRecord): ClientRecord => {
  const businessSettings = normalizeBusinessSettings(client.businessSettings);

  return {
    ...client,
    mobileNumber: typeof client.mobileNumber === 'string' ? client.mobileNumber.trim() : '',
    businessPhoneNumber:
      typeof client.businessPhoneNumber === 'string' ? client.businessPhoneNumber.trim() : '',
    businessSettings,
    serviceLocation: normalizeServiceLocations(client.serviceLocation),
    services: normalizeBusinessServices(
      client.serviceTypes,
      client.services ?? [],
      getServiceTemplateOptions(businessSettings)
    ),
    products: normalizeProducts(client.products ?? []),
    productSales: normalizeProductSales(client.productSales ?? []),
    packagePlans: normalizePackagePlans(client.packagePlans ?? []),
    loyaltyProgram: normalizeLoyaltyProgram(client.loyaltyProgram),
    customerProfiles: normalizeCustomerProfiles(client.customerProfiles ?? []),
    teamMembers: normalizeTeamMembers(client.teamMembers ?? [], businessSettings),
    preferredLanguage: normalizePreferredLanguage(client.preferredLanguage)
  };
};

const updateClient = async (
  clientId: string,
  updater: (client: ClientRecord) => ClientRecord
): Promise<ClientRecord> => {
  const updatedClient = hydrateClientRecord(updater(await getClientOrThrow(clientId)));
  await clientPlatformRepository.saveClient(updatedClient);
  return updatedClient;
};

const findClientByLoginInput = async (
  input: Pick<CreateClientInput, 'email' | 'mobileNumber'>
): Promise<ClientRecord | null> => {
  const normalizedEmail = normalizeClientEmail(input.email);
  const normalizedMobileNumber = normalizeClientMobileNumber(input.mobileNumber);

  if (!normalizedEmail && !normalizedMobileNumber) {
    return null;
  }

  const clients = (await clientPlatformRepository.listClients()).map(hydrateClientRecord);

  if (normalizedEmail) {
    const emailMatch = clients.find((client) => client.email === normalizedEmail);

    if (emailMatch) {
      return emailMatch;
    }
  }

  if (normalizedMobileNumber) {
    const mobileMatch = clients.find((client) => client.mobileNumber === normalizedMobileNumber);

    if (mobileMatch) {
      return mobileMatch;
    }
  }

  return null;
};

export const clientPlatformService = {
  async createClient(input: CreateClientInput): Promise<ClientRecord> {
    const now = new Date().toISOString();
    const normalizedEmail = normalizeClientEmail(input.email);
    const normalizedMobileNumber = normalizeClientMobileNumber(input.mobileNumber);

    if (normalizedEmail || normalizedMobileNumber) {
      const existingClient = await findClientByLoginInput({
        email: normalizedEmail,
        mobileNumber: normalizedMobileNumber
      });

      if (existingClient) {
        throw new HttpError(409, platformClientAuthMessages.accountExists);
      }
    }

    const client: ClientRecord = {
      id: randomUUID(),
      adminToken: randomUUID(),
      email: normalizedEmail || buildFallbackEmail(input.provider),
      mobileNumber: normalizedMobileNumber,
      businessPhoneNumber: '',
      provider: input.provider,
      businessName: '',
      website: '',
      profileImageUrl: '',
      serviceTypes: [],
      services: [],
      products: [],
      productSales: [],
      packagePlans: [],
      loyaltyProgram: null,
      businessSettings: normalizeBusinessSettings(undefined),
      customerProfiles: [],
      teamMembers: [],
      accountType: null,
      serviceLocation: [],
      venueAddress: '',
      preferredLanguage: null,
      onboardingCompleted: false,
      createdAt: now,
      updatedAt: now
    };

    await clientPlatformRepository.saveClient(client);
    return client;
  },

  async loginClient(
    input: Pick<CreateClientInput, 'email' | 'mobileNumber'>
  ): Promise<{ client: ClientRecord; nextStep: string }> {
    const client = await findClientByLoginInput(input);

    if (!client) {
      throw new HttpError(404, platformClientAuthMessages.accountNotFound);
    }

    return {
      client,
      nextStep: getNextClientStep(client)
    };
  },

  logoutClient(clientId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      adminToken: randomUUID(),
      updatedAt: new Date().toISOString()
    }));
  },

  getClient(clientId: string): Promise<ClientRecord> {
    return getClientOrThrow(clientId);
  },

  async getPublicSalons(): Promise<PublicSalonShowcaseItem[]> {
    await ensureDemoSalons();
    const clients = await clientPlatformRepository.listClients();
    const visibleClients = clients
      .map(hydrateClientRecord)
      .filter((client) => client.onboardingCompleted && client.businessName.trim().length > 0)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

    return Promise.all(
      visibleClients.map(async (client) => {
        const services = await appointmentService.getServiceCatalogForBusiness(client.id);
        const reviews = await appointmentService.listReviewsForBusiness(client.id);

        return {
          clientId: client.id,
          businessName: client.businessName,
          serviceTypes: client.serviceTypes,
          serviceLocation: client.serviceLocation,
          venueAddress: client.venueAddress,
          bookingLink: `/book/${client.id}`,
          reviewSummary: reviews.summary,
          services: services.slice(0, 3).map((service) => ({
            name: service.name,
            durationMinutes: service.durationMinutes,
            priceLabel: service.priceLabel
          }))
        };
      })
    );
  },

  updateBusinessProfile(clientId: string, input: BusinessProfileInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      businessName: input.businessName.trim(),
      website: input.website?.trim() ?? '',
      businessPhoneNumber: input.businessPhoneNumber?.trim() ?? '',
      profileImageUrl: input.profileImageUrl?.trim() ?? '',
      venueAddress: input.venueAddress?.trim() ?? client.venueAddress,
      updatedAt: new Date().toISOString()
    }));
  },

  updateServiceTypes(clientId: string, input: ServiceTypesInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      serviceTypes: input.serviceTypes,
      services: syncBusinessServicesWithTypes(
        input.serviceTypes,
        client.services,
        getServiceTemplateOptions(client.businessSettings)
      ),
      updatedAt: new Date().toISOString()
    }));
  },

  updateBusinessSettings(
    clientId: string,
    input: UpdateBusinessSettingsInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const businessSettings = normalizeBusinessSettings({
        ...client.businessSettings,
        ...input,
        reportMetadata: {
          ...client.businessSettings?.reportMetadata,
          ...input.reportMetadata
        }
      });
      const nextServices =
        client.services.length === 0
          ? normalizeBusinessServices(
              client.serviceTypes,
              [],
              getServiceTemplateOptions(businessSettings)
            )
          : normalizeBusinessServices(
              client.serviceTypes,
              client.services,
              getServiceTemplateOptions(businessSettings)
            );

      return {
        ...client,
        businessSettings,
        services: nextServices,
        updatedAt: new Date().toISOString()
      };
    });
  },

  updateAccountType(clientId: string, input: AccountTypeInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      accountType: input.accountType,
      updatedAt: new Date().toISOString()
    }));
  },

  updateServiceLocation(
    clientId: string,
    input: ServiceLocationInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      serviceLocation: normalizeServiceLocations(input.serviceLocation),
      updatedAt: new Date().toISOString()
    }));
  },

  updateVenueLocation(clientId: string, input: VenueLocationInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      venueAddress: input.venueAddress.trim(),
      updatedAt: new Date().toISOString()
    }));
  },

  updatePreferredLanguage(
    clientId: string,
    input: UpdatePreferredLanguageInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      preferredLanguage: input.preferredLanguage,
      updatedAt: new Date().toISOString()
    }));
  },

  addTeamMember(clientId: string, input: CreateTeamMemberInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();
      const nextTeamMember = sanitizeTeamMember(
        {
          id: randomUUID(),
          name: input.name,
          role: input.role?.trim() || getDefaultTeamMemberRole(client),
          phone: input.phone,
          expertise: input.expertise,
          openingTime: input.openingTime,
          closingTime: input.closingTime,
          offDays: input.offDays,
          isActive: true,
          createdAt: now,
          updatedAt: now
        },
        client.teamMembers.length,
        client.businessSettings
      );

      return {
        ...client,
        teamMembers: nextTeamMember
          ? [...client.teamMembers, nextTeamMember]
          : [...client.teamMembers],
        updatedAt: now
      };
    });
  },

  updateTeamMember(
    clientId: string,
    teamMemberId: string,
    input: UpdateTeamMemberInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingTeamMember = client.teamMembers.find((teamMember) => teamMember.id === teamMemberId);

      if (!existingTeamMember) {
        throw new HttpError(404, 'Team member not found');
      }

      const now = new Date().toISOString();
      const nextTeamMember = sanitizeTeamMember(
        {
          ...existingTeamMember,
          name: input.name,
          role: input.role?.trim() || existingTeamMember.role || getDefaultTeamMemberRole(client),
          phone: input.phone,
          expertise: input.expertise,
          openingTime: input.openingTime,
          closingTime: input.closingTime,
          offDays: input.offDays,
          updatedAt: now
        },
        client.teamMembers.findIndex((teamMember) => teamMember.id === teamMemberId),
        client.businessSettings
      );

      if (!nextTeamMember) {
        throw new HttpError(400, 'Team member name is required');
      }

      return {
        ...client,
        teamMembers: client.teamMembers.map((teamMember) =>
          teamMember.id === teamMemberId ? nextTeamMember : teamMember
        ),
        updatedAt: now
      };
    });
  },

  removeTeamMember(clientId: string, teamMemberId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingTeamMember = client.teamMembers.find((teamMember) => teamMember.id === teamMemberId);

      if (!existingTeamMember) {
        throw new HttpError(404, 'Team member not found');
      }

      const now = new Date().toISOString();

      return {
        ...client,
        teamMembers: client.teamMembers.map((teamMember) =>
          teamMember.id === teamMemberId
            ? {
                ...teamMember,
                isActive: false,
                updatedAt: now
              }
            : teamMember
        ),
        updatedAt: now
      };
    });
  },

  addService(clientId: string, input: CreateBusinessServiceInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => ({
      ...client,
      services: normalizeBusinessServices(
        client.serviceTypes,
        [
          ...client.services,
          {
            id: randomUUID(),
            name: input.name.trim(),
            durationMinutes: input.durationMinutes,
            categoryName: input.categoryName?.trim() || client.serviceTypes[0]?.trim() || 'General',
            priceLabel: input.priceLabel.trim(),
            description: input.description?.trim() ?? '',
            isActive: true
          }
        ],
        getServiceTemplateOptions(client.businessSettings)
      ),
      updatedAt: new Date().toISOString()
    }));
  },

  updateService(
    clientId: string,
    serviceId: string,
    input: UpdateBusinessServiceInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingService = client.services.find((service) => service.id === serviceId);

      if (!existingService) {
        throw new HttpError(404, 'Service not found');
      }

      return {
        ...client,
        services: normalizeBusinessServices(
          client.serviceTypes,
          client.services.map((service) =>
            service.id === serviceId
              ? {
                  ...service,
                  name: input.name.trim(),
                  durationMinutes: input.durationMinutes,
                  categoryName:
                    input.categoryName?.trim() || existingService.categoryName || client.serviceTypes[0]?.trim() || 'General',
                  priceLabel: input.priceLabel.trim(),
                  description: input.description?.trim() ?? '',
                  isActive: service.isActive !== false
                }
              : service
          ),
          getServiceTemplateOptions(client.businessSettings)
        ),
        updatedAt: new Date().toISOString()
      };
    });
  },

  removeService(clientId: string, serviceId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingService = client.services.find((service) => service.id === serviceId);

      if (!existingService) {
        throw new HttpError(404, 'Service not found');
      }

      return {
        ...client,
        services: normalizeBusinessServices(
          client.serviceTypes,
          client.services.map((service) =>
            service.id === serviceId
              ? {
                  ...service,
                  isActive: false
                }
              : service
          ),
          getServiceTemplateOptions(client.businessSettings)
        ),
        updatedAt: new Date().toISOString()
      };
    });
  },

  createProduct(clientId: string, input: CreateProductInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();

      return {
        ...client,
        products: normalizeProducts([
          ...(client.products ?? []),
          {
            id: randomUUID(),
            name: input.name.trim(),
            categoryName: input.categoryName?.trim() || client.serviceTypes[0]?.trim() || 'Retail',
            sku: input.sku?.trim() ?? '',
            priceLabel: input.priceLabel.trim(),
            stockQuantity: Math.max(0, Math.floor(input.stockQuantity)),
            description: input.description?.trim() ?? '',
            isActive: true,
            createdAt: now,
            updatedAt: now
          }
        ]),
        updatedAt: now
      };
    });
  },

  updateProduct(clientId: string, productId: string, input: UpdateProductInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingProduct = client.products.find((product) => product.id === productId);

      if (!existingProduct) {
        throw new HttpError(404, 'Product not found');
      }

      const now = new Date().toISOString();

      return {
        ...client,
        products: normalizeProducts(
          client.products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  name: input.name.trim(),
                  categoryName:
                    input.categoryName?.trim() || existingProduct.categoryName || client.serviceTypes[0]?.trim() || 'Retail',
                  sku: input.sku?.trim() ?? '',
                  priceLabel: input.priceLabel.trim(),
                  stockQuantity: Math.max(0, Math.floor(input.stockQuantity)),
                  description: input.description?.trim() ?? '',
                  isActive: product.isActive !== false,
                  updatedAt: now
                }
              : product
          )
        ),
        updatedAt: now
      };
    });
  },

  removeProduct(clientId: string, productId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingProduct = client.products.find((product) => product.id === productId);

      if (!existingProduct) {
        throw new HttpError(404, 'Product not found');
      }

      const now = new Date().toISOString();

      return {
        ...client,
        products: normalizeProducts(
          client.products.map((product) =>
            product.id === productId
              ? {
                  ...product,
                  isActive: false,
                  updatedAt: now
                }
              : product
          )
        ),
        updatedAt: now
      };
    });
  },

  sellProduct(clientId: string, input: SellProductInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingProduct = normalizeProducts(client.products ?? []).find(
        (product) => product.id === input.productId
      );

      if (!existingProduct || existingProduct.isActive === false) {
        throw new HttpError(404, 'Product not found');
      }

      const quantity = Math.max(1, Math.floor(input.quantity));

      if (existingProduct.stockQuantity < quantity) {
        throw new HttpError(409, 'Not enough stock available for this product');
      }

      const now = new Date().toISOString();
      const businessSettings = normalizeBusinessSettings(client.businessSettings);
      const unitMoney = parseMoneyLabel(existingProduct.priceLabel, businessSettings.currencyCode);
      const totalAmountValue = unitMoney.amountValue * quantity;
      const totalPriceLabel = formatMoneyLabel(
        totalAmountValue,
        unitMoney.currencyCode,
        businessSettings.currencyLocale
      );

      return {
        ...client,
        products: normalizeProducts(
          client.products.map((product) =>
            product.id === existingProduct.id
              ? {
                  ...product,
                  stockQuantity: Math.max(0, product.stockQuantity - quantity),
                  updatedAt: now
                }
              : product
          )
        ),
        productSales: normalizeProductSales([
          ...(client.productSales ?? []),
          {
            id: randomUUID(),
            productId: existingProduct.id,
            productName: existingProduct.name,
            sku: existingProduct.sku,
            quantity,
            unitPriceLabel: existingProduct.priceLabel,
            totalPriceLabel,
            customerName: input.customerName.trim(),
            customerPhone: input.customerPhone.trim(),
            customerEmail: input.customerEmail?.trim() ?? '',
            soldAt: now,
            createdAt: now,
            updatedAt: now
          }
        ]),
        updatedAt: now
      };
    });
  },

  createPackagePlan(clientId: string, input: CreatePackagePlanInput): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();

      return {
        ...client,
        packagePlans: normalizePackagePlans([
          ...(client.packagePlans ?? []),
          {
            id: randomUUID(),
            name: input.name.trim(),
            includedServiceIds: input.includedServiceIds ?? [],
            totalUses: input.totalUses,
            priceLabel: input.priceLabel.trim(),
            isActive: true,
            createdAt: now,
            updatedAt: now
          }
        ]),
        updatedAt: now
      };
    });
  },

  updatePackagePlan(
    clientId: string,
    packagePlanId: string,
    input: UpdatePackagePlanInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingPackagePlan = client.packagePlans.find((packagePlan) => packagePlan.id === packagePlanId);

      if (!existingPackagePlan) {
        throw new HttpError(404, 'Package plan not found');
      }

      return {
        ...client,
        packagePlans: normalizePackagePlans(
          client.packagePlans.map((packagePlan) =>
            packagePlan.id === packagePlanId
              ? {
                  ...packagePlan,
                  name: input.name.trim(),
                  includedServiceIds: input.includedServiceIds ?? [],
                  totalUses: input.totalUses,
                  priceLabel: input.priceLabel.trim(),
                  isActive: packagePlan.isActive !== false,
                  updatedAt: new Date().toISOString()
                }
              : packagePlan
          )
        ),
        updatedAt: new Date().toISOString()
      };
    });
  },

  removePackagePlan(clientId: string, packagePlanId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const existingPackagePlan = client.packagePlans.find((packagePlan) => packagePlan.id === packagePlanId);

      if (!existingPackagePlan) {
        throw new HttpError(404, 'Package plan not found');
      }

      return {
        ...client,
        packagePlans: normalizePackagePlans(
          client.packagePlans.map((packagePlan) =>
            packagePlan.id === packagePlanId
              ? {
                  ...packagePlan,
                  isActive: false,
                  updatedAt: new Date().toISOString()
                }
              : packagePlan
          )
        ),
        updatedAt: new Date().toISOString()
      };
    });
  },

  updateLoyaltyProgram(
    clientId: string,
    input: UpdateLoyaltyProgramInput
  ): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const now = new Date().toISOString();

      return {
        ...client,
        loyaltyProgram: normalizeLoyaltyProgram({
          id: client.loyaltyProgram?.id ?? 'loyalty-program',
          isEnabled: input.isEnabled,
          triggerCompletedVisits: input.triggerCompletedVisits,
          rewardType: 'discount_percent',
          rewardValue: input.rewardValue,
          includedServiceIds: input.includedServiceIds ?? [],
          createdAt: client.loyaltyProgram?.createdAt ?? now,
          updatedAt: now
        }),
        updatedAt: now
      };
    });
  },

  completeOnboarding(clientId: string): Promise<ClientRecord> {
    return updateClient(clientId, (client) => {
      const incompleteOnboardingPath = getNextIncompleteOnboardingPath(client);

      if (incompleteOnboardingPath) {
        throw new HttpError(409, 'Complete the required onboarding steps before finishing setup');
      }

      return {
        ...client,
        onboardingCompleted: true,
        updatedAt: new Date().toISOString()
      };
    });
  },

  async getLaunchLinks(clientId: string, origin: string): Promise<LaunchLinksViewModel> {
    await getClientOrThrow(clientId);
    return buildLaunchLinks(clientId, origin);
  },

  async getDashboard(clientId: string, origin: string): Promise<{
    client: ClientRecord;
    dashboard: DashboardViewModel;
  }> {
    const client = await getClientOrThrow(clientId);
    const [appointmentsForBusiness, launchLinks, commerce] = await Promise.all([
      appointmentService.listAppointmentsForBusiness(clientId),
      buildLaunchLinks(clientId, origin),
      appointmentService.getDashboardCommerce(clientId)
    ]);
    const customerProfiles = buildCustomerProfilesFromAppointments(appointmentsForBusiness);
    const hasCustomerProfileChanges =
      JSON.stringify(customerProfiles) !== JSON.stringify(client.customerProfiles ?? []);
    const syncedClient = hasCustomerProfileChanges
      ? hydrateClientRecord({
          ...client,
          customerProfiles,
          updatedAt: new Date().toISOString()
        })
      : client;

    if (hasCustomerProfileChanges) {
      await clientPlatformRepository.saveClient(syncedClient);
    }

    const appointments = appointmentsForBusiness.map(
      (appointment) => ({
        id: appointment.id,
        customerName: appointment.customerName,
        serviceName: appointment.serviceName,
        teamMemberName: appointment.teamMemberName,
        appointmentDate: appointment.appointmentDate,
        appointmentTime: appointment.appointmentTime,
        status: appointment.status,
        source: appointment.source
      })
    );

    return {
      client: syncedClient,
      dashboard: buildDashboardViewModel(
        syncedClient,
        appointments,
        appointmentsForBusiness,
        launchLinks,
        {
          ...commerce,
          ...buildProductCommerceView(syncedClient)
        }
      )
    };
  }
};

export const serializeClientForResponse = (client: ClientRecord): PublicClientRecord =>
  toPublicClientRecord(hydrateClientRecord(client));


