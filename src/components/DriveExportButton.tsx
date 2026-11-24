import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react';
import {
  formatGoogleAuthError,
  uploadImageToGoogleDrive,
  type UploadedDriveFile,
} from '../utils/googleDriveAuth';

interface DriveExportButtonProps {
  source: string | (() => Promise<string> | string | null);
  fileNameBase: string;
  description?: string;
  label?: string;
  compact?: boolean;
  className?: string;
  onNotifyToast?: (msg: string) => void;
}

const GoogleDriveMark: React.FC<{ className?: string }> = ({
  className = 'w-3.5 h-3.5 shrink-0',
}) => (
  <svg
    className={className}
    viewBox="0 0 87.3 78"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
      fill="#0066da"
    />
    <path
      d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
      fill="#00ac47"
    />
    <path
      d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
      fill="#ea4335"
    />
    <path
      d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
      fill="#00832d"
    />
    <path
      d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
      fill="#2684fc"
    />
    <path
      d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
      fill="#ffba00"
    />
  </svg>
);

export const DriveExportButton: React.FC<DriveExportButtonProps> = ({
  source,
  fileNameBase,
  description,
  label = 'Guardar en Drive',
  compact = false,
  className = '',
  onNotifyToast,
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedDriveFile | null>(null);

  const handleUpload = async () => {
    setUploading(true);
    try {
      const resolved =
        typeof source === 'function' ? await source() : source;
      if (!resolved) {
        onNotifyToast?.('Primero selecciona o crea una imagen para guardar en Google Drive.');
        return;
      }
      const file = await uploadImageToGoogleDrive({
        source: resolved,
        fileNameBase,
        description,
      });
      setUploadedFile(file);
      onNotifyToast?.(
        `Guardado en Google Drive (carpeta "Kromacard Studio"): ${file.name}`
      );
    } catch (err) {
      onNotifyToast?.(formatGoogleAuthError(err));
    } finally {
      setUploading(false);
    }
  };

  if (uploadedFile && !compact) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => void handleUpload()}
          disabled={uploading}
          className="min-h-[38px] px-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-emerald-500/30 transition-colors"
        >
          {uploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          )}
          <span>En Drive</span>
        </button>
        {uploadedFile.webViewLink && (
          <a
            href={uploadedFile.webViewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="min-h-[38px] px-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-sky-300 text-xs font-semibold flex items-center gap-1"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Ver</span>
          </a>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={uploading}
      onClick={() => void handleUpload()}
      title="Exportar directamente a tu carpeta Kromacard Studio en Google Drive"
      className={
        className ||
        (compact
          ? 'min-h-[28px] px-2 rounded-lg bg-white/5 hover:bg-white/15 text-[10px] font-semibold text-emerald-300 flex items-center justify-center gap-1 disabled:opacity-60 transition-colors'
          : 'min-h-[38px] px-3.5 rounded-xl bg-white text-slate-950 hover:bg-slate-100 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-60 transition-colors shadow-sm')
      }
    >
      {uploading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
      ) : (
        <GoogleDriveMark className={compact ? 'w-3 h-3 shrink-0' : 'w-3.5 h-3.5 shrink-0'} />
      )}
      <span>{uploading ? 'Subiendo...' : uploadedFile && compact ? 'Listo' : label}</span>
    </button>
  );
};
