import styles from './ErrorBanner.module.css';

type ErrorBannerProps = { error: unknown };

const formatError = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

export const ErrorBanner = ({ error }: ErrorBannerProps) => {
  if (error === undefined || error === null) return null;
  return (
    <div role="alert" className={styles.banner}>
      <span className={styles.icon}>⚠</span>
      <span className={styles.text}>{formatError(error)}</span>
    </div>
  );
};
