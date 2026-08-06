import { App, Modal, Setting } from "obsidian";
import type { AmazonRegion } from "../amazon/AmazonRegion";

/**
 * Confirmation step shown before opening Amazon's official login page in
 * a separate window. Contains no login form of its own - no email,
 * password, or OTP field ever appears in this plugin's UI.
 */
export class LoginModal extends Modal {
  private confirmed = false;

  constructor(
    app: App,
    private readonly region: AmazonRegion,
    private readonly onConfirm: () => void,
  ) {
    super(app);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.createEl("h2", { text: "Sign in to Amazon" });
    contentEl.createEl("p", {
      text: `This opens Amazon's official sign-in page for ${this.region.label} (${this.region.amazonDomain}) in a separate window. Kindle Bridge never sees or stores your password, OTP, or Amazon cookies.`,
    });

    new Setting(contentEl)
      .addButton((button) =>
        button
          .setButtonText("Continue to Amazon")
          .setCta()
          .onClick(() => {
            this.confirmed = true;
            this.close();
          }),
      )
      .addButton((button) => button.setButtonText("Cancel").onClick(() => this.close()));
  }

  onClose(): void {
    this.contentEl.empty();
    if (this.confirmed) {
      this.onConfirm();
    }
  }
}
