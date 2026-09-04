import { Capacitor, registerPlugin } from "@capacitor/core";

const NativeDownloads = registerPlugin("OrphaDownloads");

function isNativeAndroid() {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";
}

function safeFilename(filename) {
  return String(filename || "orphaai-report.pdf").replace(/[\\/:*?"<>|]+/g, "_");
}

function blobToBase64(blob) {
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
  const blob = new Blob([content], { type: "application/pdf" });

  if (isNativeAndroid()) {
    const data = await blobToBase64(blob);
    const result = await NativeDownloads.savePdfToDownloads({
      filename: cleanName,
      base64Data: data,
      subdirectory: "OrphaAI",
    });
    return result?.path || result?.uri || `Downloads/OrphaAI/${cleanName}`;
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
