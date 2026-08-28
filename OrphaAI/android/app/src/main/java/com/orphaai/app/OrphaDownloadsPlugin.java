package com.orphaai.app;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.OutputStream;

@CapacitorPlugin(name = "OrphaDownloads")
public class OrphaDownloadsPlugin extends Plugin {
    @PluginMethod
    public void savePdfToDownloads(PluginCall call) {
        String filename = call.getString("filename", "orphaai_report.pdf");
        String base64Data = call.getString("base64Data", "");
        String subdirectory = call.getString("subdirectory", "OrphaAI");

        if (base64Data.isEmpty()) {
            call.reject("PDF data is empty.");
            return;
        }

        try {
            byte[] pdfBytes = Base64.decode(base64Data, Base64.DEFAULT);
            ContentResolver resolver = getContext().getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "application/pdf");

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/" + subdirectory);
                values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            }

            Uri collection = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                ? MediaStore.Downloads.EXTERNAL_CONTENT_URI
                : MediaStore.Files.getContentUri("external");
            Uri itemUri = resolver.insert(collection, values);

            if (itemUri == null) {
                call.reject("Could not create file in Downloads.");
                return;
            }

            try (OutputStream stream = resolver.openOutputStream(itemUri)) {
                if (stream == null) {
                    call.reject("Could not open output stream for report.");
                    return;
                }
                stream.write(pdfBytes);
                stream.flush();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentValues completeValues = new ContentValues();
                completeValues.put(MediaStore.MediaColumns.IS_PENDING, 0);
                resolver.update(itemUri, completeValues, null, null);
            }

            JSObject result = new JSObject();
            result.put("uri", itemUri.toString());
            result.put("path", "Downloads/" + subdirectory + "/" + filename);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("Report save failed: " + error.getMessage(), error);
        }
    }
}
