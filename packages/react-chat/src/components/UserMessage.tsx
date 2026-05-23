import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import styles from './UserMessage.module.css';

type UserMessageProps = { content: string; className?: string };

export const UserMessage = ({ content, className }: UserMessageProps) => (
  <div className={[styles.bubble, className].filter(Boolean).join(' ')}>
    <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
  </div>
);
