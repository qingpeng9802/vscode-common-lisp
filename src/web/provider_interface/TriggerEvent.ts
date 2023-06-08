import type { TriggerProvider } from '../common/enum';

class TriggerEvent {
  public readonly triggerProvider: TriggerProvider;

  constructor(triggerProvider: TriggerProvider) {
    this.triggerProvider = triggerProvider;
  }

}

export { TriggerEvent };
