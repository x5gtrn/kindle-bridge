import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import { listAmazonRegions } from "../amazon/AmazonRegion";
import type { KindleBridgeSettings } from "./KindleBridgeSettings";

/** What this settings tab needs from the plugin instance that owns it. */
export interface KindleBridgeSettingsHost {
  settings: KindleBridgeSettings;
  saveSettings(): Promise<void>;
}

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
      .setDesc("Which Amazon Kindle store to sync highlights and memos from.")
      .addDropdown((dropdown) => {
        for (const region of listAmazonRegions()) {
          dropdown.addOption(region.id, region.label);
        }
        dropdown.setValue(this.host.settings.amazonRegion);
        dropdown.onChange(async (value) => {
          this.host.settings.amazonRegion = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Output folder")
      .setDesc("Vault folder where per-book Markdown notes are created.")
      .addText((text) => {
        text
          .setPlaceholder("Highlight and Memo/Books")
          .setValue(this.host.settings.outputFolder)
          .onChange(async (value) => {
            this.host.settings.outputFolder = value;
            await this.host.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Display cover image")
      .setDesc("Show the book cover (linked to the Amazon URL) in generated notes.")
      .addToggle((toggle) => {
        toggle.setValue(this.host.settings.displayCoverImage).onChange(async (value) => {
          this.host.settings.displayCoverImage = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Debug logging")
      .setDesc(
        "Log extra detail to the developer console to help diagnose sync issues. Credentials, cookies, and annotation text are always masked.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.settings.debugLogging).onChange(async (value) => {
          this.host.settings.debugLogging = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Daily Note summary")
      .setDesc(
        "Append a short sync summary line to today's Daily Note (only if it already exists - this plugin never creates it). Uses the folder/date format below, not Obsidian's own Daily Notes settings, so make sure they match if you want the line in the same file.",
      )
      .addToggle((toggle) => {
        toggle.setValue(this.host.settings.dailyNoteSummaryEnabled).onChange(async (value) => {
          this.host.settings.dailyNoteSummaryEnabled = value;
          await this.host.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Daily Note folder")
      .setDesc("Vault folder your Daily Notes live in. Leave empty for the vault root.")
      .addText((text) => {
        text
          .setPlaceholder("Daily Notes")
          .setValue(this.host.settings.dailyNoteFolder)
          .onChange(async (value) => {
            this.host.settings.dailyNoteFolder = value;
            await this.host.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Daily Note date format")
      .setDesc("Moment.js format used for the Daily Note file name, e.g. YYYY-MM-DD.")
      .addText((text) => {
        text
          .setPlaceholder("YYYY-MM-DD")
          .setValue(this.host.settings.dailyNoteDateFormat)
          .onChange(async (value) => {
            this.host.settings.dailyNoteDateFormat = value;
            await this.host.saveSettings();
          });
      });
  }
}
