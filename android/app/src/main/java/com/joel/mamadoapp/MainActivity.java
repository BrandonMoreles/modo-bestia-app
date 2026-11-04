package com.joel.mamadoapp;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ScreenTimePlugin.class);
        registerPlugin(PetWidgetPlugin.class);
        registerPlugin(MusicPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
