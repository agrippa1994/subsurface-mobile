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

const fs = require('fs');
const path = require('path');
const {
  IOSConfig,
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
} = require('expo/config-plugins');

const withIosVariants = (config, { debug }) => {
  const release = { name: config.name, scheme: config.scheme };
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
      if (name === 'Debug') {
        buildSettings.PRODUCT_BUNDLE_IDENTIFIER = debug.bundleIdentifier;
        buildSettings.ASSETCATALOG_COMPILER_APPICON_NAME = iconName;
      }
    }
    return config;
  });

  return config;
};

module.exports = withIosVariants;
