import { apiClient } from "./apiClient";
import type { PassportApplication } from "./applicationService";

const USE_MOCK = import.meta.env.VITE_USE_MOCK_APPLICATIONS === "true";

export type DocumentField = keyof PassportApplication["documents"];

type UploadResponse = {
  success: boolean;
  fileUrl: string;
};

const FIELD_TO_BACKEND_TYPE: Record<DocumentField, string> = {
  identityDocument: "identity_document",
  passportPhoto: "passport_photo",
  oldPassport: "old_passport",
};

export const documentService = {
  uploadDocument: async (
    applicationId: string,
    documentField: DocumentField,
    file: File,
  ): Promise<string> => {
    if (USE_MOCK) return file.name;

    const form = new FormData();
    form.append("file", file);
    form.append("applicationId", applicationId);
    form.append("documentType", FIELD_TO_BACKEND_TYPE[documentField]);

    const response = await apiClient.postForm<UploadResponse>(
      "/documents/upload",
      form,
    );
    return response.fileUrl;
  },

  uploadDocuments: async (
    applicationId: string,
    files: Partial<Record<DocumentField, File | null>>,
  ): Promise<PassportApplication["documents"]> => {
    const uploaded: PassportApplication["documents"] = {
      identityDocument: null,
      passportPhoto: null,
      oldPassport: null,
    };

    const entries = Object.entries(files) as [DocumentField, File | null][];
    await Promise.all(
      entries.map(async ([field, file]) => {
        if (!file) return;
        uploaded[field] = await documentService.uploadDocument(
          applicationId,
          field,
          file,
        );
      }),
    );

    return uploaded;
  },
};
