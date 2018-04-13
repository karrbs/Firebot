"use strict";

/**
 * @module Main
 */

const path = require("path");
const url = require("url");
const logger = require("./lib/logwrapper");
logger.info("Starting Firebot...");

const electron = require("electron");
const { app, BrowserWindow, ipcMain, shell, dialog } = electron;
const GhReleases = require("electron-gh-releases");
const settings = require("./lib/common/settings-access").settings;
const dataAccess = require("./lib/common/data-access.js");
const profileManager = require("./lib/common/profile-manager.js");
const backupManager = require("./lib/backupManager");
const apiServer = require("./api/apiServer.js");
const userdb = require("./lib/database/userDatabase");
const currencydb = require("./lib/database/currencyDatabase");

const Effect = require("./lib/common/EffectType");

// uncaught exception - log the error
process.on("uncaughtException", logger.error); //eslint-disable-line no-console

/**
 * Keeps a global reference of the window object, if you don't, the window will
 * be closed automatically when the JavaScript object is garbage collected.
 */
let mainWindow;

/** Interactive handler */
let mixerConnect; //eslint-disable-line

/**
 * This function makes sure we focus on the currently opened Firebot window should we try to open a new one.
 * @param {*} mainWindow
 */
function mainFocus(mainWindow) {
  let iShouldQuit = app.makeSingleInstance(function() {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
    return true;
  });
  if (iShouldQuit) {
    app.quit();
    return;
  }
}
mainFocus();

/** Handle Squirrel events for windows machines */
function squirrelEvents() {
  if (process.platform === "win32") {
    let cp;
    let updateDotExe;
    let target;
    let child;
    switch (process.argv[1]) {
      case "--squirrel-updated":
        // cleanup from last instance

        // use case-fallthrough to do normal installation
        break;
      case "--squirrel-install": //eslint-disable-line no-fallthrough
        // Optional - do things such as:
        // - Install desktop and start menu shortcuts
        // - Add your .exe to the PATH
        // - Write to the registry for things like file associations and explorer context menus

        // Install shortcuts
        cp = require("child_process");
        updateDotExe = path.resolve(
          path.dirname(process.execPath),
          "..",
          "update.exe"
        );
        target = path.basename(process.execPath);
        child = cp.spawn(updateDotExe, ["--createShortcut", target], {
          detached: true
        });
        child.on("close", app.quit);
        return;

      case "--squirrel-uninstall": {
        // Undo anything you did in the --squirrel-install and --squirrel-updated handlers

        //attempt to delete the user-settings folder
        let rimraf = require("rimraf");
        rimraf.sync(dataAccess.getPathInUserData("/user-settings"));

        // Remove shortcuts
        cp = require("child_process");
        updateDotExe = path.resolve(
          path.dirname(process.execPath),
          "..",
          "update.exe"
        );
        target = path.basename(process.execPath);
        child = cp.spawn(updateDotExe, ["--removeShortcut", target], {
          detached: true
        });
        child.on("close", app.quit);
        return true;
      }
      case "--squirrel-obsolete":
        // This is called on the outgoing version of your app before
        // we update to the new version - it's the opposite of
        // --squirrel-updated
        app.quit();
        return;
    }
  }
}
squirrelEvents();

/**
 * Creates the electron window. Sets up a few events such as on closed that are used to control the window.
 * This is also where we start up logging for renderer errors.
 * We also load up our global hotkeys created through the app here.
 * */
function createWindow() {
  logger.info("Creating window...");

  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1285,
    height: 720,
    minWidth: 300,
    minHeight: 50,
    icon: path.join(__dirname, "./gui/images/logo.ico"),
    show: false
  });

  // and load the index.html of the app.
  mainWindow.loadURL(
    url.format({
      pathname: path.join(__dirname, "./gui/app/index.html"),
      protocol: "file:",
      slashes: true
    })
  );

  // wait for the main window's content to load, then show it
  mainWindow.webContents.on("did-finish-load", () => {
    // mainWindow.webContents.openDevTools();
    mainWindow.show();
  });

  // Emitted when the window is closed.
  mainWindow.on("closed", () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
    global.renderWindow = null;
  });

  // Global var for main window.
  global.renderWindow = mainWindow;

  logger.on("logging", (transport, level, msg, meta) => {
    if (renderWindow != null && renderWindow.isDestroyed() === false) {
      renderWindow.webContents.send("logging", {
        transport: transport,
        level: level,
        msg: msg,
        meta: meta
      });
    }
  });

  let hotkeyManager = require("./lib/hotkeys/hotkey-manager");
  hotkeyManager.refreshHotkeyCache();
}

