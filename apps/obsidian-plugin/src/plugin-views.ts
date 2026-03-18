import { ItemView, type WorkspaceLeaf } from "obsidian";

import {
  createIssuePanelItems,
  createIssuePanelMeta,
  createLogPanelItems,
  createLogPanelMeta,
  type IssuePanelItem,
  type LogPanelItem,
  type PanelMeta
} from "./plugin-view-model.js";
import type { PluginExecutionState } from "./plugin-shell.js";

export const ISSUE_LIST_VIEW_TYPE = "osp-issues-view";
export const BUILD_LOG_VIEW_TYPE = "osp-build-logs-view";

type StateReader = () => PluginExecutionState;

export class IssueListView extends ItemView {
  public constructor(leaf: WorkspaceLeaf, private readonly readState: StateReader) {
    super(leaf);
  }

  public override getViewType(): string {
    return ISSUE_LIST_VIEW_TYPE;
  }

  public override getDisplayText(): string {
    return "Publish Issues";
  }

  public override async onOpen(): Promise<void> {
    this.refresh();
  }

  public override async onClose(): Promise<void> {
    this.contentEl.empty();
  }

  public refresh(): void {
    renderIssuePanel(this.contentEl, this.readState());
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
    return "Build Logs";
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

function renderIssuePanel(containerEl: HTMLElement, state: PluginExecutionState): void {
  const meta = createIssuePanelMeta(state);
  const items = createIssuePanelItems(state);

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
        text: `Suggestion: ${item.suggestion}`
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
