import { useEffect, useMemo, useRef } from "react";

import { $getRoot, defineExtension } from "lexical";
import { HorizontalRuleExtension, TabIndentationExtension } from "@lexical/extension";
import { HistoryExtension } from "@lexical/history";
import { CheckListExtension, ListExtension } from "@lexical/list";
import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  CHECK_LIST,
  ELEMENT_TRANSFORMERS,
  MULTILINE_ELEMENT_TRANSFORMERS,
  TEXT_FORMAT_TRANSFORMERS,
  TEXT_MATCH_TRANSFORMERS,
  type Transformer,
  registerMarkdownShortcuts,
} from "@lexical/markdown";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { LexicalExtensionComposer } from "@lexical/react/LexicalExtensionComposer";
import { RichTextExtension } from "@lexical/rich-text";

import { AutoLinkExtension } from "@/components/editor/extensions/auto-link";
import { CodeExtension } from "@/components/editor/extensions/code";
import { FormatStateExtension } from "@/components/editor/extensions/format-state";
import { LinkExtension } from "@/components/editor/extensions/link";
import { BulletedListPickerPlugin } from "@/components/editor/plugins/component-picker/bulleted-list-picker-plugin";
import { CheckListPickerPlugin } from "@/components/editor/plugins/component-picker/check-list-picker-plugin";
import { CodePickerPlugin } from "@/components/editor/plugins/component-picker/code-picker-plugin";
import { ComponentPicker } from "@/components/editor/plugins/component-picker/component-picker-plugin";
import { DividerPickerPlugin } from "@/components/editor/plugins/component-picker/divider-picker-plugin";
import { HeadingPickerPlugin } from "@/components/editor/plugins/component-picker/heading-picker-plugin";
import { NumberedListPickerPlugin } from "@/components/editor/plugins/component-picker/numbered-list-picker-plugin";
import { ParagraphPickerPlugin } from "@/components/editor/plugins/component-picker/paragraph-picker-plugin";
import { QuotePickerPlugin } from "@/components/editor/plugins/component-picker/quote-picker-plugin";
import { ContentEditable } from "@/components/editor/plugins/content-editable";
import { DraggableBlockPlugin } from "@/components/editor/plugins/draggable-block-plugin";
import { FloatingToolbarPlugin } from "@/components/editor/plugins/floating/floating-toolbar-plugin";
import { LinkEditorPlugin } from "@/components/editor/plugins/floating/link-editor-plugin";
import { LanguageProvider } from "@/components/editor/plugins/i18n-plugin";
import { LinkToolbarPlugin } from "@/components/editor/plugins/toolbar/link-toolbar-plugin";
import { editorTheme } from "@/components/editor/theme";
import { HR } from "@/components/editor/transformers/horizontal-rule-transformer";

// Markdown is the storage format: readable as plain text, and what GitHub issue sync expects.
const TRANSFORMERS: Transformer[] = [
  HR,
  CHECK_LIST,
  ...ELEMENT_TRANSFORMERS,
  ...MULTILINE_ELEMENT_TRANSFORMERS,
  ...TEXT_FORMAT_TRANSFORMERS,
  ...TEXT_MATCH_TRANSFORMERS,
];

