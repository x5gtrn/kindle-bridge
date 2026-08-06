export class NotImplementedYetError extends Error {
  constructor(feature: string, phase: string) {
    super(`${feature} is not implemented yet (planned for ${phase}).`);
    this.name = "NotImplementedYetError";
  }
}
