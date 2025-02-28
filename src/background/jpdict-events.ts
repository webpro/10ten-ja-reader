import { JpdictState } from '../background/jpdict';
import { serializeError } from '../utils/serialize-error';

export const queryState = () => ({ type: <const>'querystate' });

export const updateDb = ({
  lang,
  force,
}: {
  lang: string;
  force: boolean;
}) => ({
  type: <const>'update',
  lang,
  force,
});

export const cancelUpdateDb = () => ({ type: <const>'cancelupdate' });

export const deleteDb = () => ({ type: <const>'delete' });

export const notifyDbStateUpdated = (state: JpdictState) => ({
  type: <const>'dbstateupdated',
  state,
});

export const notifyDbUpdateComplete = (lastCheck: Date | null) => ({
  type: <const>'dbupdatecomplete',
  lastCheck,
});

export const leaveBreadcrumb = ({ message }: { message: string }) => ({
  type: <const>'breadcrumb',
  message,
});

export const notifyError = ({
  error,
  severity = <const>'error',
}: {
  error: Error;
  severity?: 'error' | 'warning';
}) => ({
  type: <const>'error',
  severity,
  ...serializeError(error),
  stack: error.stack,
});

export type JpdictEvent =
  | ReturnType<typeof queryState>
  | ReturnType<typeof updateDb>
  | ReturnType<typeof cancelUpdateDb>
  | ReturnType<typeof deleteDb>
  | ReturnType<typeof notifyDbStateUpdated>
  | ReturnType<typeof notifyDbUpdateComplete>
  | ReturnType<typeof leaveBreadcrumb>
  | ReturnType<typeof notifyError>;