export type NotionEditorProps = {
  /** Markdown (or plain text) to start from. */
  defaultValue?: string;
  /** Latest saved Markdown from the server. Applied when it changes while the editor is not focused (live updates). */
  value?: string;
  /** Called with Markdown after edits settle (debounced by `changeDelay`). */
  onChange?: (markdown: string) => void;
  /** Milliseconds to wait before `onChange`; 0 reports every edit (use in forms so submit never misses text). */
  changeDelay?: number;
  /** Called with the latest Markdown when focus leaves the editor. */
  onBlur?: (markdown: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  className?: string;
  /** Small surfaces (dialogs, forms): no drag handles and normal padding. "/" and the selection toolbar still work. */
  compact?: boolean;
  id?: string;
  "aria-label"?: string;
};

/** Notion-style editor: no toolbar; "/" inserts blocks, selecting text shows formatting, blocks have drag handles. */
export function NotionEditor({ defaultValue = "", value, onChange, changeDelay = 500, onBlur, placeholder = "Type '/' for commands", readOnly = false, className, compact = false, id, "aria-label": ariaLabel }: NotionEditorProps) {
  const extension = useMemo(
    () =>
      defineExtension({
        name: "@reka/notion-editor",
        namespace: "reka-notion-editor",
        dependencies: [
          RichTextExtension,
          HistoryExtension,
          TabIndentationExtension,
          ListExtension,
          CheckListExtension,
          LinkExtension,
          AutoLinkExtension,
          CodeExtension,
          HorizontalRuleExtension,
          FormatStateExtension,
        ],
        $initialEditorState: () => {
          if (defaultValue.trim()) $convertFromMarkdownString(defaultValue, TRANSFORMERS, undefined, true);
          else $getRoot().clear();
        },
        register: (editor) => registerMarkdownShortcuts(editor, TRANSFORMERS),
        theme: editorTheme,
      }),
    // The editor owns its state after mount; defaultValue only seeds it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return (
    <LanguageProvider>
      <LexicalExtensionComposer extension={extension} contentEditable={null}>
        <div className={["notion-editor relative min-w-0", className].filter(Boolean).join(" ")}>
          <ContentEditable variant={compact ? "default" : "draggable"} placeholder={{ en: placeholder } as never} id={id} aria-label={ariaLabel} />
          {!readOnly && <>
            {!compact && <DraggableBlockPlugin />}
            <FloatingToolbarPlugin formats="basic">
              <LinkToolbarPlugin />
            </FloatingToolbarPlugin>
            <LinkEditorPlugin />
            <ComponentPicker>
              <ParagraphPickerPlugin />
              <HeadingPickerPlugin />
              <BulletedListPickerPlugin />
              <NumberedListPickerPlugin />
              <CheckListPickerPlugin />
              <QuotePickerPlugin />
              <CodePickerPlugin />
              <DividerPickerPlugin />
            </ComponentPicker>
          </>}
          <MarkdownBridge value={value} onChange={onChange} onBlur={onBlur} readOnly={readOnly} changeDelay={changeDelay} />
        </div>
      </LexicalExtensionComposer>
    </LanguageProvider>
  );
}

/** Emits Markdown on change (debounced) and on blur, and applies read-only mode. */
function MarkdownBridge({ value, onChange, onBlur, readOnly, changeDelay }: { value?: string; onChange?: (markdown: string) => void; onBlur?: (markdown: string) => void; readOnly: boolean; changeDelay: number }) {
  const [editor] = useLexicalComposerContext();
  const latest = useRef({ onChange, onBlur });
  latest.current = { onChange, onBlur };

  useEffect(() => { editor.setEditable(!readOnly); }, [editor, readOnly]);

  // Someone else saved a new version: show it, unless the user is typing here (their draft wins until they leave).
  useEffect(() => {
    if (value === undefined) return;
    const root = editor.getRootElement();
    if (root && root.contains(document.activeElement)) return;
    const current = editor.getEditorState().read(() => $convertToMarkdownString(TRANSFORMERS, undefined, true));
    if (current.trim() === value.trim()) return;
    editor.update(() => {
      if (value.trim()) $convertFromMarkdownString(value, TRANSFORMERS, undefined, true);
      else $getRoot().clear();
    }, { tag: "historic" });
  }, [editor, value]);

  useEffect(() => {
    const read = () => editor.getEditorState().read(() => $convertToMarkdownString(TRANSFORMERS, undefined, true));
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stopUpdates = editor.registerUpdateListener(({ dirtyElements, dirtyLeaves, tags }) => {
      // Skip no-op updates and the ones that apply a newer server version (tagged "historic" below).
      if ((!dirtyElements.size && !dirtyLeaves.size) || tags.has("historic")) return;
      clearTimeout(timer);
      if (changeDelay <= 0) latest.current.onChange?.(read());
      else timer = setTimeout(() => latest.current.onChange?.(read()), changeDelay);
    });
    const stopRoot = editor.registerRootListener((root, previous) => {
      const handleBlur = (event: FocusEvent) => {
        // Ignore focus moving into the editor's own popovers (slash menu, link editor, floating toolbar).
        if (event.relatedTarget instanceof Node && (root?.contains(event.relatedTarget) || (event.relatedTarget as Element).closest?.("[data-slot=popover-content], [role=listbox], [role=menu]"))) return;
        clearTimeout(timer);
        latest.current.onBlur?.(read());
      };
      previous?.removeEventListener("focusout", handleBlur);
      root?.addEventListener("focusout", handleBlur);
    });
    return () => { clearTimeout(timer); stopUpdates(); stopRoot(); };
  }, [editor, changeDelay]);

  return null;
}
