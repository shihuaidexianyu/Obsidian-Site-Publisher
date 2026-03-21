import { ItemView, type WorkspaceLeaf } from "obsidian";

import {
  createControlPanelActions,
  createControlPanelMeta,
  createControlPanelStatusItems,
  createIssuePanelItems,
  createIssuePanelMeta,
  createLogPanelItems,
  createLogPanelMeta,
  type ControlPanelAction,
  type IssuePanelItem,
  type LogPanelItem,
  type PanelMeta
} from "./plugin-view-model.js";
import type { PluginCommand, PluginExecutionState } from "./plugin-shell.js";
import type { PublisherPluginUiSettings } from "./settings.js";

export const CONTROL_PANEL_VIEW_TYPE = "osp-control-panel-view";
export const ISSUE_LIST_VIEW_TYPE = "osp-issues-view";
export const BUILD_LOG_VIEW_TYPE = "osp-build-logs-view";

type StateReader = () => PluginExecutionState;
type UiSettingsReader = () => PublisherPluginUiSettings;
type ActiveCommandReader = () => PluginCommand | undefined;
type CommandRunner = (command: PluginCommand) => Promise<void>;

export class PublisherControlView extends ItemView {
  public constructor(
    leaf: WorkspaceLeaf,
    private readonly readState: StateReader,
    private readonly readUi: UiSettingsReader,
    private readonly readActiveCommand: ActiveCommandReader,
    private readonly runCommand: CommandRunner
  ) {
    super(leaf);
  }

  public override getViewType(): string {
    return CONTROL_PANEL_VIEW_TYPE;
  }

  public override getDisplayText(): string {
    return "站点发布";
  }

  public override async onOpen(): Promise<void> {
    this.refresh();
  }

  public override async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  public refresh(): void {
    renderControlPanel(this.contentEl, this.readState(), this.readUi(), this.readActiveCommand(), this.runCommand);
  }
}

export class IssueListView extends ItemView {
  public constructor(leaf: WorkspaceLeaf, private readonly readState: StateReader, private readonly readUi: UiSettingsReader) {
    super(leaf);
  }

  public override getViewType(): string {
    return ISSUE_LIST_VIEW_TYPE;
  }

  public override getDisplayText(): string {
    return "发布问题";
  }

  public override async onOpen(): Promise<void> {
    this.refresh();
  }

  public override async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  public refresh(): void {
    renderIssuePanel(this.contentEl, this.readState(), this.readUi());
  }
}

export class BuildLogView extends ItemView {
  public constructor(leaf: WorkspaceLeaf, private readonly readState: StateReader) {
    super(leaf);
  }

  public override getViewType(): string {
    return BUILD_LOG_VIEW_TYPE;
  }

  public override getDisplayText(): string {
    return "构建日志";
  }

  public override async onOpen(): Promise<void> {
    this.refresh();
  }

  public override async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  public refresh(): void {
    renderLogPanel(this.contentEl, this.readState());
  }
}

function renderControlPanel(
  containerEl: HTMLElement,
  state: PluginExecutionState,
  ui: PublisherPluginUiSettings,
  activeCommand: PluginCommand | undefined,
  runCommand: CommandRunner
): void {
  const meta = createControlPanelMeta(state, activeCommand);
  const actions = createControlPanelActions(activeCommand);
  const statusItems = createControlPanelStatusItems(state, ui);
  const issueItems = createIssuePanelItems(state, ui).slice(0, 3);
  const logItems = createLogPanelItems(state).slice(0, 3);

  containerEl.empty();
  containerEl.addClass("osp-panel");
  containerEl.createEl("h2", {
    text: meta.title
  });
  containerEl.createEl("p", {
    cls: "osp-panel-summary",
    text: meta.summary
  });
  containerEl.createEl("div", {
    cls: "osp-panel-message",
    text: meta.statusMessage
  });

  const actionsEl = containerEl.createDiv({
    cls: "osp-panel-list"
  });

  for (const action of actions) {
    renderControlPanelAction(actionsEl, action, runCommand);
  }

  const statusEl = containerEl.createDiv({
    cls: "osp-panel-list"
  });

  for (const item of statusItems) {
    const itemEl = statusEl.createDiv({
      cls: "osp-panel-item"
    });
    itemEl.createEl("div", {
      cls: "osp-panel-badge",
      text: item.label
    });
    itemEl.createEl("div", {
      cls: "osp-panel-message",
      text: item.value
    });
  }

  renderPreviewSection(containerEl, "最近问题", issueItems, "暂无问题摘要。", (parent, item) => {
    parent.createEl("div", {
      cls: "osp-panel-badge",
      text: item.badge
    });
    parent.createEl("div", {
      cls: "osp-panel-path",
      text: item.fileLabel
    });
    parent.createEl("div", {
      cls: "osp-panel-message",
      text: item.message
    });
  });

  renderPreviewSection(containerEl, "最近日志", logItems, "暂无日志摘要。", (parent, item) => {
    parent.createEl("div", {
      cls: "osp-panel-badge",
      text: item.badge
    });
    parent.createEl("div", {
      cls: "osp-panel-path",
      text: item.timestamp
    });
    parent.createEl("div", {
      cls: "osp-panel-message",
      text: item.message
    });
  });
}

