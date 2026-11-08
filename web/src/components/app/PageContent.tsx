/** The page for the current view (App owns which one that is). */
import { useState } from "react";
import type { Action } from "../../../../shared/actions.ts";
import { sameRepo } from "../../../../shared/projects.ts";
import type { Chat, DashboardState, Project } from "../../../../shared/types.ts";
import { type BoardEntry, withoutActions } from "../../board.ts";
import { History } from "../History.tsx";
import { ChatView } from "../chat/ChatView.tsx";
import { NoteEditor } from "../docs/NoteEditor.tsx";
import { NotesList } from "../docs/NotesList.tsx";
import { ProjectPage } from "../projects/ProjectPage.tsx";
import { RepoHeader } from "../projects/RepoHeader.tsx";
import { entriesIn, type Scope } from "../projects/scope.ts";
import { ActionQueue } from "../queue/ActionQueue.tsx";
import { SettingsView } from "../settings/SettingsView.tsx";
import { IntegrationsView } from "../settings/integrations/IntegrationsView.tsx";
import type { SettingsPage } from "../settings/settingsSearch.tsx";
import { TodayView } from "../today/TodayView.tsx";
import { Tabs } from "../ui.tsx";
import { Usage } from "../usage/Usage.tsx";
import { Board } from "../work/Board.tsx";
import { PullRequests } from "../work/PullRequests.tsx";
import { WorkView } from "../work/WorkView.tsx";
import type { View } from "../../navigation.ts";

export function PageContent({
  state,
  view,
  scope,
  noteId,
  chat,
  board,
  queue,
  settingsPage,
  onSettingsPage,
  onGo,
  onOpenNote,
  onNewNote,
  onOpenProject,
  onWorkScope,
  onScopeGone,
  onNewChat,
  onOpenChat,
  onOpenLog,
  onAsk,
}: {
  state: DashboardState;
  view: View;
  scope: Scope;
  noteId: string | null;
  chat: Chat | null;
  board: BoardEntry[];
  queue: { open: Action[]; done: Action[] };
  settingsPage: SettingsPage;
  onSettingsPage: (p: SettingsPage) => void;
  onGo: (v: View) => void;
  onOpenNote: (id: string) => void;
  onNewNote: (kind: "note" | "meeting") => void;
  onOpenProject: (p: Project) => void;
  /** A project or repo picked on the Work page. */
  onWorkScope: (s: Scope) => void;
  /** The open project was hidden or deleted. */
  onScopeGone: () => void;
  onNewChat: () => void;
  onOpenChat: (id: string) => void;
  onOpenLog: (id: string) => void;
  /** Starts a chat with this prompt (the integrations page asks Claude to set one up). */
  onAsk: (prompt: string) => void;
}) {
  const [workTab, setWorkTab] = useState<"board" | "prs">("board");
  const noteMeta = noteId ? state.notes.find((n) => n.id === noteId) : undefined;
  return (
    <>
      {view === "today" && (
        <TodayView state={state} queue={queue} onOpenNote={onOpenNote} onOpenProject={onOpenProject} />
      )}
      {view === "work" && !scope && (
        <>
          <Tabs
            value={workTab}
            onChange={setWorkTab}
            tabs={[
              { id: "board", label: "By project", count: queue.open.length },
              {
                id: "prs",
                label: "Pull requests",
                count: state.github.mine.length + state.github.reviewRequests.length,
              },
            ]}
          />
          {workTab === "board" ? (
            <WorkView state={state} actions={queue.open} board={board} onScope={onWorkScope} onOpenNote={onOpenNote} />
          ) : (
            <PullRequests github={state.github} actions={queue.open} />
          )}
        </>
      )}
      {view === "work" && scope?.kind === "repo" && (
        <>
          <RepoHeader repo={scope.repo} />
          <ActionQueue
            actions={queue.open.filter((a) => a.repo && sameRepo(a.repo, scope.repo))}
            state={state}
            onOpenNote={onOpenNote}
            hideProject={false}
            empty={<p className="px-1 text-sm text-muted-foreground">Nothing needs you in this repo.</p>}
          />
          <div className="mt-8">
            <p className="mb-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Also open · no move needed
            </p>
            <Board entries={withoutActions(entriesIn(board, scope), queue.open)} />
          </div>
        </>
      )}
      {view === "work" &&
        scope?.kind === "project" &&
        (() => {
          const project = state.projects.find((p) => p.id === scope.id);
          return project ? (
            <ProjectPage
              project={project}
              state={state}
              entries={withoutActions(entriesIn(board, scope), queue.open)}
              actions={queue.open.filter((a) => a.projectIds.includes(project.id))}
              onGone={onScopeGone}
              onOpenNote={onOpenNote}
            />
          ) : null;
        })()}
      {view === "notes" && !noteId && (
        <NotesList notes={state.notes} projects={state.projects} onOpen={onOpenNote} onNew={onNewNote} />
      )}
      {view === "notes" && noteId && (
        <NoteEditor
          key={noteId}
          noteId={noteId}
          meta={noteMeta}
          projects={state.projects}
          onBack={() => onGo("notes")}
        />
      )}
      {view === "chat" && (
        <ChatView
          chat={chat}
          state={state}
          onNew={onNewChat}
          onOpenChat={onOpenChat}
          onOpenNote={onOpenNote}
          onGoToday={() => onGo("today")}
        />
      )}
      {view === "history" && <History history={state.history} />}
      {view === "usage" && <Usage usage={state.usage} />}
      {view === "settings" && (
        <SettingsView
          state={state}
          page={settingsPage}
          onPage={onSettingsPage}
          onOpenLog={onOpenLog}
          integrations={<IntegrationsView state={state} onAsk={onAsk} />}
        />
      )}
    </>
  );
}
