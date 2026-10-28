package com.orphaai.app;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(OrphaDownloadsPlugin.class);
        registerPlugin(com.codetrixstudio.capacitor.GoogleAuth.GoogleAuth.class);
        super.onCreate(savedInstanceState);
    }
}
