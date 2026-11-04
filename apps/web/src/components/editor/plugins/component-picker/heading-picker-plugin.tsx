import { type ReactNode, useMemo } from "react";

import { $getRoot, $getSelection } from "lexical";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { $createHeadingNode, type HeadingTagType } from "@lexical/rich-text";
import { $setBlocksType } from "@lexical/selection";

import type { Locale } from "@/components/editor/locales";
import {
  type ComponentPickerItem,
  useComponentPickerItems,
} from "@/components/editor/plugins/component-picker/component-picker-plugin";
import { useTranslation } from "@/components/editor/plugins/i18n-plugin";
import { Heading1, Heading2, Heading3 } from "lucide-react";

const HEADINGS: {
  tag: HeadingTagType;
  labelKey: keyof Locale;
  icon: ReactNode;
}[] = [
  {
    tag: "h1",
    labelKey: "heading1",
    icon: (
      <Heading1 className="text-muted-foreground" />
    ),
  },
  {
    tag: "h2",
    labelKey: "heading2",
    icon: (
      <Heading2 className="text-muted-foreground" />
    ),
  },
  {
    tag: "h3",
    labelKey: "heading3",
    icon: (
      <Heading3 className="text-muted-foreground" />
    ),
  },
];

export function HeadingPickerPlugin() {
  const [editor] = useLexicalComposerContext();
  const { t } = useTranslation();

  const items = useMemo<ComponentPickerItem[]>(
    () =>
      HEADINGS.map(({ tag, labelKey, icon }) => ({
        value: tag,
        label: t[labelKey],
        icon,
        keywords: ["heading", "header", tag],
        onSelect: () =>
          editor.update(() => {
            const selection = $getSelection() ?? $getRoot().selectEnd();
            $setBlocksType(selection, () => $createHeadingNode(tag));
          }),
      })),
    [editor, t],
  );

  useComponentPickerItems(items);

  return null;
}
