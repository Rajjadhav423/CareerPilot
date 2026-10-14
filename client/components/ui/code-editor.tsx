"use client";

import { useEffect, useImperativeHandle, useRef } from "react";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { foldedRanges, HighlightStyle, syntaxHighlighting, syntaxTree, unfoldEffect } from "@codemirror/language";
import { linter, lintGutter } from "@codemirror/lint";
import { EditorSelection, EditorState, type StateEffect } from "@codemirror/state";
import { EditorView, placeholder as placeholderText } from "@codemirror/view";
import { tags } from "@lezer/highlight";
import { basicSetup } from "codemirror";

import { cn } from "@/lib/utils";

export type CodeEditorHandle = {
  /** Selects characters start…end (unfolding them if collapsed), scrolls them to the middle and focuses. */
  select: (start: number, end: number) => void;
  focus: () => void;
  /** Types text at the cursor (replacing the selection), like pasting. */
  insert: (text: string) => void;
  /**
   * Inserts text as JSON: as is inside a string ("Find me on |" → "Find me on {{github}}"), quoted anywhere else
   * ("href": | → "href": "{{github}}"), so the document stays valid JSON.
   */
  insertJsonText: (text: string) => void;
};

type CodeEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** Accessible name of the editing area */
  "aria-label": string;
  "aria-describedby"?: string;
  /** Red border, like an invalid TextField */
  invalid?: boolean;
  placeholder?: string;
  className?: string;
  ref?: React.Ref<CodeEditorHandle>;
};

/*
 * Colours come only from the design tokens (app/globals.css), so the editor follows light/dark and the accent colour.
 * The frame matches TextField/Textarea: input background, input border, focus border + ring, 4px radius.
 */
const theme = EditorView.theme({
  "&": {
    color: "var(--color-foreground)",
    backgroundColor: "var(--color-input)",
    fontSize: "12px",
    height: "100%",
  },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--font-mono)", lineHeight: "20px", overscrollBehavior: "contain" },
  ".cm-content": { padding: "6px 0", caretColor: "var(--color-foreground)" },
  ".cm-line": { padding: "0 8px 0 4px" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--color-foreground)" },
  // Gutters: line numbers, collapse arrows and error markers, like a sunken sidebar
  ".cm-gutters": {
    backgroundColor: "var(--color-surface-sunken)",
    color: "var(--color-subtlest)",
    borderRight: "1px solid var(--color-border)",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 6px 0 10px", minWidth: "32px" },
  ".cm-foldGutter .cm-gutterElement": { padding: "0 4px", cursor: "pointer", color: "var(--color-subtle)" },
  ".cm-foldGutter .cm-gutterElement:hover": { color: "var(--color-foreground)" },
  ".cm-activeLineGutter": { backgroundColor: "var(--color-neutral-subtle-hovered)", color: "var(--color-foreground)" },
  ".cm-activeLine": { backgroundColor: "var(--color-neutral-subtle-hovered)" },
  // Selection and matches use the selected/brand tokens
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground, ::selection": {
    backgroundColor: "var(--color-selected) !important",
  },
  ".cm-selectionMatch": { backgroundColor: "var(--color-selected-hovered)" },
  "&.cm-focused .cm-matchingBracket": {
    backgroundColor: "var(--color-selected)",
    outline: "1px solid var(--color-border-selected)",
  },
  "&.cm-focused .cm-nonmatchingBracket": { backgroundColor: "var(--color-danger)" },
  ".cm-searchMatch": { backgroundColor: "var(--color-warning)", outline: "1px solid var(--color-warning-bold)" },
  ".cm-searchMatch.cm-searchMatch-selected": { backgroundColor: "var(--color-selected-pressed)" },
  // A collapsed object or array: "{…}" pill
  ".cm-foldPlaceholder": {
    backgroundColor: "var(--color-neutral)",
    border: "1px solid var(--color-border)",
    borderRadius: "3px",
    color: "var(--color-subtle)",
    padding: "0 4px",
    margin: "0 2px",
  },
  // Panels (find / replace) look like the app's toolbar
  ".cm-panels": {
    backgroundColor: "var(--color-surface-raised)",
    color: "var(--color-foreground)",
    fontFamily: "var(--font-sans)",
    fontSize: "13px",
  },
  ".cm-panels.cm-panels-top": { borderBottom: "1px solid var(--color-border)" },
  ".cm-panels.cm-panels-bottom": { borderTop: "1px solid var(--color-border)" },
  ".cm-panel.cm-search": { padding: "6px 8px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" },
  ".cm-panel.cm-search label": { display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--color-subtle)" },
  ".cm-textfield": {
    backgroundColor: "var(--color-input)",
    color: "var(--color-foreground)",
    border: "1px solid var(--color-border-input)",
    borderRadius: "4px",
    padding: "3px 6px",
    fontSize: "13px",
    margin: "0",
  },
  ".cm-textfield:focus": { outline: "none", borderColor: "var(--color-focus)", boxShadow: "0 0 0 1px var(--color-focus)" },
  ".cm-button": {
    backgroundImage: "none",
    backgroundColor: "var(--color-neutral)",
    color: "var(--color-foreground)",
    border: "none",
    borderRadius: "4px",
    padding: "3px 10px",
    fontSize: "13px",
    fontWeight: "500",
    margin: "0",
    cursor: "pointer",
  },
  ".cm-button:hover": { backgroundColor: "var(--color-neutral-hovered)" },
  ".cm-button:active": { backgroundImage: "none", backgroundColor: "var(--color-neutral-pressed)" },
  ".cm-panel.cm-search [name=close]": {
    color: "var(--color-subtle)",
    fontSize: "16px",
    padding: "0 6px",
    cursor: "pointer",
  },
  // Lint: JSON syntax errors
  ".cm-lintRange-error": {
    backgroundImage: "none",
    textDecoration: "underline wavy var(--color-danger-bold)",
    textUnderlineOffset: "3px",
  },
  ".cm-lint-marker-error": { content: "none" },
  ".cm-diagnostic": { fontFamily: "var(--font-sans)", fontSize: "13px", padding: "4px 8px" },
  ".cm-diagnostic-error": { borderLeft: "3px solid var(--color-danger-bold)" },
  // Tooltips (lint messages, autocomplete) are overlays
  ".cm-tooltip": {
    backgroundColor: "var(--color-surface-overlay)",
    color: "var(--color-foreground)",
    border: "1px solid var(--color-border)",
    borderRadius: "4px",
    boxShadow: "var(--shadow-overlay)",
  },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
    backgroundColor: "var(--color-selected)",
    color: "var(--color-selected-text)",
  },
  ".cm-placeholder": { color: "var(--color-subtlest)" },
});

