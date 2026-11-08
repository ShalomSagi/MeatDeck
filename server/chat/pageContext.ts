// Page context for chat, built in plain code and kept compact: what the user is looking at or
// attached (Today, Work, a project, a doc, a queue row, a draft, a repo).
import { itemEntity, matchProjects, prEntity, repoShort, sameRepo } from "../../shared/projects.ts";
import type { Chat, ContextRef } from "../../shared/types.ts";
import { currentQueue } from "../digest.ts";
import { github } from "../github.ts";
import { store } from "../store/store.ts";

const ctxKey = (r: ContextRef) =>
  r.type === "project" || r.type === "note" || r.type === "draft"
    ? `${r.type}:${r.id}`
    : r.type === "repo"
      ? `repo:${r.repo}`
      : r.type === "action"
        ? `action:${r.key}`
        : r.type;

/** Add this turn's attachments to what the chat already remembers; returns the ones that are new. */
export function remember(chat: Chat, refs: ContextRef[]): ContextRef[] {
  const known = new Set((chat.context ?? []).map(ctxKey));
  const added = refs.filter((r) => !known.has(ctxKey(r)));
  chat.context = [...(chat.context ?? []), ...added];
  return added;
}

export function contextText(refs: ContextRef[]): string {
  const parts: string[] = [];
  const projects = store.projects();
  const links = store.links();
  for (const ref of refs) {
    if (ref.type === "today") {
      const day = store.today();
      parts.push(
        JSON.stringify({
          page: "Today",
          brief: day.brief?.summary,
          openTodos: day.todos
            .filter((t) => t.status === "open")
            .map((t) => ({ id: t.id, p: t.priority, title: t.title, due: t.due, url: t.url })),
          drafts: day.messages
            .filter((m) => m.status === "draft" || m.status === "approved")
            .map((m) => ({ id: m.id, to: m.to, s: m.status, text: m.text.slice(0, 200) })),
        }),
      );
    } else if (ref.type === "work") {
      parts.push(
        JSON.stringify({
          page: "Work (open items + my PRs)",
          items: store.items().map((i) => ({ id: i.id, state: i.state, title: i.title, waitingOn: i.waitingOn })),
          myPrs: github.mine.map((p) => `${repoShort(p.repo)}#${p.number} ${p.title} ${p.url}`),
          reviewRequests: github.reviewRequests.map(
            (p) => `${repoShort(p.repo)}#${p.number} ${p.title} by ${p.author} ${p.url}`,
          ),
        }),
      );
    } else if (ref.type === "project") {
      const p = projects.find((x) => x.id === ref.id);
      if (!p) continue;
      const items = store.items().filter((i) => matchProjects(itemEntity(i), projects, links).includes(p.id));
      const prs = [...github.mine, ...github.reviewRequests].filter((pr) =>
        matchProjects(prEntity(pr), projects, links).includes(p.id),
      );
      parts.push(
        JSON.stringify({
          page: `Project: ${p.name}`,
          id: p.id,
          kind: p.kind,
          url: p.url,
          description: p.description.slice(0, 1200),
          whereItStands: p.context?.summary,
          rules: p.rules,
          items: items.map((i) => ({ id: i.id, state: i.state, title: i.title, url: i.url })),
          prs: prs.map((pr) => `${repoShort(pr.repo)}#${pr.number} ${pr.title} ${pr.url}`),
        }),
      );
    } else if (ref.type === "note") {
      const n = store.notes().find((x) => x.id === ref.id);
      if (!n) continue;
      parts.push(
        JSON.stringify({
          page: `Doc: ${n.icon ? `${n.icon} ` : ""}${n.title || "Untitled"}`,
          id: n.id,
          kind: n.kind,
          text: n.text.slice(0, 4000),
        }),
      );
    } else if (ref.type === "action") {
      // A queue row the user wants to talk about: everything we know about it, so Claude can act on it
      // (close the PR, rewrite the todo, message someone…) without searching first.
      const a = currentQueue().find((x) => x.key === ref.key);
      const pr = a?.pr ? [...github.mine, ...github.reviewRequests].find((p) => p.url === a.pr!.url) : undefined;
      const todo = a?.todoId ? store.today().todos.find((t) => t.id === a.todoId) : undefined;
      const draft = a?.messageId ? store.today().messages.find((m) => m.id === a.messageId) : undefined;
      const item = a?.itemId ? store.items().find((i) => i.id === a.itemId) : undefined;
      parts.push(
        JSON.stringify({
          page: `Queue item: ${a?.title ?? ref.title}`,
          ...(a
            ? {
                key: a.key,
                step: a.verb,
                ball: a.ball,
                tier: a.tier,
                why: a.why,
                url: a.url,
                ...(a.nudgeIn ? { nudgeIn: a.nudgeIn } : {}),
                ...(a.steps ? { blockers: a.steps } : {}),
              }
            : { note: "This row is no longer in the queue (done, dismissed or changed)." }),
          ...(pr
            ? {
                pr: {
                  url: pr.url,
                  title: pr.title,
                  author: pr.author,
                  draft: pr.isDraft,
                  ci: pr.checks,
                  failing: pr.failingChecks,
                  review: pr.reviewDecision,
                  approvedBy: pr.approvedBy,
                  changesRequestedBy: pr.changesRequestedBy,
                  pendingReviewers: pr.pendingReviewers,
                  openThreads: pr.unresolvedThreads,
                  mergeable: pr.mergeable,
                },
              }
            : {}),
          ...(todo
            ? { todo: { id: todo.id, ref: todo.ref, title: todo.title, notes: todo.notes, status: todo.status } }
            : {}),
          ...(draft ? { draft: { id: draft.id, to: draft.to, text: draft.text, status: draft.status } } : {}),
          ...(item
            ? { item: { id: item.id, title: item.title, state: item.state, status: item.status, url: item.url } }
            : {}),
        }),
      );
    } else if (ref.type === "draft") {
      // A drafted message the user wants to talk about: everything about it, so Claude can reword,
      // retarget or send it without searching first.
      const m = store.today().messages.find((x) => x.id === ref.id);
      parts.push(
        JSON.stringify(
          m
            ? {
                page: `Draft message to ${m.to}`,
                draft: {
                  id: m.id,
                  ref: m.ref,
                  to: m.to,
                  channel: m.channel,
                  target: m.target,
                  threadTs: m.threadTs,
                  status: m.status,
                  text: m.text,
                  why: m.reason,
                  url: m.url,
                },
              }
            : { page: ref.title, note: "This draft is gone (sent, dismissed or from an earlier day)." },
        ),
      );
    } else if (ref.type === "repo") {
      parts.push(
        JSON.stringify({
          page: `Repo: ${ref.repo}`,
          prs: [...github.mine, ...github.reviewRequests]
            .filter((pr) => sameRepo(pr.repo, ref.repo))
            .map((pr) => `#${pr.number} ${pr.title} ci=${pr.checks} review=${pr.reviewDecision} ${pr.url}`),
        }),
      );
    }
  }
  return parts.length ? `\n\nWhat the user is looking at / mentioned (attached by the app):\n${parts.join("\n")}` : "";
}
