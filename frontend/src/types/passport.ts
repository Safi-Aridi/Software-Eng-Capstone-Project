// Passport entity — created at the ISSUED state by the GS Officer.
// Drives the citizen-facing expiry banner. See passportService for CRUD.

export type PassportStatus = "ACTIVE" | "CANCELLED";

export interface Passport {
  passportId: string; // generated: LBPP-<8 digits>
  userId: string; // citizen who owns this passport
  sourceApplicationId: string; // application that produced this passport
  bookletNumber: string; // entered by Officer: format LB-<7 digits>
  status: PassportStatus;
  issuedAt: string; // ISO timestamp — set when Officer marks ISSUED
  expiresAt: string; // computed: issuedAt + passportValidity years
  cancelledAt: string | null;
  cancelledByApplicationId: string | null; // renewal app that cancelled it
}