/**
 * This checks to see if any profiles are marked for deletion. If so, the profile folder is deleted.
 * We mark profiles for deletion so we can delete the files during a restart when they are not in use.
 * Note, most profile management stuff other than this is taken care of in the profile-manager.js file.
 */
async function deleteProfiles() {
  let globalSettingsDb = dataAccess.getJsonDbInUserData("./global-settings");

  try {
    let deletedProfile = globalSettingsDb.getData("./profiles/deleteProfile"),
      activeProfiles = globalSettingsDb.getData("./profiles/activeProfiles");

    // Stop here if we have no deleted profile info.
    if (deletedProfile != null) {
      // Delete the profile.
      logger.warn(
        "Profile " +
          deletedProfile +
          " is marked for deletion. Removing it now."
      );
      logger.warn(
        dataAccess.getPathInUserData("/profiles") + "\\" + deletedProfile
      );
      dataAccess.deleteFolderRecursive(
        dataAccess.getPathInUserData("/profiles") + "\\" + deletedProfile
      );

      // Remove it from active profiles.
      let profilePosition = activeProfiles.indexOf(deletedProfile);
      activeProfiles.splice(profilePosition, 1);
      globalSettingsDb.push("/profiles/activeProfiles", activeProfiles);

      // Remove loggedInProfile setting and let restart process handle it.
      if (activeProfiles.length > 0 && activeProfiles != null) {
        // Switch to whatever the first profile is in our new active profiles list.
        globalSettingsDb.push("./profiles/loggedInProfile", activeProfiles[0]);
      } else {
        // We have no more active profiles, delete the loggedInProfile setting.
        globalSettingsDb.delete("./profiles/loggedInProfile");
      }

      // Reset the deleteProfile setting.
      globalSettingsDb.delete("./profiles/deleteProfile");

      // Let our logger know we successfully deleted a profile.
      logger.warn("Successfully deleted profile: " + deletedProfile);
    }
  } catch (err) {
    logger.info("No profiles are queued to be deleted or there was an error.");
    return;
  }
}

/**
 * This function creates all of the default folders and files we need to run the app.
 * It will cycle through all profiles and make sure those have default folders as well.
 */