function renderIssuePanel(containerEl: HTMLElement, state: PluginExecutionState, ui: PublisherPluginUiSettings): void {
  const meta = createIssuePanelMeta(state, ui);
  const items = createIssuePanelItems(state, ui);

  renderPanel(containerEl, meta, items, (parent, item) => {
    parent.createEl("div", {
      cls: "osp-panel-badge",
      text: item.badge
    });
    parent.createEl("div", {
      cls: "osp-panel-path",
      text: item.fileLabel
    });
    parent.createEl("div", {
      cls: "osp-panel-message",
      text: item.message
    });

    if (item.suggestion !== undefined) {
      parent.createEl("div", {
        cls: "osp-panel-hint",
        text: `建议：${item.suggestion}`
      });
    }
  });
}

function renderLogPanel(containerEl: HTMLElement, state: PluginExecutionState): void {
  const meta = createLogPanelMeta(state);
  const items = createLogPanelItems(state);

  renderPanel(containerEl, meta, items, (parent, item) => {
    parent.createEl("div", {
      cls: "osp-panel-badge",
      text: item.badge
    });
    parent.createEl("div", {
      cls: "osp-panel-path",
      text: item.timestamp
    });
    parent.createEl("div", {
      cls: "osp-panel-message",
      text: item.message
    });
  });
}

function renderControlPanelAction(parent: HTMLElement, action: ControlPanelAction, runCommand: CommandRunner): void {
  const itemEl = parent.createDiv({
    cls: "osp-panel-item"
  });
  const buttonEl = itemEl.createEl("button", {
    text: action.buttonLabel
  });

  if (action.command === "publish") {
    buttonEl.addClass("mod-cta");
  }

  buttonEl.disabled = action.isDisabled;
  buttonEl.addEventListener("click", () => {
    void runCommand(action.command);
  });
  itemEl.createEl("div", {
    cls: "osp-panel-path",
    text: action.label
  });
  itemEl.createEl("div", {
    cls: "osp-panel-message",
    text: action.description
  });
}

function renderPanel<T extends IssuePanelItem | LogPanelItem>(
  containerEl: HTMLElement,
  meta: PanelMeta,
  items: T[],
  renderItem: (parent: HTMLElement, item: T) => void
): void {
  containerEl.empty();
  containerEl.addClass("osp-panel");
  containerEl.createEl("h2", {
    text: meta.title
  });
  containerEl.createEl("p", {
    cls: "osp-panel-summary",
    text: meta.summary
  });

  if (items.length === 0) {
    containerEl.createEl("p", {
      cls: "osp-panel-empty",
      text: meta.emptyMessage
    });
    return;
  }

  const listEl = containerEl.createDiv({
    cls: "osp-panel-list"
  });

  for (const item of items) {
    const itemEl = listEl.createDiv({
      cls: "osp-panel-item"
    });

    renderItem(itemEl, item);
  }
}

function renderPreviewSection<T extends IssuePanelItem | LogPanelItem>(
  containerEl: HTMLElement,
  title: string,
  items: T[],
  emptyMessage: string,
  renderItem: (parent: HTMLElement, item: T) => void
): void {
  containerEl.createEl("h3", {
    text: title
  });

  if (items.length === 0) {
    containerEl.createEl("p", {
      cls: "osp-panel-empty",
      text: emptyMessage
    });
    return;
  }

  const listEl = containerEl.createDiv({
    cls: "osp-panel-list"
  });

  for (const item of items) {
    const itemEl = listEl.createDiv({
      cls: "osp-panel-item"
    });
    renderItem(itemEl, item);
  }
}
