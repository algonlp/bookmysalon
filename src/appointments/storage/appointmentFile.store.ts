import { constants } from 'fs';
import { access, mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, resolve } from 'path';
import type {
  AppointmentRecord,
  LoyaltyRewardRecord,
  PaymentRecord,
  PackagePurchaseRecord,
  ReviewRecord,
  WaitlistRecord
} from '../appointment.types';
import {
  createDefaultAppointmentState,
  type AppointmentState,
  type AppointmentStore
} from '../appointment.store';

export class AppointmentFileStore implements AppointmentStore {
  private readonly storagePath: string;
  private state: AppointmentState = createDefaultAppointmentState();
  private loaded = false;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(storagePath = resolve(process.cwd(), 'data', 'appointments.json')) {
    this.storagePath = storagePath;
  }

  private async loadStateFromDisk(): Promise<void> {
    await this.ensureStorageFile();

    const rawState = await readFile(this.storagePath, 'utf-8');
    const parsedState = rawState.trim()
      ? (JSON.parse(rawState) as Partial<AppointmentState>)
      : createDefaultAppointmentState();
    this.state = {
      appointments: parsedState.appointments ?? [],
      paymentRecords: parsedState.paymentRecords ?? [],
      reviews: parsedState.reviews ?? [],
      packagePurchases: parsedState.packagePurchases ?? [],
      loyaltyRewards: parsedState.loyaltyRewards ?? [],
      waitlistEntries: parsedState.waitlistEntries ?? []
    };
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) {
      return;
    }

    await this.loadStateFromDisk();
  }

  private async withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
    const nextOperation = this.writeChain.then(operation, operation);
    this.writeChain = nextOperation.then(
      () => undefined,
      () => undefined
    );
    return nextOperation;
  }

  private async ensureStorageFile(): Promise<void> {
    try {
      await access(this.storagePath, constants.F_OK);
    } catch {
      await mkdir(dirname(this.storagePath), { recursive: true });
      await writeFile(
        this.storagePath,
        JSON.stringify(createDefaultAppointmentState(), null, 2),
        'utf-8'
      );
    }
  }

  private async persist(): Promise<void> {
    await mkdir(dirname(this.storagePath), { recursive: true });
    await writeFile(this.storagePath, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  async listAppointments(): Promise<AppointmentRecord[]> {
    await this.ensureLoaded();
    return [...this.state.appointments];
  }

  async listPaymentRecords(): Promise<PaymentRecord[]> {
    await this.ensureLoaded();
    return [...this.state.paymentRecords];
  }

  async listReviews(): Promise<ReviewRecord[]> {
    await this.ensureLoaded();
    return [...this.state.reviews];
  }

  async listPackagePurchases(): Promise<PackagePurchaseRecord[]> {
    await this.ensureLoaded();
    return [...this.state.packagePurchases];
  }

  async listLoyaltyRewards(): Promise<LoyaltyRewardRecord[]> {
    await this.ensureLoaded();
    return [...this.state.loyaltyRewards];
  }

  async listWaitlistEntries(): Promise<WaitlistRecord[]> {
    await this.ensureLoaded();
    return [...this.state.waitlistEntries];
  }

  async saveAppointment(appointment: AppointmentRecord): Promise<AppointmentRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();

      const existingIndex = this.state.appointments.findIndex((entry) => entry.id === appointment.id);

      if (existingIndex >= 0) {
        this.state.appointments[existingIndex] = appointment;
      } else {
        this.state.appointments.push(appointment);
      }

      await this.persist();
      return appointment;
    });
  }

  async savePaymentRecord(paymentRecord: PaymentRecord): Promise<PaymentRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();

      const existingIndex = this.state.paymentRecords.findIndex((entry) => entry.id === paymentRecord.id);

      if (existingIndex >= 0) {
        this.state.paymentRecords[existingIndex] = paymentRecord;
      } else {
        this.state.paymentRecords.push(paymentRecord);
      }

      await this.persist();
      return paymentRecord;
    });
  }

  async saveReview(review: ReviewRecord): Promise<ReviewRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();

      const existingIndex = this.state.reviews.findIndex((entry) => entry.id === review.id);

      if (existingIndex >= 0) {
        this.state.reviews[existingIndex] = review;
      } else {
        this.state.reviews.push(review);
      }

      await this.persist();
      return review;
    });
  }

  async savePackagePurchase(packagePurchase: PackagePurchaseRecord): Promise<PackagePurchaseRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();

      const existingIndex = this.state.packagePurchases.findIndex(
        (entry) => entry.id === packagePurchase.id
      );

      if (existingIndex >= 0) {
        this.state.packagePurchases[existingIndex] = packagePurchase;
      } else {
        this.state.packagePurchases.push(packagePurchase);
      }

      await this.persist();
      return packagePurchase;
    });
  }

  async saveLoyaltyReward(loyaltyReward: LoyaltyRewardRecord): Promise<LoyaltyRewardRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();

      const existingIndex = this.state.loyaltyRewards.findIndex(
        (entry) => entry.id === loyaltyReward.id
      );

      if (existingIndex >= 0) {
        this.state.loyaltyRewards[existingIndex] = loyaltyReward;
      } else {
        this.state.loyaltyRewards.push(loyaltyReward);
      }

      await this.persist();
      return loyaltyReward;
    });
  }

  async saveWaitlistEntry(waitlistEntry: WaitlistRecord): Promise<WaitlistRecord> {
    return this.withWriteLock(async () => {
      await this.loadStateFromDisk();

      const existingIndex = this.state.waitlistEntries.findIndex(
        (entry) => entry.id === waitlistEntry.id
      );

      if (existingIndex >= 0) {
        this.state.waitlistEntries[existingIndex] = waitlistEntry;
      } else {
        this.state.waitlistEntries.push(waitlistEntry);
      }

      await this.persist();
      return waitlistEntry;
    });
  }

  async reset(): Promise<void> {
    await this.withWriteLock(async () => {
      this.state = createDefaultAppointmentState();
      this.loaded = true;
      await this.persist();
    });
  }
}