/** JSON colours from the status-text tokens: readable on input backgrounds in both themes. */
const highlight = HighlightStyle.define([
  { tag: tags.propertyName, color: "var(--color-discovery-text)" },
  { tag: tags.string, color: "var(--color-success-text)" },
  { tag: tags.number, color: "var(--color-warning-text)" },
  { tag: [tags.bool, tags.null], color: "var(--color-information-text)", fontWeight: "600" },
  { tag: [tags.brace, tags.squareBracket, tags.separator, tags.punctuation], color: "var(--color-subtle)" },
  { tag: tags.invalid, color: "var(--color-danger-text)" },
]);

/**
 * Code editor for JSON (CodeMirror 6): line numbers, collapse/expand of objects and arrays, bracket matching,
 * auto-closing brackets and quotes, auto-indent, find & replace (Ctrl/Cmd+F), multiple cursors, undo history and live
 * JSON syntax errors. Looks like the app's other fields.
 */
function CodeEditor({
  value,
  onChange,
  invalid = false,
  placeholder,
  className,
  ref,
  ...aria
}: CodeEditorProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // The editor is created once; it calls the latest onChange through this ref
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  // Create the editor once
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          json(),
          linter(jsonParseLinter(), { delay: 300 }),
          lintGutter(),
          syntaxHighlighting(highlight),
          theme,
          EditorView.lineWrapping,
          EditorState.tabSize.of(2),
          placeholder ? placeholderText(placeholder) : [],
          EditorView.contentAttributes.of({
            "aria-label": aria["aria-label"],
            ...(aria["aria-describedby"] ? { "aria-describedby": aria["aria-describedby"] } : {}),
            spellcheck: "false",
            autocapitalize: "off",
            autocorrect: "off",
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    view.current = editor;
    return () => {
      editor.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- created once; value changes are applied below
  }, []);

  // Text changed outside the editor (Format, Auto-fix, Load sample, a tab switch): replace the content
  useEffect(() => {
    const editor = view.current;
    if (!editor) return;
    const current = editor.state.doc.toString();
    if (current !== value) {
      editor.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  useImperativeHandle(ref, () => ({
    focus: () => view.current?.focus(),
    insert: (text) => {
      const editor = view.current;
      if (!editor) return;
      editor.dispatch(editor.state.replaceSelection(text), { scrollIntoView: true });
      editor.focus();
    },
    insertJsonText: (text) => {
      const editor = view.current;
      if (!editor) return;
      const { from, to } = editor.state.selection.main;
      // The innermost syntax node at the cursor: a String node (between its quotes) means we're inside a string
      const node = syntaxTree(editor.state).resolveInner(from, -1);
      const inString = node.name === "String" && from > node.from && from < node.to && to < node.to;
      const insert = inString ? text : JSON.stringify(text);
      editor.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
        scrollIntoView: true,
      });
      editor.focus();
    },
    select: (start, end) => {
      const editor = view.current;
      if (!editor) return;
      const length = editor.state.doc.length;
      const from = Math.max(0, Math.min(start, length));
      const to = Math.max(from, Math.min(end, length));
      // Open any collapsed region hiding the selection
      const effects: StateEffect<unknown>[] = [];
      foldedRanges(editor.state).between(from, to, (foldFrom, foldTo) => {
        effects.push(unfoldEffect.of({ from: foldFrom, to: foldTo }));
      });
      effects.push(EditorView.scrollIntoView(from, { y: "center" }));
      editor.dispatch({ selection: EditorSelection.range(from, to), effects });
      editor.focus();
    },
  }), []);

  return (
    <div
      ref={host}
      data-slot="code-editor"
      aria-invalid={invalid || undefined}
      className={cn(
        "h-[min(70dvh,40rem)] min-h-80 w-full overflow-hidden rounded-sm border border-border-input bg-input transition-colors",
        "focus-within:border-focus focus-within:ring-1 focus-within:ring-focus",
        "aria-invalid:border-danger-bold [&_.cm-editor]:h-full",
        className,
      )}
    />
  );
}

export { CodeEditor };
