// Plain code blocks (no syntax highlighting): keeps the editor light. Swap in @lexical/code-shiki if highlighting is needed.
import { $createCodeNode, $isCodeNode, CodeExtension as LexicalCodeExtension } from "@lexical/code-core";
import { $setBlocksType } from "@lexical/selection";
import { $getRoot, $getSelection, $isRangeSelection, type LexicalEditor } from "lexical";

export function insertCodeBlock(editor: LexicalEditor) {
  editor.update(() => {
    const selection = $getSelection() ?? $getRoot().selectEnd();
    if (!$isRangeSelection(selection)) return;
    if ($isCodeNode(selection.anchor.getNode().getTopLevelElement())) return;
    if (selection.isCollapsed()) {
      $setBlocksType(selection, () => $createCodeNode());
      return;
    }
    const textContent = selection.getTextContent();
    selection.insertNodes([$createCodeNode()]);
    const updated = $getSelection();
    if ($isRangeSelection(updated)) updated.insertRawText(textContent);
  });
}

export const CodeExtension = LexicalCodeExtension;
