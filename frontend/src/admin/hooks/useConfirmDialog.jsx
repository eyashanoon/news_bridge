import { useState } from "react";
import { ConfirmDialog } from "../design-system/ConfirmDialog";

export function useConfirmDialog() {
  const [state, setState] = useState({
    open: false,
    title: "Confirm Action",
    message: "",
    requireText: false,
    expectedText: "",
    inputValue: "",
    resolve: null,
  });

  const askConfirm = (message, title = "Confirm Action") =>
    new Promise((resolve) => {
      setState({
        open: true,
        title,
        message,
        requireText: false,
        expectedText: "",
        inputValue: "",
        resolve,
      });
    });

  const askTypedConfirm = (message, expectedText = "DELETE", title = "Confirm Hard Delete") =>
    new Promise((resolve) => {
      setState({
        open: true,
        title,
        message,
        requireText: true,
        expectedText,
        inputValue: "",
        resolve,
      });
    });

  const closeWith = (value) => {
    if (state.resolve) state.resolve(value);
    setState((prev) => ({ ...prev, open: false, resolve: null, inputValue: "" }));
  };

  const Dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      requireText={state.requireText}
      expectedText={state.expectedText}
      inputValue={state.inputValue}
      onInputChange={(value) => setState((prev) => ({ ...prev, inputValue: value }))}
      onCancel={() => closeWith(false)}
      onConfirm={() => closeWith(true)}
    />
  );

  return { askConfirm, askTypedConfirm, Dialog };
}
