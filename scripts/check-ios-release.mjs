import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readPolicy } from '../lib/env/server.ts';
import { validateArtifact } from './infra/artifact.mjs';
import { validateNativeConfig, validateBundleInfo } from './infra/ios-release.mjs';
const args = process.argv.slice(2);
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
const plist = path => JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', path], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
async function manifests(root) {
    const result = [];
    for (const entry of await readdir(root, { withFileTypes: true })) {
        const path = join(root, entry.name);
        if (entry.isDirectory()) result.push(...await manifests(path));
        else if (entry.name === 'PrivacyInfo.xcprivacy') result.push(path);
    }
    return result;
}
try {
    if (option('--config')) {
        validateNativeConfig(JSON.parse(await readFile(option('--config'), 'utf8')), option('--bundle-id'));
        console.log('IOS_NATIVE_CONFIG_VALID');
    } else if (option('--app')) {
        const root = resolve(option('--app'));
        const app = plist(join(root, 'Info.plist'));
        const widget = plist(join(root, 'PlugIns/PatchWidget.appex/Info.plist'));
        validateBundleInfo(app, widget);
        validateNativeConfig(JSON.parse(await readFile(join(root, 'capacitor.config.json'), 'utf8')), app.CFBundleIdentifier);
        const privacy = plist(join(root, 'PrivacyInfo.xcprivacy'));
        if (privacy.NSPrivacyTracking !== false || !privacy.NSPrivacyAccessedAPITypes?.some(value => value.NSPrivacyAccessedAPIType === 'NSPrivacyAccessedAPICategoryUserDefaults' && value.NSPrivacyAccessedAPITypeReasons?.includes('CA92.1')))
            throw new Error('IOS_APP_PRIVACY_MANIFEST_INVALID');
        const found = await manifests(root);
        for (const sdk of ['Capacitor.framework', 'Cordova.framework', 'Clerk_ClerkKit.bundle']) {
            if (!found.some(path => path.includes(`/${sdk}/`))) throw new Error('IOS_SDK_PRIVACY_MANIFEST_MISSING');
        }
        await validateArtifact(join(root, 'public'), readPolicy(), 'production', { kind: 'mobile' });
        console.log('IOS_BUNDLE_OFFLINE_CHECKS_OK: signing, entitlements, privacy report and Apple validation still required');
    } else throw new Error('IOS_APP_OR_CONFIG_REQUIRED');
} catch (error) {
    console.error(/^[A-Z][A-Z0-9_:]*$/.test(error.message) ? error.message : 'IOS_RELEASE_CHECK_FAILED');
    process.exitCode = 1;
}
