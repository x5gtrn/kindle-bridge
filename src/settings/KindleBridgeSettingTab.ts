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
  }
}
