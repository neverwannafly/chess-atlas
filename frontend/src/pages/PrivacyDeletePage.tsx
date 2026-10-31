import { useState } from "react";
import { Link } from "react-router-dom";
import { PageHead } from "@/components/cr/common";
import { Button } from "@/components/ui/button";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ApiError, submitDeletionRequest, type DeletionRequestInput } from "@/lib/api";
import { shell } from "@/lib/chessresults";
import { cn } from "@/lib/utils";

interface Values { name: string; fideId: string; tnr: string; startNo: string; email: string; note: string; confirm: boolean }
type Errors = Partial<Record<keyof Values | "identity", string>>;

const EMPTY: Values = { name: "", fideId: "", tnr: "", startNo: "", email: "", note: "", confirm: false };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(v: Values): Errors {
  const e: Errors = {};
  const name = v.name.trim();
  if (name.length < 2 || name.length > 100) e.name = "Enter your name, 2 to 100 characters.";
  const fide = v.fideId.trim(), tnr = v.tnr.trim(), start = v.startNo.trim();
  if (fide && !/^\d{5,9}$/.test(fide)) e.fideId = "A FIDE id is 5 to 9 digits.";
  if (tnr && !/^\d+$/.test(tnr)) e.tnr = "Digits only, as in tnr12345.";
  if (start && !/^\d+$/.test(start)) e.startNo = "Enter a whole number.";
  if (!fide && !(tnr && start)) e.identity = "Give a FIDE id, or both the tournament number and the start number.";
  if (!EMAIL.test(v.email.trim())) e.email = "Enter a valid email address.";
  if (v.note.length > 1000) e.note = "Keep the note under 1000 characters.";
  if (!v.confirm) e.confirm = "Please confirm to continue.";
  return e;
}

const input = "h-10 w-full rounded-sm border border-border-strong/70 bg-surface px-3 text-ui text-fg outline-none placeholder:text-subtle focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

function Field({ id, label, optional, hint, error, children }: { id: string; label: string; optional?: boolean; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-ui font-medium text-fg">
        {label}{optional && <span className="ml-1.5 font-normal text-subtle">optional</span>}
      </label>
      {children}
      {hint && <p id={`${id}-hint`} className="mt-1.5 text-small text-muted">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1.5 text-small text-danger">{error}</p>}
    </div>
  );
}

export default function PrivacyDeletePage() {
  useDocumentMeta("Request deletion of your data", "Ask Chess Atlas to delete your player data.");
  const [v, setV] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const set = <K extends keyof Values>(k: K, val: Values[K]) => setV((p) => ({ ...p, [k]: val }));
  const props = (k: keyof Values | "identity", id: string, hint?: boolean) => ({
    id,
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": [errors[k] ? `${id}-err` : "", hint ? `${id}-hint` : ""].filter(Boolean).join(" ") || undefined,
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (sending) return;
    const errs = validate(v);
    setErrors(errs);
    setFormError(null);
    if (Object.keys(errs).length) {
      document.getElementById("deletion-form")?.querySelector<HTMLElement>("[aria-invalid=true]")?.focus();
      return;
    }
    const body: DeletionRequestInput = { name: v.name.trim(), contactEmail: v.email.trim(), confirm: true };
    if (v.fideId.trim()) body.fideId = v.fideId.trim();
    if (v.tnr.trim()) body.chessResultsTournamentId = v.tnr.trim();
    if (v.startNo.trim()) body.chessResultsStartNo = Number(v.startNo.trim());
    if (v.note.trim()) body.note = v.note.trim();
    setSending(true);
    try {
      const r = await submitDeletionRequest(body);
      setDone(String(r.id));
      setV(EMPTY);
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setFormError(
        status === 429 ? "Too many requests from this address; try again later."
        : status === 400 && err instanceof ApiError && err.message ? err.message
        : "Something went wrong. Please try again."
      );
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className={shell}>
        <PageHead title="Request deletion" />
        <div role="status" className="mt-8 max-w-[56ch] rounded-md border border-border bg-surface p-5 sm:p-6">
          <p className="text-[17px] font-medium text-fg">Received. We will reply to your email within 30 days.</p>
          <p className="mt-3 text-body text-muted">Request number: <span className="font-mono text-fg">{done}</span></p>
          <p className="mt-4 text-small text-muted">Keep this number if you write to us about the request.</p>
        </div>
      </div>
    );
  }

  const idErr = errors.identity;
  return (
    <div className={shell}>
      <PageHead title="Request deletion">
        Ask us to delete your data from Chess Atlas. Read the <Link to="/privacy" className="text-fg underline decoration-border-strong underline-offset-2">privacy notice</Link> first if you want to know what we hold.
      </PageHead>
      <form id="deletion-form" onSubmit={onSubmit} noValidate className="max-w-[560px] space-y-5 pb-6 pt-8">
        <p className={cn("text-small", idErr ? "text-fg" : "text-muted")} id="identity-rule">
          Give a FIDE id, <strong className="font-semibold">or</strong> both the tournament number and the start number.
        </p>
        {idErr && <p className="-mt-3 text-small text-danger" role="alert">{idErr}</p>}

        <Field id="dr-name" label="Your name" error={errors.name}>
          <input {...props("name", "dr-name")} className={input} value={v.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" maxLength={100} />
        </Field>
        <Field id="dr-fide" label="FIDE id" optional error={errors.fideId}>
          <input {...props("fideId", "dr-fide")} className={cn(input, "font-mono")} value={v.fideId} onChange={(e) => set("fideId", e.target.value)} inputMode="numeric" autoComplete="off" maxLength={9} />
        </Field>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="dr-tnr" label="Chess-results tournament number" optional hint="Shown in the tournament URL as tnr<number>." error={errors.tnr}>
            <input {...props("tnr", "dr-tnr", true)} className={cn(input, "font-mono")} value={v.tnr} onChange={(e) => set("tnr", e.target.value)} inputMode="numeric" autoComplete="off" />
          </Field>
          <Field id="dr-start" label="Start number on that event" optional hint={'Shown as "No." in the starting list.'} error={errors.startNo}>
            <input {...props("startNo", "dr-start", true)} className={cn(input, "font-mono")} value={v.startNo} onChange={(e) => set("startNo", e.target.value)} inputMode="numeric" autoComplete="off" />
          </Field>
        </div>
        <Field id="dr-email" label="Email address for our reply" error={errors.email}>
          <input {...props("email", "dr-email")} type="email" className={input} value={v.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" />
        </Field>
        <Field id="dr-note" label="Note" optional hint={`${v.note.length}/1000`} error={errors.note}>
          <textarea {...props("note", "dr-note", true)} className={cn(input, "h-28 resize-y py-2")} value={v.note} onChange={(e) => set("note", e.target.value)} />
        </Field>

        <div>
          <div className="flex items-start gap-3">
            <input {...props("confirm", "dr-confirm")} type="checkbox" checked={v.confirm} onChange={(e) => set("confirm", e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]" />
            <label htmlFor="dr-confirm" className="text-ui text-fg">I am the player, or their parent or guardian, and I ask for this data to be deleted.</label>
          </div>
          {errors.confirm && <p id="dr-confirm-err" className="mt-1.5 text-small text-danger">{errors.confirm}</p>}
        </div>

        {formError && <p role="alert" className="rounded-sm border border-border-strong bg-surface-2 px-3 py-2 text-ui text-fg">{formError}</p>}
        <Button type="submit" size="lg" disabled={sending}>{sending ? "Sending…" : "Send request"}</Button>
      </form>
    </div>
  );
}
