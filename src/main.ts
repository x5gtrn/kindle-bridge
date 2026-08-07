import { join } from "node:path";
import { App, FileSystemAdapter, Notice, Plugin } from "obsidian";
import { CdpAmazonAuthService } from "./amazon/AmazonAuthService";
import { getAmazonRegion, type AmazonRegion } from "./amazon/AmazonRegion";
import { AmazonSessionExpiredError, CdpAmazonSessionService } from "./amazon/AmazonSessionService";
import { CdpKindleReaderClient } from "./amazon/KindleReaderClient";
import { BookNoteRepository } from "./markdown/BookNoteRepository";
import {
  DEFAULT_SETTINGS,
  normalizeSettings,
  type KindleBridgeSettings,
} from "./settings/KindleBridgeSettings";
import { KindleBridgeSettingTab } from "./settings/KindleBridgeSettingTab";
import { AmazonKindleSyncService } from "./sync/KindleSyncService";
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

  private readonly authService = new CdpAmazonAuthService(
    () => this.getProfileDir(),
    this.logger,
  );
  private readonly sessionService = new CdpAmazonSessionService(() => this.getProfileDir());
  private readonly readerClient = new CdpKindleReaderClient(
    () => this.getProfileDir(),
    this.logger,
  );
  private readonly syncCoordinator = new SyncCoordinator();

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
    // A sign-in in progress has up to a 5-minute pending timeout
    // (AmazonAuthService's SIGN_IN_TIMEOUT_MS) and an open browser
    // process; cancel it so neither outlives this plugin instance.
    // Sync/session-check/fetch each launch a fresh, short-lived browser
    // process per operation and close it when done, so there's nothing
    // else to release here.
    this.authService.cancelPendingSignIn();
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

  /**
   * Absolute filesystem path to a persistent, plugin-owned browser
   * profile directory, shared by AmazonAuthService, AmazonSessionService,
   * and KindleReaderClient so a session established at sign-in is
   * usable by the others - see docs/architecture.md §4. Computed lazily
   * (not cached) so a missing FileSystemAdapter surfaces as a normal,
   * caught error at the point of use rather than crashing plugin
   * construction; this plugin is desktop-only (isDesktopOnly in
   * manifest.json), so FileSystemAdapter should always be present in
   * practice.
   */
  private getProfileDir(): string {
    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) {
      throw new Error(
        "Kindle Bridge requires desktop Obsidian (no file system adapter available).",
      );
    }
    return join(
      adapter.getBasePath(),
      this.app.vault.configDir,
      "plugins",
      this.manifest.id,
      "browser-profile",
    );
  }

  private runSignIn(): void {
    let region;
    try {
      region = this.currentRegion();
    } catch (error) {
      this.notifyError("Sign-in failed", error);
      return;
    }
    new LoginModal(this.app, region, () => {
      void this.attemptSignIn(region);
    }).open();
  }

  /**
   * `AmazonAuthService.signIn()` is not an `async` function and can
   * throw synchronously (e.g. AmazonAuthUnsupportedError, before it
   * ever returns a Promise) rather than only rejecting. Calling it as
   * `this.authService.signIn(region).then(...).catch(...)` would never
   * attach the `.catch()` for that synchronous case, silently dropping
   * the error with no Notice shown - this wraps the call in a proper
   * try/catch (via `await` inside an async function) so both synchronous
   * throws and asynchronous rejections are handled the same way.
   */
  private async attemptSignIn(region: AmazonRegion): Promise<void> {
    new Notice(
      "Kindle Bridge: opening a browser window for Amazon sign-in. Complete sign-in there, then return to Obsidian.",
    );
    try {
      const result = await this.authService.signIn(region);
      if (result === "success") {
        new Notice("Kindle Bridge: signed in to Amazon.");
      } else {
        new Notice(`Kindle Bridge: sign-in ${result}.`);
      }
    } catch (error) {
      this.notifyError("Sign-in failed", error);
    }
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
      const region = this.currentRegion();
      const bookNoteRepository = new BookNoteRepository(
        this.app.vault,
        this.app.metadataCache,
        this.app.fileManager,
        this.settings.outputFolder,
      );
      const syncService = new AmazonKindleSyncService({
        sessionService: this.sessionService,
        readerClient: this.readerClient,
        bookNoteRepository,
        logger: this.logger,
        getDisplayCoverImage: () => this.settings.displayCoverImage,
      });

      const result = await this.syncCoordinator.sync(region, syncService);
      new Notice(
        `Kindle Bridge: sync complete (${result.notesCreated} created, ${result.notesUpdated} updated, ${result.errors} errors).`,
      );
      new SyncProgressModal(this.app, result).open();
    } catch (error) {
      if (error instanceof SyncAlreadyInProgressError) {
        new Notice("Kindle Bridge: a sync is already in progress.");
        return;
      }
      if (error instanceof AmazonSessionExpiredError) {
        new Notice(
          'Kindle Bridge: your Amazon session has expired. Run "Kindle Bridge: Sign in to Amazon" and try again.',
        );
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
