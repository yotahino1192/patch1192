import test from 'node:test';
import assert from 'node:assert/strict';
import { validateNativeConfig, validateBundleInfo } from '../scripts/infra/ios-release.mjs';
const config = { appId: 'com.patch.learning', appName: 'Patch', webDir: 'dist/mobile', ios: { contentInset: 'automatic' } };
const app = { CFBundleIdentifier: config.appId, CFBundleShortVersionString: '1.0', CFBundleVersion: '1', CFBundleURLTypes: [{ CFBundleURLSchemes: ['patch'] }], CFBundleIcons: { CFBundlePrimaryIcon: { CFBundleIconName: 'AppIcon' } }, UILaunchStoryboardName: 'LaunchScreen', DTPlatformName: 'iphoneos', DTSDKName: 'iphoneos26.1' };
const widget = { CFBundleIdentifier: `${config.appId}.widget`, CFBundleShortVersionString: '1.0', CFBundleVersion: '1' };
test('packaged config must use the sealed bundle, correct identity and no web inspector', () => {
    assert.doesNotThrow(() => validateNativeConfig(config, config.appId));
    for (const server of [{ url: 'https://remote.invalid' }, { cleartext: true }, { allowNavigation: ['*'] }, { hostname: 'other' }])
        assert.throws(() => validateNativeConfig({ ...config, server }, config.appId), /IOS_SERVER_OVERRIDE_FORBIDDEN/);
    assert.throws(() => validateNativeConfig(config, 'com.other.app'), /IDENTITY_MISMATCH/);
    assert.throws(() => validateNativeConfig({ ...config, ios: { webContentsDebuggingEnabled: true } }, config.appId), /WEBVIEW_OVERRIDE/);
});
test('distribution bundle rejects mismatched extension versions and unfinished resources', () => {
    assert.doesNotThrow(() => validateBundleInfo(app, widget));
    for (const change of [{ CFBundleVersion: '2' }, { CFBundleShortVersionString: '1.1' }, { CFBundleIdentifier: 'com.other.widget' }])
        assert.throws(() => validateBundleInfo(app, { ...widget, ...change }), /IOS_WIDGET_/);
    for (const change of [{ CFBundleVersion: '$(CURRENT_PROJECT_VERSION)' }, { CFBundleURLTypes: [] }, { CFBundleIcons: {} }, { CAPACITOR_DEBUG: 'true' }, { NSAppTransportSecurity: { NSAllowsArbitraryLoads: true } }, { NSCameraUsageDescription: 'unused' }, { UIBackgroundModes: [] }, { DTPlatformName: 'iphonesimulator' }, { DTSDKName: 'iphoneos18.5' }])
        assert.throws(() => validateBundleInfo({ ...app, ...change }, widget), /IOS_/);
});
test('Capacitor sync stubs stay inside the sealed inventory and tampering is detected', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const { prepareCapacitorStubs } = await import('../scripts/infra/ios-release.mjs');
    const { sealArtifact, validateArtifact } = await import('../scripts/infra/artifact.mjs');
    const root = await mkdtemp(join(tmpdir(), 'patch-ios-seal-'));
    try {
        await writeFile(join(root, 'index.html'), '<html>Patch</html>');
        await prepareCapacitorStubs(root);
        await sealArtifact(root, { env: 'development', apiOrigin: 'http://localhost:3001', clerkHost: '', clerkIssuer: '', publishableKey: '' }, { kind: 'mobile', mode: 'development' });
        // Simulate Capacitor's no-plugin sync; all bytes must still match.
        await writeFile(join(root, 'cordova.js'), '');
        await writeFile(join(root, 'cordova_plugins.js'), '');
        await validateArtifact(root, {}, 'development', { kind: 'mobile' });
        await writeFile(join(root, 'cordova.js'), 'unexpected code');
        await assert.rejects(validateArtifact(root, {}, 'development', { kind: 'mobile' }), /ARTIFACT_HASH_MISMATCH/);
        await assert.rejects(prepareCapacitorStubs(root), /IOS_CORDOVA_PLUGINS_REQUIRE_REVIEW/);
    } finally { await rm(root, { recursive: true, force: true }); }
});
