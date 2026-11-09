// AI-generated (Claude)
//
// Splits the iOS app into two side-by-side installable variants keyed on the
// Xcode build configuration:
//
// - Debug (`npx expo run:ios`): testing app with its own bundle identifier,
//   home screen name, icon and URL scheme, so it can be tried on the same
//   phone without touching the production app's logbook or keychain.
// - Release (Xcode Archive / `--configuration Release`): production app as
//   configured in app.config.ts.
//
// Each bundle identifier gets its own sandbox, so the two installs never share
// a logbook, SSI credentials or settings.
//
// The same goes for the widgets (expo-widgets): their extension's bundle
// identifier has to start with its app's, and the app group they read from is
// split per variant so the debug build's widgets never show the production
// logbook. expo-widgets writes one fixed identifier and group; this plugin turns
// both into build settings. It must be listed before expo-widgets in
// app.config.ts so its mods run after that plugin's (a later plugin's mods run
// first).

const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withEntitlementsPlist,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

// What expo-widgets names its extension target, and the defaults it derives.
const WIDGET_TARGET = 'ExpoWidgetsTarget';
const GROUP_KEY = 'com.apple.security.application-groups';
const groupFor = (bundleIdentifier) => `group.${bundleIdentifier}`;
const GROUP_SETTING = '$(APP_GROUP_IDENTIFIER)';

const withIosVariants = (config, { debug }) => {
  const release = {
    name: config.name,
    scheme: config.scheme,
    bundleIdentifier: config.ios?.bundleIdentifier,
  };
  const releaseGroup = groupFor(release.bundleIdentifier);
  const iconName = path.basename(debug.icon, '.icon');

  config = withInfoPlist(config, (config) => {
    const plist = config.modResults;
    plist.CFBundleDisplayName = '$(APP_DISPLAY_NAME)';
    // Expo registers both the app scheme and the bundle identifier as URL
    // schemes. Both installs registering the same scheme would let either one steal
    // the other's links.
    for (const urlType of plist.CFBundleURLTypes ?? []) {
      const schemes = urlType.CFBundleURLSchemes.map((scheme) => {
        if (scheme === release.scheme) return '$(APP_URL_SCHEME)';
        if (scheme === config.ios?.bundleIdentifier) return '$(PRODUCT_BUNDLE_IDENTIFIER)';
        return scheme;
      });
      urlType.CFBundleURLSchemes = [...new Set(schemes)];
    }
    // Read by expo-widgets in the app to find the group its widgets share.
    if (plist.ExpoWidgetsAppGroupIdentifier === releaseGroup) {
      plist.ExpoWidgetsAppGroupIdentifier = GROUP_SETTING;
    }
    return config;
  });

  config = withEntitlementsPlist(config, (config) => {
    const groups = config.modResults[GROUP_KEY];
    if (Array.isArray(groups)) {
      config.modResults[GROUP_KEY] = groups.map((group) =>
        group === releaseGroup ? GROUP_SETTING : group,
      );
    }
    return config;
  });

  config = withDangerousMod(config, [
    'ios',
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      await fs.promises.cp(
        path.join(projectRoot, debug.icon),
        path.join(platformProjectRoot, projectName, `${iconName}.icon`),
        { recursive: true },
      );
      // The widget extension's own entitlements and Info.plist, as expo-widgets
      // just wrote them, name the production group literally.
      const widgetDir = path.join(platformProjectRoot, WIDGET_TARGET);
      for (const file of [`${WIDGET_TARGET}.entitlements`, 'Info.plist']) {
        const filePath = path.join(widgetDir, file);
        if (fs.existsSync(filePath)) {
          const contents = await fs.promises.readFile(filePath, 'utf8');
          await fs.promises.writeFile(
            filePath,
            contents
              .split(`<string>${releaseGroup}</string>`)
              .join(`<string>${GROUP_SETTING}</string>`),
          );
        }
      }
      return config;
    },
  ]);

  config = withXcodeProject(config, (config) => {
    const project = config.modResults;
    const { projectName } = config.modRequest;

    IOSConfig.XcodeUtils.addResourceFileToGroup({
      filepath: `${projectName}/${iconName}.icon`,
      groupName: projectName,
      project,
      isBuildFile: true,
    });

    const [, target] = IOSConfig.Target.findNativeTargetByName(project, projectName);
    const configurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
      project,
      target.buildConfigurationList,
    );
    for (const [, { name, buildSettings }] of configurations) {
      const variant = name === 'Debug' ? debug : release;
      buildSettings.APP_DISPLAY_NAME = JSON.stringify(variant.name);
      buildSettings.APP_URL_SCHEME = JSON.stringify(variant.scheme);
      buildSettings.APP_GROUP_IDENTIFIER = JSON.stringify(groupFor(variant.bundleIdentifier));
      if (name === 'Debug') {
        buildSettings.PRODUCT_BUNDLE_IDENTIFIER = debug.bundleIdentifier;
        buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME = iconName;
      }
    }

    // The widget extension: an embedded extension's identifier must extend its
    // app's, so the debug app gets a debug extension.
    const widgetTarget = project.pbxTargetByName(WIDGET_TARGET);
    if (widgetTarget) {
      const widgetConfigurations = IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
        project,
        widgetTarget.buildConfigurationList,
      );
      for (const [, { name, buildSettings }] of widgetConfigurations) {
        const variant = name === 'Debug' ? debug : release;
        buildSettings.APP_GROUP_IDENTIFIER = JSON.stringify(groupFor(variant.bundleIdentifier));
        buildSettings.PRODUCT_BUNDLE_IDENTIFIER = JSON.stringify(
          `${variant.bundleIdentifier}.${WIDGET_TARGET}`,
        );
      }
    }
    return config;
  });

  return config;
};

module.exports = withIosVariants;
