import { App, Notice, Plugin } from "obsidian";
import { ElectronAmazonAuthService } from "./amazon/AmazonAuthService";
import { getAmazonRegion } from "./amazon/AmazonRegion";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type KindleBridgeSettings,
} from "./settings/KindleBridgeSettings";
import { KindleBridgeSettingTab } from "./settings/KindleBridgeSettingTab";
import { NotImplementedKindleSyncService } from "./sync/KindleSyncService";
import { SyncAlreadyInProgressError, SyncCoordinator } from "./sync/SyncCoordinator";
import { LoginModal } from "./ui/LoginModal";
import { SyncProgressModal } from "./ui/SyncProgressModal";
import { Logger } from "./utils/logger";

/**
 * Obsidian's Setting tab API (`app.setting`) is stable but not part of
 * the published type definitions, so it's declared narrowly here instead
 * of reaching for `any`.
 */
interface AppWithSettingTab extends App {
  setting: {
    open(): void;
    openTabById(id: string): void;
  };
}

export default class KindleBridgePlugin extends Plugin {
  settings: KindleBridgeSettings = DEFAULT_SETTINGS;
  logger = new Logger({ level: "info" });

  private readonly authService = new ElectronAmazonAuthService();
  private readonly syncCoordinator = new SyncCoordinator(new NotImplementedKindleSyncService());

  async onload(): Promise<void> {
    await this.loadSettings();

    this.addSettingTab(new KindleBridgeSettingTab(this.app, this));

    this.addRibbonIcon("refresh-cw", "Kindle Bridge: Sync now", () => {
      void this.runSync();
    });

    this.addCommand({
      id: "kindle-bridge-sign-in",
      name: "Sign in to Amazon",
      callback: () => this.runSignIn(),
    });

    this.addCommand({
      id: "kindle-bridge-sync-now",
      name: "Sync now",
      callback: () => {
        void this.runSync();
      },
    });

    this.addCommand({
      id: "kindle-bridge-sign-out",
      name: "Sign out from Amazon",
      callback: () => {
        void this.runSignOut();
      },
    });

    this.addCommand({
      id: "kindle-bridge-open-settings",
      name: "Open settings",
      callback: () => this.openSettingsTab(),
    });
  }

  onunload(): void {
    // No open resources to release yet; Phase 3 will close any
    // in-flight Electron login/session windows here.
  }

  async loadSettings(): Promise<void> {
    this.settings = normalizeSettings(await this.loadData());
    this.logger.setLevel(this.settings.debugLogging ? "debug" : "info");
  }

  async saveSettings(): Promise<void> {
    this.logger.setLevel(this.settings.debugLogging ? "debug" : "info");
    await this.saveData(this.settings);
  }

  private currentRegion() {
    return getAmazonRegion(this.settings.amazonRegion);
  }

  private runSignIn(): void {
    const region = this.currentRegion();
    new LoginModal(this.app, region, () => {
      void this.authService
        .signIn(region)
        .then((result) => {
          if (result === "success") {
            new Notice("Kindle Bridge: signed in to Amazon.");
          } else {
            new Notice(`Kindle Bridge: sign-in ${result}.`);
          }
        })
        .catch((error: unknown) => this.notifyError("Sign-in failed", error));
    }).open();
  }

  private async runSignOut(): Promise<void> {
    try {
      await this.authService.signOut(this.currentRegion());
      new Notice("Kindle Bridge: signed out from Amazon.");
    } catch (error) {
      this.notifyError("Sign-out failed", error);
    }
  }

  private async runSync(): Promise<void> {
    try {
      const result = await this.syncCoordinator.sync(this.currentRegion());
      new Notice(
        `Kindle Bridge: sync complete (${result.notesCreated} created, ${result.notesUpdated} updated, ${result.errors} errors).`,
      );
      new SyncProgressModal(this.app, result).open();
    } catch (error) {
      if (error instanceof SyncAlreadyInProgressError) {
        new Notice("Kindle Bridge: a sync is already in progress.");
        return;
      }
      this.notifyError("Sync failed", error);
    }
  }

  private openSettingsTab(): void {
    const appWithSettings = this.app as AppWithSettingTab;
    appWithSettings.setting.open();
    appWithSettings.setting.openTabById(this.manifest.id);
  }

  private notifyError(context: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error(context, { message });
    new Notice(`Kindle Bridge: ${context.toLowerCase()} - ${message}`);
  }
}
