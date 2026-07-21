import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

export function QrCode({ value, label }: { value: string; label: string }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { margin: 1, width: 400, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value]);

  if (!dataUrl) {
    return <p className="texto-suave">Gerando QR Code…</p>;
  }
  return <img className="qrcode" src={dataUrl} alt={label} />;
}