async function createDefaultFoldersAndFiles() {
  logger.info("Ensuring default folders and files exist for all users...");

  //create the root "firebot-data" folder
  dataAccess.createFirebotDataDir();

  // Create the profiles folder if it doesn't exist. It's required
  // for the folders below that are within it
  if (!dataAccess.userDataPathExistsSync("/profiles")) {
    logger.info("Can't find the profiles folder, creating one now...");
    dataAccess.makeDirInUserDataSync("/profiles");
  }

  // Create the backup folder if it doesn't exist
  if (!dataAccess.userDataPathExistsSync("/backups")) {
    logger.info("Can't find the backup folder, creating one now...");
    dataAccess.makeDirInUserDataSync("/backups");
  }

  // Okay, now we're going to want to set up individual profile folders or missing folders.
  let globalSettingsDb = dataAccess.getJsonDbInUserData("./global-settings"),
    activeProfiles = [];

  // Check to see if globalSettings file has active profiles listed, otherwise create it.
  // ActiveProfiles is a list of profiles that have not been deleted through the app.
  // This could happen if someone manually deletes a profile.
  try {
    activeProfiles = globalSettingsDb.getData("/profiles/activeProfiles");
  } catch (err) {
    globalSettingsDb.push("/profiles/activeProfiles", [1]);
    activeProfiles = [1];
  }

  // Check to see if we have a "loggedInProfile", if not select one.
  // If we DO have a loggedInProfile, check and make sure that profile is still in our active profile list, if not select the first in the active list.
  // All of this is backup, just in case. It makes sure that we at least have some profile logged in no matter what happens.
  try {
    if (
      activeProfiles.indexOf(
        globalSettingsDb.getData("/profiles/loggedInProfile")
      ) === -1
    ) {
      globalSettingsDb.push("/profiles/loggedInProfile", activeProfiles[0]);
      logger.info(
        "Last logged in profile is no longer on the active profile list. Changing it to an active one."
      );
    } else {
      logger.info("Last logged in profile is still active!");
    }
  } catch (err) {
    globalSettingsDb.push("/profiles/loggedInProfile", activeProfiles[0]);
    logger.info(
      "Last logged in profile info is missing or this is a new install. Adding it in now."
    );
  }

  // Loop through active profiles and make sure all folders needed are created.
  // This ensures that even if a folder is manually deleted, it will be recreated instead of erroring out the app somewhere down the line.
  activeProfiles = Object.keys(activeProfiles).map(k => activeProfiles[k]);
  activeProfiles.forEach(profileId => {
    // Create the scripts folder if it doesn't exist
    if (!dataAccess.userDataPathExistsSync("/profiles/" + profileId)) {
      logger.info(
        "Can't find a profile folder for " + profileId + ", creating one now..."
      );
      dataAccess.makeDirInUserDataSync("/profiles/" + profileId);
    }

    if (
      !dataAccess.userDataPathExistsSync(
        "/profiles/" + profileId + "/hotkeys.json"
      )
    ) {
      logger.info(
        "Can't find the hotkeys file, creating the default one now..."
      );
      dataAccess.copyDefaultConfigToUserData(
        "hotkeys.json",
        "/profiles/" + profileId
      );
    }

    // Create the scripts folder if it doesn't exist
    if (
      !dataAccess.userDataPathExistsSync("/profiles/" + profileId + "/scripts")
    ) {
      logger.info("Can't find the scripts folder, creating one now...");
      dataAccess.makeDirInUserDataSync("/profiles/" + profileId + "/scripts");
    }

    // Create the controls folder if it doesn't exist.
    if (
      !dataAccess.userDataPathExistsSync("/profiles/" + profileId + "/controls")
    ) {
      logger.info("Can't find the controls folder, creating one now...");
      dataAccess.makeDirInUserDataSync("/profiles/" + profileId + "/controls");
    }

    // Create the logs folder if it doesn't exist.
    if (
      !dataAccess.userDataPathExistsSync("/profiles/" + profileId + "/logs")
    ) {
      logger.info("Can't find the logs folder, creating one now...");
      dataAccess.makeDirInUserDataSync("/profiles/" + profileId + "/logs");
    }

    // Create the chat folder if it doesn't exist.
    if (
      !dataAccess.userDataPathExistsSync("/profiles/" + profileId + "/chat")
    ) {
      logger.info("Can't find the chat folder, creating one now...");
      dataAccess.makeDirInUserDataSync("/profiles/" + profileId + "/chat");
    }

    // Create the chat folder if it doesn't exist.
    if (
      !dataAccess.userDataPathExistsSync(
        "/profiles/" + profileId + "/live-events"
      )
    ) {
      logger.info("Can't find the live-events folder, creating one now...");
      dataAccess.makeDirInUserDataSync(
        "/profiles/" + profileId + "/live-events"
      );
    }
  });

  // Update the port.js file
  let port = settings.getWebSocketPort();
  dataAccess.writeFileInWorkingDir(
    "/resources/overlay/js/port.js",
    `window.WEBSOCKET_PORT = ${port}`,
    () => {
      logger.info(`Set overlay port to: ${port}`);
    }
  );

  logger.debug("Creating or connecting user database");
  userdb.connectUserDatabase();

  logger.debug("Creating or connecting currency database");
  currencydb.connectCurrencyDatabase();

  logger.info("Finished verifying default folders and files.");
}

/**
 * This is called when Electron is finished initialization and is ready to create browser windows.
 * This is where we set global variables for custom scripts, start our backup manager, and start the api server.
 */
function appOnReady() {
  app.on("ready", async function() {
    await createDefaultFoldersAndFiles();

    createWindow();

    // These are defined globally for Custom Scripts.
    // We will probably wnat to handle these differently but we shouldn't
    // change anything until we are ready as changing this will break most scripts
    global.EffectType = Effect.EffectType;
    global.SCRIPTS_DIR = profileManager.getPathInProfile("/scripts/");

    backupManager.onceADayBackUpCheck();

    //start the REST api server
    apiServer.start();

    return true;
  });
}
appOnReady();

/**
 * This is run when all windows are closed. It lets us unregister global hotkeys, run our last backup, and quit.
 */
function windowClosed() {
  app.on("window-all-closed", () => {
    // Unregister all shortcuts.
    let hotkeyManager = require("./lib/hotkeys/hotkey-manager");
    hotkeyManager.unregisterAllHotkeys();

    if (settings.backupOnExit()) {
      backupManager.startBackup(false, app.quit);
      // On OS X it is common for applications and their menu bar
      // to stay active until the user quits explicitly with Cmd + Q
    } else if (process.platform !== "darwin") {
      app.quit();
    }
  });
}
windowClosed();

/**
 * TODO: Is this mac only?
 */
function appOnActivate() {
  app.on("activate", () => {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
      createWindow();
    }
  });
}
appOnActivate();

