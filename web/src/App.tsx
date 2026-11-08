import { LoaderCircle } from "lucide-react";
import { useMemo, useState } from "react";
import { buildActions } from "../../shared/actions.ts";
import { asSelection, type ModelSelection } from "../../shared/providers.ts";
import type { Chat, ContextRef } from "../../shared/types.ts";
import { api, useDashboard } from "./api.ts";
import { buildBoard } from "./board.ts";
import { AppHeader } from "./components/app/AppHeader.tsx";
import { PageContent } from "./components/app/PageContent.tsx";
import { ComposerDock } from "./components/chat/ComposerDock.tsx";
import { meetingTemplate } from "./components/docs/NoteEditor.tsx";
import type { Scope } from "./components/projects/scope.ts";
import { RunPanel } from "./components/runs/RunPanel.tsx";
import type { SettingsPage } from "./components/settings/settingsSearch.tsx";
import { Sidebar } from "./components/sidebar/Sidebar.tsx";
import { useChatAbout } from "./hooks/useChatAbout.ts";
import { useComposerFocus } from "./hooks/useComposerFocus.ts";
import { usePeekGithubOnFocus } from "./hooks/usePeekGithubOnFocus.ts";
import { useRunSignals } from "./hooks/useRunSignals.ts";
import { navTarget, pageRefFor, pageTitle, type View } from "./navigation.ts";

export function App() {
  // Chat: the open conversation streams in over SSE ("chat" events).
  const [chat, setChat] = useState<Chat | null>(null);
  const [chatModel, setChatModel] = useState<ModelSelection | null>(null);
  const { focusSignal, focusComposer } = useComposerFocus();
  usePeekGithubOnFocus();
  const attach = useChatAbout();
  // useDashboard wraps this in useEffectEvent, so it always sees the open chat.
  const { state, connected } = useDashboard((c) => {
    if (c.id === chat?.id) setChat(c);
  });
  const [view, setView] = useState<View>("today");
  const [settingsPage, setSettingsPage] = useState<SettingsPage>("general");
  const [scope, setScope] = useState<Scope>(null);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [runOpen, setRunOpen] = useState(false);
  const [logId, setLogId] = useState<string | undefined>();
  const board = useMemo(() => (state ? buildBoard(state) : []), [state]);
  // The ranked action queue (code baseline + Claude's overrides), shared by Today, Work and project pages.
  const queue = useMemo(() => (state ? buildActions({ state }) : { open: [], done: [] }), [state]);

  const go = (v: View, page?: SettingsPage) => {
    const target = navTarget(v, page, settingsPage);
    setView(target.view);
    if (target.settingsPage) setSettingsPage(target.settingsPage);
    setScope(null);
    setNoteId(null);
  };
  const openNote = (id: string) => {
    setView("notes");
    setScope(null);
    setNoteId(id);
  };
  const newNote = async (kind: "note" | "meeting") => {
    const date = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const n = await api.createNote(
      kind === "meeting" ? { kind, title: `Meeting · ${date}`, doc: meetingTemplate() } : { kind },
    );
    openNote(n.id);
  };
  useRunSignals(state, openNote);

  if (!state)
    return (
      <div className="drag-region flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" /> Connecting to the local server…
      </div>
    );

  // The page you're on, attached to what you ask by default.
  const pageRef = pageRefFor(view, scope, noteId);
  const model: ModelSelection =
    chatModel ??
    (chat
      ? asSelection(chat.model, chat.provider, chat.effort)
      : asSelection(state.settings.chatModel, state.settings.chatProvider, state.settings.chatEffort));
  const chatBusy = chat?.messages.at(-1)?.status === "running";
  // On the chat page the prompt box continues the open chat. Anywhere else it starts a new chat,
  // carrying the page you're on, and takes you to it.
  const sendToClaude = async (text: string, refs: ContextRef[]) => {
    const continuing = view === "chat" && chat;
    const c = continuing ? await api.sendChat(chat.id, text, refs, model) : await api.startChat(text, refs, model);
    setChat(c);
    setChatModel(null);
    if (!continuing) go("chat");
  };
  const openChat = async (id: string) => {
    go("chat");
    setChatModel(null);
    setChat(await api.getChat(id));
  };

  return (
    <div className="flex h-full">
      <Sidebar
        state={state}
        board={board}
        view={view}
        settingsPage={settingsPage}
        scope={scope}
        noteId={noteId}
        connected={connected}
        onView={go}
        onScope={(s) => {
          setView("work");
          setNoteId(null);
          setScope(s);
        }}
        onOpenNote={openNote}
        onNewNote={() => void newNote("note")}
        queueCount={queue.open.filter((a) => a.tier !== "watch").length}
      />

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader
          state={state}
          title={pageTitle(view, scope, noteId, state)}
          view={view}
          onGo={go}
          onOpenRun={() => {
            setLogId(undefined);
            setRunOpen(true);
          }}
          onToggleRun={() => {
            setLogId(undefined);
            setRunOpen((o) => !o);
          }}
        />

        <div className="relative flex min-h-0 flex-1">
          <div className="relative flex min-w-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto">
              <div className="mx-auto w-full max-w-5xl px-5 py-6 pb-44">
                <PageContent
                  state={state}
                  view={view}
                  scope={scope}
                  noteId={noteId}
                  chat={chat}
                  board={board}
                  queue={queue}
                  settingsPage={settingsPage}
                  onSettingsPage={setSettingsPage}
                  onGo={go}
                  onOpenNote={openNote}
                  onNewNote={(k) => void newNote(k)}
                  onOpenProject={(p) => {
                    setView("work");
                    setNoteId(null);
                    setScope({ kind: "project", id: p.id });
                  }}
                  onWorkScope={(s) => {
                    setView("work");
                    setScope(s);
                  }}
                  onScopeGone={() => setScope(null)}
                  onNewChat={() => {
                    setChat(null);
                    setChatModel(null);
                    focusComposer();
                  }}
                  onOpenChat={(id) => void openChat(id)}
                  onOpenLog={(id) => {
                    setLogId(id);
                    setRunOpen(true);
                  }}
                  onAsk={(prompt) => void sendToClaude(prompt, [])}
                />
              </div>
            </div>

            <ComposerDock
              state={state}
              view={view}
              chat={chat}
              pageRef={pageRef}
              selection={model}
              onSelect={setChatModel}
              busy={chatBusy}
              onSend={(t, refs) => void sendToClaude(t, refs)}
              onStop={() => chat && void api.stopChat(chat.id)}
              focusSignal={focusSignal}
              attach={attach}
            />

            <RunPanel
              live={state.run}
              runs={state.runs}
              runId={logId}
              open={runOpen}
              onClose={() => setRunOpen(false)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
