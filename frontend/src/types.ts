// Based on SRS Section 3.1 and the Relational Schema [cite: 237-253, 491]
export type ApplicationStatus = 
  | 'PENDING_VERIFICATION' 
  | 'VERIFIED' 
  | 'MUKHTAR_SIGNED' 
  | 'PROCESSED_FOR_ISSUANCE' 
  | 'DELIVERED';

export interface Application {
  application_id: string; // UUID from DB [cite: 493]
  full_name: string;
  registry_number: string;
  dob: string;
  status: ApplicationStatus;
  submission_date: string;
  ml_doc_check: boolean; // FR-20 [cite: 357-360]
}