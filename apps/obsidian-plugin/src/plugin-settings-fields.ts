import { Setting } from "obsidian";

export function addToggleSetting(
  containerEl: HTMLElement,
  name: string,
  description: string,
  value: boolean,
  onChange: (value: boolean) => Promise<void>
): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(description)
    .addToggle((toggle) => {
      toggle.setValue(value);
      toggle.onChange(async (nextValue) => {
        await onChange(nextValue);
      });
    });
}

export function addOptionalTextSetting(
  containerEl: HTMLElement,
  name: string,
  description: string,
  value: string | undefined,
  placeholder: string,
  onChange: (value: string) => Promise<void>
): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(description)
    .addText((text) => {
      text.setPlaceholder(placeholder);
      text.setValue(value ?? "");
      text.onChange(async (nextValue) => {
        await onChange(nextValue);
      });
    });
}

export function addMultiLineTextSetting(
  containerEl: HTMLElement,
  name: string,
  description: string,
  value: string,
  placeholder: string,
  onChange: (value: string) => Promise<void>
): void {
  new Setting(containerEl)
    .setName(name)
    .setDesc(description)
    .addTextArea((textArea) => {
      textArea.setPlaceholder(placeholder);
      textArea.setValue(value);
      textArea.inputEl.rows = 4;
      textArea.inputEl.style.width = "100%";
      textArea.onChange(async (nextValue) => {
        await onChange(nextValue);
      });
    });
}
