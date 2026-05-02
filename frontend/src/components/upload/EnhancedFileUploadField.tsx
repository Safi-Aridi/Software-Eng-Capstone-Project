import { useState, useEffect, useRef } from "react";

const getExt = (file: File) => file.name.split(".").pop()?.toLowerCase() ?? "";
const isImageExt = (ext: string) => ["jpg", "jpeg", "png"].includes(ext);

interface Props {
  id: string;
  label: string;
  accept: string;
  acceptLabel: string;
  file: File | null;
  stepError?: string;
  required?: boolean;
  validator: (f: File) => boolean;
  typeErrorMsg: string;
  onChange: (file: File | null) => void;
  onClear: () => void;
}

const EnhancedFileUploadField = ({
  id,
  label,
  accept,
  acceptLabel,
  file,
  stepError,
  required,
  validator,
  typeErrorMsg,
  onChange,
  onClear,
}: Props) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [typeError, setTypeError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // When parent clears the file, reset all local state
  useEffect(() => {
    if (!file) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewUrl(null);
      }
      setLocalFile(null);
      setProgress(null);
      setTypeError("");
    }
  }, [file]);

  // Revoke object URL on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const processFile = (incoming: File) => {
    if (!validator(incoming)) {
      setTypeError(typeErrorMsg);
      return;
    }
    setTypeError("");

    // Cancel any in-flight upload
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setLocalFile(incoming);

    const ext = getExt(incoming);
    if (isImageExt(ext)) {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      const url = URL.createObjectURL(incoming);
      previewUrlRef.current = url;
      setPreviewUrl(url);
    } else {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }

    setProgress(0);
    let p = 0;
    const step = 100 / 15; // 15 ticks × 100 ms = 1.5 s
    intervalRef.current = setInterval(() => {
      p = Math.min(p + step, 100);
      setProgress(Math.round(p));
      if (p >= 100) {
        clearInterval(intervalRef.current!);
        intervalRef.current = null;
        onChange(incoming);
      }
    }, 100);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) processFile(f);
    e.target.value = ""; // allow re-selecting the same file
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f) processFile(f);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleClear = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
      setPreviewUrl(null);
    }
    setLocalFile(null);
    setProgress(null);
    setTypeError("");
    onClear();
  };

  const isUploading = progress !== null && progress < 100;
  const displayFile = file; // parent is the source of truth after simulation

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Idle or drag zone */}
      {!displayFile && !isUploading && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors
            ${isDragActive
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-blue-400 hover:bg-gray-50"
            }`}
        >
          <svg
            className="w-8 h-8 text-gray-400 mx-auto mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          {isDragActive ? (
            <p className="text-blue-600 text-sm font-medium">Drop file here</p>
          ) : (
            <>
              <p className="text-gray-500 text-sm mb-2">
                Drag & drop a file here, or
              </p>
              <input
                type="file"
                id={id}
                accept={accept}
                className="hidden"
                onChange={handleInputChange}
              />
              <label
                htmlFor={id}
                className="cursor-pointer inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
              >
                Choose File
              </label>
            </>
          )}
          <p className="text-xs text-gray-400 mt-2">Accepted: {acceptLabel}</p>
        </div>
      )}

      {/* Progress bar during upload simulation */}
      {isUploading && localFile && (
        <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <svg
              className="w-4 h-4 text-blue-500 mr-2 animate-pulse"
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z" />
            </svg>
            <span className="text-sm text-blue-700 font-medium truncate">
              Uploading {localFile.name}...
            </span>
          </div>
          <div className="w-full bg-blue-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-xs text-blue-500 mt-1 text-right">{progress}%</p>
        </div>
      )}

      {/* Completed state — show file info + preview */}
      {displayFile && (
        <div className="border-2 border-green-400 bg-green-50 rounded-lg p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3 min-w-0">
              {/* Image thumbnail or PDF icon */}
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-14 h-14 object-cover rounded border border-green-300 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 bg-red-100 border border-red-200 rounded flex flex-col items-center justify-center shrink-0">
                  <span className="text-red-600 font-bold text-xs">PDF</span>
                  <svg
                    className="w-5 h-5 text-red-400 mt-0.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-green-600 text-sm">✓</span>
                  <span className="text-sm font-medium text-gray-700">
                    Upload complete
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate mt-0.5">
                  {displayFile.name}
                </p>
              </div>
            </div>

            <button
              onClick={handleClear}
              className="text-xs text-red-500 hover:text-red-700 shrink-0 mt-0.5"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {typeError && <p className="text-red-600 text-xs mt-1">{typeError}</p>}
      {!typeError && stepError && (
        <p className="text-red-600 text-xs mt-1">{stepError}</p>
      )}
    </div>
  );
};

export default EnhancedFileUploadField;
