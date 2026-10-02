// iOS 27 traps at launch unless an app adopts the scene-based life cycle. The
// Expo SDK 57 runtime ships ExpoAppSceneDelegate, but its prebuild template
// still starts React Native from the app delegate. This applies what the SDK 58
// template does: a SceneDelegate, the scene manifest, and an app delegate that
// leaves window creation to the scene.
// ponytail: delete this plugin (and its app.json entry) on upgrading to SDK 58.
const fs = require("fs");
const path = require("path");
const { withAppDelegate, withDangerousMod, withInfoPlist, withXcodeProject, IOSConfig } = require("expo/config-plugins");

const SCENE_DELEGATE = `internal import Expo

@objc(SceneDelegate)
class SceneDelegate: ExpoAppSceneDelegate {}
`;

const START_IN_APP_DELEGATE = /#if os\(iOS\) \|\| os\(tvOS\)\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\s*factory\.startReactNative\([\s\S]*?\)\s*#endif\n/;

module.exports = (config) => {
  config = withAppDelegate(config, (c) => {
    let src = c.modResults.contents;
    if (!src.includes("ExpoReactNativeFactoryProvider")) {
      src = src.replace("class AppDelegate: ExpoAppDelegate {", "class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {");
    }
    src = src.replace(START_IN_APP_DELEGATE, "    // SceneDelegate creates the window and starts React Native.\n");
    if (src.includes("window = UIWindow(frame:")) throw new Error("with-scene-lifecycle: AppDelegate template changed; update the plugin.");
    c.modResults.contents = src;
    return c;
  });

  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: "Default Configuration", UISceneDelegateClassName: "$(PRODUCT_MODULE_NAME).SceneDelegate" },
        ],
      },
    };
    return c;
  });

  config = withDangerousMod(config, [
    "ios",
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, c.modRequest.projectName);
      fs.writeFileSync(path.join(dir, "SceneDelegate.swift"), SCENE_DELEGATE);
      return c;
    },
  ]);

  return withXcodeProject(config, (c) => {
    const name = c.modRequest.projectName;
    const filepath = `${name}/SceneDelegate.swift`;
    if (!c.modResults.hasFile(filepath)) {
      IOSConfig.XcodeUtils.addBuildSourceFileToGroup({ filepath, groupName: name, project: c.modResults });
    }
    return c;
  });
};
