import { Button, Popover, PopoverContent, PopoverTrigger } from '@reka/ui';
import { SmilePlus } from 'lucide-react';
import { REACTION_EMOJIS, type ReactionSummary } from '../api/reactions.api';

/** Emoji reactions: a pill per used emoji (highlighted when you reacted) plus a picker to add or remove yours. */
export function ReactionBar({ label, reactions, onToggle, disabled }: { label: string; reactions: ReactionSummary[]; onToggle: (emoji: string) => void; disabled?: boolean }) {
  return <div role="group" aria-label={`Reactions on ${label}`} className="flex flex-wrap items-center gap-1.5">
    {reactions.map(reaction => <Button key={reaction.emoji} type="button" size="xs" variant={reaction.reacted ? 'secondary' : 'outline'} className="h-6 gap-1 rounded-full px-2" disabled={disabled}
      aria-pressed={reaction.reacted} aria-label={`${reaction.emoji} ${reaction.count} ${reaction.count === 1 ? 'reaction' : 'reactions'}${reaction.reacted ? ', including yours' : ''}`} onClick={() => onToggle(reaction.emoji)}>
      <span aria-hidden="true">{reaction.emoji}</span><span className="tabular-nums">{reaction.count}</span>
    </Button>)}
    <Popover>
      <PopoverTrigger asChild><Button type="button" size="icon-xs" variant="ghost" className="size-6 rounded-full text-muted-foreground" disabled={disabled} aria-label={`Add reaction to ${label}`}><SmilePlus /></Button></PopoverTrigger>
      <PopoverContent align="start" aria-label="Choose a reaction" className="flex w-auto gap-1 p-1.5">
        {REACTION_EMOJIS.map(emoji => <Button key={emoji} type="button" size="icon-sm" variant="ghost" aria-label={`React with ${emoji}`} onClick={() => onToggle(emoji)}>{emoji}</Button>)}
      </PopoverContent>
    </Popover>
  </div>;
}
