import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { TargetsView } from "@/components/targets/TargetsView";
import type { Account, Action } from "@/lib/types";
import { renderWithQueryClient } from "@/test/query-test-utils";

const baseAccounts: Account[] = [
  {
    id: 1,
    account_name: "Alpha",
    telegram_name: null,
    phone: "+1000000000",
    user_id: 100,
    status: "stopped",
    last_seen_at: null,
    api_id_override: null,
    api_hash_override: null,
    proxy_url: null,
    join_max_attempts_override: null,
    join_cooldown_seconds_override: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: null,
  },
];

const baseActions: Action[] = [
  {
    id: 1,
    name: "Test Action",
    button_type: "player_list",
    random_fallback_enabled: true,
    is_two_step: false,
  },
];

describe("TargetsView", () => {
  it("renders account-first view by default", () => {
    renderWithQueryClient(
      <TargetsView
        view="account"
        accounts={baseAccounts}
        actions={baseActions}
        accountsLoading={false}
        actionsLoading={false}
        selectedAccountId={1}
        selectedActionId={null}
        accountOverrides={{}}
        actionOverrides={{}}
        onViewChange={vi.fn()}
        onSelectAccount={vi.fn()}
        onSelectAction={vi.fn()}
        onOpenConfig={vi.fn()}
        onStartCopy={vi.fn()}
      />
    );

    expect(screen.getByText("Account-First")).toBeInTheDocument();
    expect(screen.getByText("Targets for Alpha")).toBeInTheDocument();
  });

  it("renders action-first view when selected", () => {
    renderWithQueryClient(
      <TargetsView
        view="action"
        accounts={baseAccounts}
        actions={baseActions}
        accountsLoading={false}
        actionsLoading={false}
        selectedAccountId={null}
        selectedActionId={1}
        accountOverrides={{}}
        actionOverrides={{}}
        onViewChange={vi.fn()}
        onSelectAccount={vi.fn()}
        onSelectAction={vi.fn()}
        onOpenConfig={vi.fn()}
        onStartCopy={vi.fn()}
      />
    );

    expect(screen.getByText("Action-First")).toBeInTheDocument();
    expect(screen.getByText("Test Action - Account Targets")).toBeInTheDocument();
  });

  it("shows empty states when no accounts or actions", () => {
    renderWithQueryClient(
      <TargetsView
        view="account"
        accounts={[]}
        actions={[]}
        accountsLoading={false}
        actionsLoading={false}
        selectedAccountId={null}
        selectedActionId={null}
        accountOverrides={{}}
        actionOverrides={{}}
        onViewChange={vi.fn()}
        onSelectAccount={vi.fn()}
        onSelectAction={vi.fn()}
        onOpenConfig={vi.fn()}
        onStartCopy={vi.fn()}
      />
    );

    expect(screen.getByText("No accounts yet")).toBeInTheDocument();
  });

  it("prompts to select an account or action when none selected", () => {
    renderWithQueryClient(
      <TargetsView
        view="account"
        accounts={baseAccounts}
        actions={baseActions}
        accountsLoading={false}
        actionsLoading={false}
        selectedAccountId={null}
        selectedActionId={null}
        accountOverrides={{}}
        actionOverrides={{}}
        onViewChange={vi.fn()}
        onSelectAccount={vi.fn()}
        onSelectAction={vi.fn()}
        onOpenConfig={vi.fn()}
        onStartCopy={vi.fn()}
      />
    );

    expect(screen.getByText("Select an account")).toBeInTheDocument();
  });
});
