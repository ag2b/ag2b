import type { AssistantMessage as AMsg, ToolMessage } from '@ag2b/core';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import type { Ag2bPopupClassNames } from '@/types';

import { Reasoning } from './Reasoning';
import { ToolCallBadge } from './ToolCallBadge';

import styles from './AssistantMessage.module.css';

type AssistantMessageProps = {
  message: AMsg;
  toolMessages: readonly ToolMessage[];
  pending: boolean;
  showReasoning: boolean;
  classNames?: Pick<Ag2bPopupClassNames, 'assistantMessage' | 'reasoning' | 'toolCall'>;
};

export const AssistantMessage = ({
  message,
  toolMessages,
  pending,
  showReasoning,
  classNames,
}: AssistantMessageProps) => {
  const toolById = new Map(toolMessages.map((m) => [m.id, m]));
  return (
    <div className={[styles.wrapper, classNames?.assistantMessage].filter(Boolean).join(' ')}>
      {showReasoning && message.reasoning ? (
        <Reasoning text={message.reasoning} pending={pending} className={classNames?.reasoning} />
      ) : null}
      {message.calls?.map((call) => (
        <ToolCallBadge
          key={call.id}
          call={call}
          toolMessage={toolById.get(call.id)}
          className={classNames?.toolCall}
        />
      ))}
      {message.content ? (
        <div className={styles.bubble}>
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
        </div>
      ) : null}
    </div>
  );
};
