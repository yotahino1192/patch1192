import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
// Pure checks shared by Xcode's preflight, final bundle validation and unit tests.
export function validateNativeConfig(config, appId) {
    if (!appId || config.appId !== appId || config.appName !== 'Patch' || config.webDir !== 'dist/mobile')
        throw new Error('IOS_CAPACITOR_IDENTITY_MISMATCH');
    // A server override can make a sealed local bundle irrelevant at runtime.
    if (config.server && Object.keys(config.server).length)
        throw new Error('IOS_SERVER_OVERRIDE_FORBIDDEN');
    if (config.ios?.webContentsDebuggingEnabled === true)
        throw new Error('IOS_UNREVIEWED_WEBVIEW_OVERRIDE');
}
export function validateBundleInfo(app, widget) {
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(app.CFBundleShortVersionString || '') || !/^[1-9]\d*$/.test(app.CFBundleVersion || ''))
        throw new Error('IOS_VERSION_INVALID');
    if (widget.CFBundleShortVersionString !== app.CFBundleShortVersionString || widget.CFBundleVersion !== app.CFBundleVersion)
        throw new Error('IOS_WIDGET_VERSION_MISMATCH');
    if (widget.CFBundleIdentifier !== `${app.CFBundleIdentifier}.widget`)
        throw new Error('IOS_WIDGET_IDENTITY_MISMATCH');
    if (String(app.CAPACITOR_DEBUG).toLowerCase() === 'true') throw new Error('IOS_DEBUG_ENABLED');
    const schemes = (app.CFBundleURLTypes || []).flatMap(value => value.CFBundleURLSchemes || []);
    if (!schemes.includes('patch')) throw new Error('IOS_PATCH_SCHEME_MISSING');
    if (!app.CFBundleIcons?.CFBundlePrimaryIcon || app.UILaunchStoryboardName !== 'LaunchScreen')
        throw new Error('IOS_ASSETS_MISSING');
    if (app.NSAppTransportSecurity?.NSAllowsArbitraryLoads || app.NSAppTransportSecurity?.NSAllowsArbitraryLoadsInWebContent)
        throw new Error('IOS_ATS_BYPASS');
    for (const key of ['NSCameraUsageDescription', 'NSMicrophoneUsageDescription', 'NSPhotoLibraryUsageDescription', 'NSPhotoLibraryAddUsageDescription', 'UIBackgroundModes']) {
        if (key in app) throw new Error('IOS_UNREVIEWED_CAPABILITY');
    }
    if (app.DTPlatformName !== 'iphoneos' || !/^iphoneos(2[6-9]|[3-9]\d)\./.test(app.DTSDKName || ''))
        throw new Error('IOS_DISTRIBUTION_SDK_REQUIRED');
}

// Capacitor 8 creates these empty files when no Cordova plugins are installed.
// Seal them before sync, so the copied bundle has exactly the same inventory.
export async function prepareCapacitorStubs(root) {
    for (const name of ['cordova.js', 'cordova_plugins.js']) {
        const path = join(root, name);
        try {
            if ((await readFile(path)).length) throw new Error('IOS_CORDOVA_PLUGINS_REQUIRE_REVIEW');
        } catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        await writeFile(path, '');
    }
}
