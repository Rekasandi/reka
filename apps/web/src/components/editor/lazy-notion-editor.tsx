import { lazy, Suspense } from "react";
import type { NotionEditorProps } from "./notion-editor";

// Lexical only loads when an editor is shown, so it stays out of the main bundle.
const NotionEditor = lazy(() => import("./notion-editor").then((module) => ({ default: module.NotionEditor })));

export function LazyNotionEditor(props: NotionEditorProps) {
  return (
    <Suspense fallback={<div id={props.id} aria-busy="true" className={["min-h-24 whitespace-pre-wrap text-sm text-muted-foreground", props.className].filter(Boolean).join(" ")}>{props.value ?? props.defaultValue ?? ""}</div>}>
      <NotionEditor {...props} />
    </Suspense>
  );
}
