import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/Modal";
import { Button } from "@/components/Button";

type DialogTone = "default" | "destructive";

type DialogOptions = {
  title: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  tone?: DialogTone;
};

type DialogState = DialogOptions & {
  type: "alert" | "confirm";
};

type DialogContextValue = {
  confirm: (options: DialogOptions) => Promise<boolean>;
  alert: (options: DialogOptions) => Promise<void>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<DialogState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const resolveAndClose = useCallback((value: boolean) => {
    if (resolverRef.current) {
      resolverRef.current(value);
      resolverRef.current = null;
    }
    setState(null);
  }, []);

  const confirm = useCallback((options: DialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ type: "confirm", ...options });
    });
  }, []);

  const alert = useCallback((options: DialogOptions) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve(true);
      setState({ type: "alert", ...options });
    });
  }, []);

  const value = useMemo(() => ({ confirm, alert }), [confirm, alert]);
  const confirmToneClass =
    state?.tone === "destructive"
      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
      : "";

  return (
    <DialogContext.Provider value={value}>
      {children}
      <Modal
        isOpen={Boolean(state)}
        onClose={() => resolveAndClose(state?.type === "alert")}
        title={state?.title}
        maxWidth="420px"
        minHeight="auto"
      >
        {state?.description && (
          <div className="text-sm text-muted-foreground whitespace-pre-line">
            {state.description}
          </div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          {state?.type === "confirm" && (
            <Button variant="secondary" onClick={() => resolveAndClose(false)}>
              {state.cancelText ?? "Cancel"}
            </Button>
          )}
          <Button
            onClick={() => resolveAndClose(true)}
            className={confirmToneClass}
          >
            {state?.confirmText ?? (state?.type === "confirm" ? "Confirm" : "OK")}
          </Button>
        </div>
      </Modal>
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return context;
};
