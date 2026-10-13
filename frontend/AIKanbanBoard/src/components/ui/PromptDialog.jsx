import { useEffect, useRef, useState } from "react";
import Modal from "./Modal";
import Button from "./Button";
import { Input } from "./Input";

/**
 * Reusable single-field prompt modal (replaces window.prompt).
 * Calls onSubmit(trimmedValue) when confirmed.
 */
const PromptDialog = ({
  open,
  onClose,
  onSubmit,
  title = "Dodaj",
  description,
  label,
  placeholder,
  defaultValue = "",
  submitLabel = "Dodaj",
  loading = false,
}) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setValue(defaultValue);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          if (defaultValue) inputRef.current.select();
        }
      }, 50);
    }
  }, [open, defaultValue]);

  const submit = async (e) => {
    e.preventDefault();
    const v = value.trim();
    if (!v || loading) return;
    try {
      await onSubmit(v);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => !loading && onClose()}
      title={title}
      description={description}
      size="sm"
    >
      <form onSubmit={submit} className="space-y-4">
        <Input
          ref={inputRef}
          label={label}
          placeholder={placeholder}
          disabled={loading}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <div className="flex justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="ghost"
            disabled={loading}
            onClick={onClose}
          >
            Otkaži
          </Button>
          <Button
            type="submit"
            loading={loading}
            disabled={!value.trim() || loading}
          >
            {submitLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PromptDialog;