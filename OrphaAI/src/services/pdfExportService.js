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
