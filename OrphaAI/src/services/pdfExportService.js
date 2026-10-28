import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileOpener } from "@capacitor-community/file-opener";

function safeFilename(filename) {
  return String(filename || "orphaai-report.pdf").replace(/[\\/:*?"<>|]+/g, "_");
}

export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result).split(",")[1] || "");
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function uniqueReportFilename(prefix = "report") {
  const timestamp = new Date()
    .toISOString()
    .slice(0, 16)
    .replace("T", "_")
    .replace(":", "-");
  return `${safeFilename(prefix).replace(/_+$/g, "")}_${timestamp}.pdf`;
}

export async function downloadPdfReport(filename, content) {
  const cleanName = safeFilename(filename);
  const blob = content instanceof Blob ? content : new Blob([content], { type: "application/pdf" });

  if (Capacitor.isNativePlatform()) {
    const base64Data = await blobToBase64(blob);
    const savedFile = await Filesystem.writeFile({
      path: cleanName,
      data: base64Data,
      directory: Directory.Documents,
      recursive: true,
    });

    try {
      await FileOpener.open({
        filePath: savedFile.uri,
        contentType: "application/pdf",
      });
    } catch (openErr) {
      console.warn("[OrphaAI] FileOpener failed to open PDF viewer:", openErr);
    }
    return `Documents/${cleanName}`;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = cleanName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return cleanName;
}