/**
 * Activated when quitting the app. This allows us to clean up our deleted profiles and log the shutdown.
 */
function onAppQuit() {
  app.on("quit", () => {
    userdb.setAllUsersOffline();
    deleteProfiles();
    logger.warn("THIS IS THE END OF THE SHUTDOWN PROCESS.");
  });
}
onAppQuit();

/**
 * Run Updater
 */
function startAutoUpdater() {
  ipcMain.on("downloadUpdate", () => {
    //back up first
    if (settings.backupBeforeUpdates()) {
      backupManager.startBackup();
    }

    // Download Update
    let options = {
      repo: "firebottle/firebot",
      currentVersion: app.getVersion()
    };

    let updater = new GhReleases(options);

    updater.check((err, status) => {
      logger.info("Should we download an update? " + status);

      // Download the update
      updater.download();

      if (err) {
        logger.info(err);
      }
    });

    // When an update has been downloaded
    updater.on("update-downloaded", () => {
      logger.info("Updated downloaded. Installing...");
      //let the front end know and wait a few secs.
      renderWindow.webContents.send("updateDownloaded");

      setTimeout(function() {
        // Restart the app and install the update
        settings.setJustUpdated(true);

        updater.install();
      }, 3 * 1000);
    });

    // Access electrons autoUpdater
    // eslint-disable-next-line no-unused-expressions
    updater.autoUpdater;
  });
}
startAutoUpdater();

// restarts the app
ipcMain.on("restartApp", () => {
  app.relaunch({ args: process.argv.slice(1).concat(["--relaunch"]) });
  app.exit(0);
});

// Opens the firebot root folder
ipcMain.on("openRootFolder", () => {
  // We include "fakefile.txt" as a workaround to make it open into the 'root' folder instead
  // of opening to the poarent folder with 'Firebot'folder selected.
  let rootFolder = path.resolve(
    dataAccess.getUserDataPath() + path.sep + "user-settings"
  );
  shell.showItemInFolder(rootFolder);
});

// Get Import Folder Path
// This listens for an event from the render media.js file to open a dialog to get a filepath.
ipcMain.on("getImportFolderPath", (event, uniqueid) => {
  let path = dialog.showOpenDialog({
    title: "Select 'user-settings' folder",
    buttonLabel: "Import 'user-settings'",
    properties: ["openDirectory"]
  });
  event.sender.send("gotImportFolderPath", { path: path, id: uniqueid });
});

// Get Get Backup Zip Path
// This listens for an event from the render media.js file to open a dialog to get a filepath.
ipcMain.on("getBackupZipPath", (event, uniqueid) => {
  const backupsFolderPath = path.resolve(
    dataAccess.getUserDataPath() + path.sep + "backups" + path.sep
  );

  let fs = require("fs");
  let backupsFolderExists = false;
  try {
    backupsFolderExists = fs.existsSync(backupsFolderPath);
  } catch (err) {
    logger.warn("cannot check if backup folder exists", err);
  }

  let zipPath = dialog.showOpenDialog({
    title: "Select backup zp",
    buttonLabel: "Select Backup",
    defaultPath: backupsFolderExists ? backupsFolderPath : undefined,
    filters: [{ name: "Zip", extensions: ["zip"] }]
  });
  event.sender.send("gotBackupZipPath", { path: zipPath, id: uniqueid });
});

// Opens the firebot backup folder
ipcMain.on("openBackupFolder", () => {
  // We include "fakefile.txt" as a workaround to make it open into the 'root' folder instead
  // of opening to the poarent folder with 'Firebot'folder selected.
  let backupFolder = path.resolve(
    dataAccess.getUserDataPath() +
      path.sep +
      "backups" +
      path.sep +
      "fakescript.js"
  );
  shell.showItemInFolder(backupFolder);
});

ipcMain.on("startBackup", (event, manualActivation = false) => {
  backupManager.startBackup(manualActivation, () => {
    logger.info("backup complete");
    renderWindow.webContents.send("backupComplete", manualActivation);
  });
});

// When we get an event from the renderer to create a new profile.
ipcMain.on("createProfile", () => {
  profileManager.createNewProfile();
});

// When we get an event from the renderer to delete a particular profile.
ipcMain.on("deleteProfile", () => {
  profileManager.deleteProfile();
});

// Change profile when we get event from renderer
ipcMain.on("switchProfile", function(event, profileId) {
  profileManager.logInProfile(profileId);
});

mixerConnect = require("./lib/common/mixer-interactive.js");
