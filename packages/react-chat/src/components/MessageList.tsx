import type { AssistantMessage, ChatMessage, ToolMessage } from '@ag2b/core';
import { useRef } from 'react';

import { useAutoScroll } from '@/hooks/useAutoScroll';
import type { Ag2bPopupClassNames } from '@/types';

import { AssistantMessage as AssistantMessageView } from './AssistantMessage';
import { LogoMark } from './LogoMark';
import { UserMessage } from './UserMessage';

import styles from './MessageList.module.css';

type MessageListProps = {
  messages: readonly ChatMessage[];
  pendingMessage: AssistantMessage | null;
  showReasoning: boolean;
  classNames?: Pick<
    Ag2bPopupClassNames,
    'body' | 'userMessage' | 'assistantMessage' | 'reasoning' | 'toolCall'
  >;
};

const collectToolMessages = (messages: readonly ChatMessage[]): readonly ToolMessage[] =>
  messages.filter((m): m is ToolMessage => m.role === 'tool');

export const MessageList = ({
  messages,
  pendingMessage,
  showReasoning,
  classNames,
}: MessageListProps) => {
  const ref = useRef<HTMLDivElement>(null);
  useAutoScroll(ref, [messages.length, pendingMessage]);
  const toolMessages = collectToolMessages(messages);
  const isEmpty = messages.length === 0 && !pendingMessage;

  return (
    <div ref={ref} className={[styles.list, classNames?.body].filter(Boolean).join(' ')}>
      {isEmpty ? (
        <div className={styles.empty}>
          <LogoMark size={40} className={styles.emptyLogo} />
          <span className={styles.emptyTitle}>How can I help?</span>
          <span className={styles.emptyHint}>Ask a question to get started.</span>
        </div>
      ) : null}
      {messages.map((msg, i) => {
        if (msg.role === 'user') {
          return <UserMessage key={i} content={msg.content} className={classNames?.userMessage} />;
        }
        if (msg.role === 'assistant') {
          return (
            <AssistantMessageView
              key={i}
              message={msg}
              toolMessages={toolMessages}
              pending={false}
              showReasoning={showReasoning}
              classNames={classNames}
            />
          );
        }
        return null;
      })}
      {pendingMessage ? (
        <AssistantMessageView
          key="pending"
          message={pendingMessage}
          toolMessages={toolMessages}
          pending={true}
          showReasoning={showReasoning}
          classNames={classNames}
        />
      ) : null}
    </div>
  );
};
