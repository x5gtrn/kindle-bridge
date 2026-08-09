import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { listAmazonRegions } from "../amazon/AmazonRegion";
import {
  AUTO_SYNC_MAX_INTERVAL_MINUTES,
  AUTO_SYNC_MIN_INTERVAL_MINUTES,
  type KindleBridgeSettings,
} from "./KindleBridgeSettings";

/** What this settings tab needs from the plugin instance that owns it. */
export interface KindleBridgeSettingsHost {
  pluginSettings: KindleBridgeSettings;
  saveSettings(): Promise<void>;
  runSignIn(): void;
  runSync(): Promise<void>;
  checkSignInStatus(): Promise<boolean>;
}

/**
 * Uses the classic `display()`-based PluginSettingTab, not the newer
 * declarative `getSettingDefinitions()` API (which would make these
 * settings appear in Obsidian's in-app settings search on 1.13.0+).
 * Deliberately not adopted: it requires minAppVersion 1.13.0, and this
 * plugin intentionally supports back to 1.4.4 (see versions.json) - a
 * known, accepted trade-off, not an oversight.
 */
export class KindleBridgeSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly host: Plugin & KindleBridgeSettingsHost,
  ) {
    super(app, host);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("Amazon region")
      .setDesc("Which Amazon Kindle store to sync highlights and notes from.")
      .addDropdown((dropdown) => {
        for (const region of listAmazonRegions()) {
          dropdown.addOption(region.id, region.label);
        }
        dropdown.setValue(this.host.pluginSettings.amazonRegion);
        dropdown.onChange(async (value) => {
          this.host.pluginSettings.amazonRegion = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl).setName("Account").setHeading();

    new Setting(containerEl)
      .setName("Sign in to Amazon")
      .setDesc(
        'Opens a real, separate Amazon sign-in page in its own browser window for the region selected above. Also available from the command palette as "Kindle Bridge: Sign in to Amazon".',
      )
      .addButton((button) => {
        button.setButtonText("Sign in").onClick(() => {
          this.host.runSignIn();
        });
      });

    const statusSetting = new Setting(containerEl)
      .setName("Sign-in status")
      .setDesc('Not checked yet. Click "check status" to check.');
    statusSetting.addButton((button) => {
      button.setButtonText("Check status").onClick(async () => {
        button.setDisabled(true).setButtonText("Checking...");
        statusSetting.setDesc("Checking - this briefly opens a hidden browser window...");
        try {
          const signedIn = await this.host.checkSignInStatus();
          statusSetting.setDesc(
            signedIn
              ? "Signed in to Amazon for the region selected above."
              : "Not signed in (or the session has expired) for the region selected above.",
          );
        } catch (error) {
          statusSetting.setDesc(
            `Could not check sign-in status: ${error instanceof Error ? error.message : String(error)}`,
          );
        } finally {
          button.setDisabled(false).setButtonText("Check status");
        }
      });
    });

    new Setting(containerEl)
      .setName("Sync now")
      .setDesc(
        'Fetch highlights and notes from Amazon and update your book notes. Also available from the command palette (and the ribbon icon) as "Kindle Bridge: Sync now".',
      )
      .addButton((button) => {
        button.setButtonText("Sync now").onClick(async () => {
          button.setDisabled(true).setButtonText("Syncing...");
          try {
            await this.host.runSync();
          } finally {
            button.setDisabled(false).setButtonText("Sync now");
          }
        });
      });

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Vault folder where per-book Markdown notes are created.")
      .addText((text) => {
        text
          .setPlaceholder("Highlight and Note/Books")
          .setValue(this.host.pluginSettings.outputFolder)
          .onChange(async (value) => {
            this.host.pluginSettings.outputFolder = value;
            await this.host.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Display cover image")
      .setDesc("Show the book cover (linked to the Amazon URL) in generated notes.")
      .addToggle((toggle) => {
        toggle.setValue(this.host.pluginSettings.displayCoverImage).onChange(async (value) => {
          this.host.pluginSettings.displayCoverImage = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Debug logging")
      .setDesc(
        "Log extra detail to the developer console to help diagnose sync issues. Credentials, cookies, and annotation text are always masked.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.pluginSettings.debugLogging).onChange(async (value) => {
          this.host.pluginSettings.debugLogging = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Daily Note summary")
      .setDesc(
        "Append a short sync summary line to today's Daily Note (only if it already exists - this plugin never creates it). Uses the folder/date format below, not Obsidian's own Daily Notes settings, so make sure they match if you want the line in the same file.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.pluginSettings.dailyNoteSummaryEnabled).onChange(async (value) => {
          this.host.pluginSettings.dailyNoteSummaryEnabled = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Daily Note folder")
      .setDesc("Vault folder your Daily Notes live in. Leave empty for the vault root.")
      .addText((text) => {
        text
          .setPlaceholder("Daily Notes")
          .setValue(this.host.pluginSettings.dailyNoteFolder)
          .onChange(async (value) => {
            this.host.pluginSettings.dailyNoteFolder = value;
            await this.host.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Daily Note date format")
      .setDesc("Moment.js format used for the Daily Note file name, e.g. YYYY-MM-DD.")
      .addText((text) => {
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.host.pluginSettings.dailyNoteDateFormat)
          .onChange(async (value) => {
            this.host.pluginSettings.dailyNoteDateFormat = value;
            await this.host.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Sync on startup")
      .setDesc(
        "Automatically run a sync once Obsidian finishes loading. Failures (not signed in, session expired, network error) are logged only, never shown as a notice - only a successful sync is. Takes effect after reloading the plugin/restarting Obsidian.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.pluginSettings.autoSyncOnStartup).onChange(async (value) => {
          this.host.pluginSettings.autoSyncOnStartup = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Automatic interval sync")
      .setDesc(
        "Automatically run a sync on a fixed interval while Obsidian is open, in addition to (or instead of) sync on startup. Same silent-failure behavior as above. Takes effect after reloading the plugin/restarting Obsidian.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.pluginSettings.autoSyncIntervalEnabled).onChange(async (value) => {
          this.host.pluginSettings.autoSyncIntervalEnabled = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc(
        `How often to automatically sync, in minutes (${AUTO_SYNC_MIN_INTERVAL_MINUTES}-${AUTO_SYNC_MAX_INTERVAL_MINUTES}). Only used if "Automatic interval sync" is on.`,
      )
      .addSlider((slider) => {
        slider
          .setLimits(AUTO_SYNC_MIN_INTERVAL_MINUTES, AUTO_SYNC_MAX_INTERVAL_MINUTES, 15)
          .setValue(this.host.pluginSettings.autoSyncIntervalMinutes)
          .onChange(async (value) => {
            this.host.pluginSettings.autoSyncIntervalMinutes = value;
            await this.host.saveSettings();
          });
      });
  }
}
