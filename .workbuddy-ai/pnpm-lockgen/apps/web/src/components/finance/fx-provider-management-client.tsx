"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowRightLeft,
  CircleDollarSign,
  Edit3,
  KeyRound,
  RefreshCw,
  ShieldCheck,
  TestTube2,
} from "lucide-react";
import { Button, StatusBadge, cn } from "@indihub/ui";
import { useAdminAuth } from "@/components/admin/admin-auth-context";
import { useConfirmationDialog } from "@/components/shared/confirmation-dialog";
import { userFacingApiErrorMessage } from "@/lib/api";
import {
  compareFxQuotes,
  createFxProvider,
  listFxProviders,
  makeFxProviderPrimary,
  testFxProvider,
  updateFxProvider,
  type FxProvider,
  type FxProviderAdapterCode,
  type FxQuoteComparison,
  type SupportedFxProvider,
  type UpsertFxProviderPayload,
} from "@/lib/fx-provider-api";

type ProviderForm = {
  adapterCode: FxProviderAdapterCode;
  providerCode: string;
  displayName: string;
  apiBaseUrl: string;
  apiKey: string;
  clearApiKey: boolean;
  isEnabled: boolean;
  isPrimary: boolean;
  priority: string;
  timeoutMs: string;
  cacheTtlMinutes: string;
  notes: string;
};

type Notice = { tone: "success" | "error"; text: string } | null;

const fieldClass =
  "h-11 w-full rounded-md border border-[#D8E2EA] bg-white px-3 text-sm font-semibold text-[#1F2933] outline-none transition placeholder:text-[#98A2B3] focus:border-[#ED3500] focus:ring-2 focus:ring-[#ED3500]/10";
const currencies = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];

export function FxProviderManagementClient() {
  const auth = useAdminAuth();
  const queryClient = useQueryClient();
  const confirmation = useConfirmationDialog();
  const [editingProvider, setEditingProvider] = useState<FxProvider | null>(null);
  const [form, setForm] = useState<ProviderForm>(() => emptyForm());
  const [notice, setNotice] = useState<Notice>(null);
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [quoteCurrency, setQuoteCurrency] = useState("USD");
  const [amount, setAmount] = useState("1000");
  const [comparison, setComparison] = useState<FxQuoteComparison | null>(null);
  const [lastTest, setLastTest] = useState<{ providerId: string; text: string; success: boolean } | null>(null);

  const providersQuery = useQuery({
    queryKey: ["finance-fx-providers", auth.authHeaders],
    queryFn: () => listFxProviders(auth.authHeaders),
    enabled: auth.isAuthenticated,
    refetchOnWindowFocus: false,
  });
  const supported = providersQuery.data?.supportedProviders ?? [];

  const saveMutation = useMutation({
    mutationFn: ({ providerId, payload }: { providerId?: string; payload: UpsertFxProviderPayload }) =>
      providerId
        ? updateFxProvider(auth.authHeaders, providerId, payload)
        : createFxProvider(auth.authHeaders, payload),
    onSuccess: async (_, variables) => {
      await queryClient.invalidateQueries({ queryKey: ["finance-fx-providers"] });
      setEditingProvider(null);
      setForm(emptyForm());
      setNotice({
        tone: "success",
        text: variables.providerId ? "FX provider configuration updated." : "FX provider added.",
      });
    },
    onError: (error) => setNotice({ tone: "error", text: userFacingApiErrorMessage(error) }),
  });

  const primaryMutation = useMutation({
    mutationFn: (providerId: string) => makeFxProviderPrimary(auth.authHeaders, providerId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["finance-fx-providers"] });
      setNotice({ tone: "success", text: "Primary FX provider changed. New checkouts will use this provider first." });
    },
    onError: (error) => setNotice({ tone: "error", text: userFacingApiErrorMessage(error) }),
  });

  const compareMutation = useMutation({
    mutationFn: (payload: { baseCurrency: string; quoteCurrency: string; amountMinor: number }) =>
      compareFxQuotes(auth.authHeaders, payload),
    onSuccess: (result) => setComparison(result),
  });

  const testMutation = useMutation({
    mutationFn: ({ providerId, amountMinor }: { providerId: string; amountMinor: number }) =>
      testFxProvider(auth.authHeaders, providerId, { baseCurrency, quoteCurrency, amountMinor }),
    onSuccess: (result) => {
      setLastTest({
        providerId: result.providerId ?? "",
        success: result.status === "SUCCESS",
        text:
          result.status === "SUCCESS"
            ? `Live rate ${formatRate(result.rate)} received in ${result.latencyMs} ms.`
            : result.error ?? "Provider test failed.",
      });
      void queryClient.invalidateQueries({ queryKey: ["finance-fx-providers"] });
    },
    onError: (error, variables) => {
      setLastTest({
        providerId: variables.providerId,
        success: false,
        text: userFacingApiErrorMessage(error),
      });
    },
  });

  const configuredAdapters = useMemo(
    () => new Set((providersQuery.data?.items ?? []).map((provider) => provider.adapterCode)),
    [providersQuery.data?.items],
  );

  function chooseAdapter(adapterCode: FxProviderAdapterCode) {
    const catalog = supported.find((item) => item.adapterCode === adapterCode);
    setForm((current) => ({
      ...current,
      adapterCode,
      providerCode: catalog?.providerCode ?? adapterCode,
      displayName: catalog?.displayName ?? adapterCode,
      apiBaseUrl: catalog?.apiBaseUrl ?? "",
      apiKey: "",
      clearApiKey: false,
    }));
  }

  function editProvider(provider: FxProvider) {
    setEditingProvider(provider);
    setForm({
      adapterCode: provider.adapterCode,
      providerCode: provider.providerCode,
      displayName: provider.displayName,
      apiBaseUrl: provider.apiBaseUrl ?? "",
      apiKey: "",
      clearApiKey: false,
      isEnabled: provider.isEnabled,
      isPrimary: provider.isPrimary,
      priority: String(provider.priority),
      timeoutMs: String(provider.timeoutMs),
      cacheTtlMinutes: String(provider.cacheTtlMinutes),
      notes: provider.notes ?? "",
    });
    setNotice(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submitProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice(null);
    const payload = providerPayload(form);
    const save = () => saveMutation.mutate({
      ...(editingProvider ? { providerId: editingProvider.id } : {}),
      payload,
    });
    const lifecycleChanged =
      editingProvider &&
      (editingProvider.isEnabled !== form.isEnabled || (!editingProvider.isPrimary && form.isPrimary));

    if (lifecycleChanged) {
      confirmation.requestConfirmation({
        title: "Apply FX provider routing change?",
        description:
          "This can change which live rate is used for new checkout currency snapshots. Existing order snapshots will remain unchanged.",
        confirmLabel: "Apply provider change",
        tone: "warning",
        onConfirm: save,
      });
      return;
    }
    save();
  }

  function runComparison(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountMinor = majorToMinor(amount);
    if (!amountMinor || baseCurrency === quoteCurrency) return;
    compareMutation.mutate({ baseCurrency, quoteCurrency, amountMinor });
  }

  function requestPrimary(provider: FxProvider) {
    confirmation.requestConfirmation({
      title: `Use ${provider.displayName} first?`,
      description:
        "Fresh checkout quotes will try this provider first. Other enabled providers remain available in priority order if it fails.",
      confirmLabel: "Make primary",
      tone: "warning",
      onConfirm: () => primaryMutation.mutate(provider.id),
    });
  }

  const amountMinor = majorToMinor(amount);

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-[#FFD4C8] bg-white shadow-sm">
        <div className="grid gap-5 bg-[linear-gradient(120deg,#FFF4EF_0%,#FFFCFB_55%,#EEF5FA_100%)] p-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-[#ED3500]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              Controlled currency routing
            </div>
            <h2 className="mt-2 text-xl font-black text-[#1F2933]">Provider configuration</h2>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
              Configure the primary source and fallback order used for new currency snapshots. Provider credentials are encrypted and never shown again.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Configured" value={String(providersQuery.data?.items.length ?? 0)} />
            <Metric label="Base currency" value={providersQuery.data?.baseCurrency ?? "INR"} />
          </div>
        </div>

        <form onSubmit={submitProvider} className="grid gap-4 border-t border-[#F0E4DF] p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-black text-[#1F2933]">
                {editingProvider ? `Edit ${editingProvider.displayName}` : "Add an FX provider"}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[#667085]">
                Lower priority numbers are tried first after the primary provider.
              </p>
            </div>
            {editingProvider ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditingProvider(null);
                  setForm(emptyForm());
                  setNotice(null);
                }}
              >
                Cancel editing
              </Button>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Provider type">
              <select
                value={form.adapterCode}
                disabled={Boolean(editingProvider)}
                onChange={(event) => chooseAdapter(event.target.value as FxProviderAdapterCode)}
                className={fieldClass}
              >
                {(supported.length ? supported : fallbackCatalog()).map((provider) => (
                  <option
                    key={provider.adapterCode}
                    value={provider.adapterCode}
                    disabled={!editingProvider && configuredAdapters.has(provider.adapterCode)}
                  >
                    {provider.displayName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Display name">
              <input
                required
                minLength={2}
                maxLength={120}
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Provider code" hint="Used in order and rate audit records.">
              <input
                required
                value={form.providerCode}
                onChange={(event) => setForm({ ...form, providerCode: event.target.value.toUpperCase() })}
                className={fieldClass}
              />
            </Field>
            <Field label="Fallback priority" hint="1 is the highest fallback priority.">
              <input
                required
                type="number"
                min={1}
                max={1000}
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
                className={fieldClass}
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Secure API base URL" hint="Version paths may change, but the official provider host is enforced for security.">
              <input
                required
                type="url"
                value={form.apiBaseUrl}
                onChange={(event) => setForm({ ...form, apiBaseUrl: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="API key" hint={editingProvider?.credentialsConfigured ? "Leave blank to keep the stored key." : "Required only for providers that use a key."}>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#667085]" aria-hidden="true" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={form.apiKey}
                  onChange={(event) => setForm({ ...form, apiKey: event.target.value, clearApiKey: false })}
                  className={cn(fieldClass, "pl-9")}
                  placeholder="Write-only credential"
                />
              </div>
            </Field>
            <Field label="Request timeout" hint="Milliseconds, from 1,000 to 30,000.">
              <input
                required
                type="number"
                min={1000}
                max={30000}
                step={500}
                value={form.timeoutMs}
                onChange={(event) => setForm({ ...form, timeoutMs: event.target.value })}
                className={fieldClass}
              />
            </Field>
            <Field label="Cache lifetime" hint="Minutes, from 1 to 1,440.">
              <input
                required
                type="number"
                min={1}
                max={1440}
                value={form.cacheTtlMinutes}
                onChange={(event) => setForm({ ...form, cacheTtlMinutes: event.target.value })}
                className={fieldClass}
              />
            </Field>
          </div>

          <Field label="Finance notes">
            <textarea
              rows={3}
              maxLength={1000}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              className={cn(fieldClass, "h-auto min-h-24 py-3")}
              placeholder="Plan, renewal owner, intended role, or operational notes"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-[#E5E7EB] bg-[#FAFBFC] p-3">
            <CheckField
              label="Enabled for live routing"
              checked={form.isEnabled}
              onChange={(checked) => setForm({ ...form, isEnabled: checked, ...(checked ? {} : { isPrimary: false }) })}
            />
            <CheckField
              label="Make primary"
              checked={form.isPrimary}
              disabled={!form.isEnabled}
              onChange={(checked) => setForm({ ...form, isPrimary: checked })}
            />
            {editingProvider?.credentialsConfigured ? (
              <CheckField
                label="Remove stored API key"
                checked={form.clearApiKey}
                onChange={(checked) => setForm({ ...form, clearApiKey: checked, apiKey: checked ? "" : form.apiKey })}
              />
            ) : null}
            <Button type="submit" className="ml-auto" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
              {editingProvider ? "Save configuration" : "Add provider"}
            </Button>
          </div>

          {notice ? <NoticeBox notice={notice} /> : null}
        </form>
      </section>

      <ConfiguredProviders
        providers={providersQuery.data?.items ?? []}
        runtimeFallback={providersQuery.data?.runtimeFallback ?? null}
        loading={providersQuery.isLoading}
        error={providersQuery.isError ? userFacingApiErrorMessage(providersQuery.error) : null}
        onRetry={() => providersQuery.refetch()}
        onEdit={editProvider}
        onPrimary={requestPrimary}
        onTest={(provider) => {
          if (!amountMinor) return;
          setLastTest(null);
          testMutation.mutate({ providerId: provider.id, amountMinor });
        }}
        testingId={testMutation.isPending ? testMutation.variables?.providerId ?? null : null}
        lastTest={lastTest}
      />

      <section className="rounded-xl border border-[#D8E2EA] bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-[#E5E7EB] p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5 text-[#ED3500]" aria-hidden="true" />
              <h2 className="text-lg font-black text-[#1F2933]">Live quote comparison</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[#667085]">
              Compare every configured provider independently. A failure stays visible instead of hiding the other providers&apos; results.
            </p>
          </div>
          <StatusBadge tone="info">{comparison ? formatDateTime(comparison.generatedAt) : "Ready to verify"}</StatusBadge>
        </div>

        <form onSubmit={runComparison} className="grid gap-3 border-b border-[#E5E7EB] p-5 md:grid-cols-[1fr_1fr_1.4fr_auto] md:items-end">
          <Field label="From currency">
            <CurrencySelect value={baseCurrency} onChange={setBaseCurrency} />
          </Field>
          <Field label="To currency">
            <CurrencySelect value={quoteCurrency} onChange={setQuoteCurrency} />
          </Field>
          <Field label="Reference amount">
            <input
              required
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={fieldClass}
              aria-describedby="fx-amount-hint"
            />
          </Field>
          <Button type="submit" className="h-11" disabled={!amountMinor || baseCurrency === quoteCurrency || compareMutation.isPending}>
            {compareMutation.isPending ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Activity className="h-4 w-4" aria-hidden="true" />}
            Compare live rates
          </Button>
          <p id="fx-amount-hint" className="text-xs font-semibold text-[#667085] md:col-span-4">
            Enter a normal currency amount, for example 1,000.00. The server compares using minor units to avoid floating-point money errors.
          </p>
        </form>

        {compareMutation.isError ? (
          <div className="m-5 rounded-lg border border-[#F5B7B7] bg-[#FFF7F7] p-4 text-sm font-bold text-[#B42318]">
            {userFacingApiErrorMessage(compareMutation.error)}
          </div>
        ) : null}

        <QuoteTable comparison={comparison} />

        <div className="m-5 flex items-start gap-3 rounded-lg border border-[#FFD4C8] bg-[#FFF7F3] p-4">
          <CircleDollarSign className="mt-0.5 h-5 w-5 shrink-0 text-[#ED3500]" aria-hidden="true" />
          <p className="text-sm font-semibold leading-6 text-[#7A3A25]">
            These are provider reference rates, not a guarantee of the final card, bank, or payment-gateway settlement rate. “Exactness” should be assessed using the provider timestamp, latency, and deviation shown here; payment providers may add spreads and fees.
          </p>
        </div>
      </section>
      {confirmation.confirmationDialog}
    </div>
  );
}

function ConfiguredProviders({
  providers,
  runtimeFallback,
  loading,
  error,
  onRetry,
  onEdit,
  onPrimary,
  onTest,
  testingId,
  lastTest,
}: {
  providers: FxProvider[];
  runtimeFallback: { displayName: string; providerCode: string; credentialsConfigured: boolean } | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onEdit: (provider: FxProvider) => void;
  onPrimary: (provider: FxProvider) => void;
  onTest: (provider: FxProvider) => void;
  testingId: string | null;
  lastTest: { providerId: string; text: string; success: boolean } | null;
}) {
  return (
    <section className="rounded-xl border border-[#D8E2EA] bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[#E5E7EB] p-5">
        <div>
          <h2 className="text-lg font-black text-[#1F2933]">Configured providers</h2>
          <p className="mt-1 text-sm font-semibold text-[#667085]">Primary first, then enabled fallbacks by priority.</p>
        </div>
        <StatusBadge tone="info">{providers.length} configured</StatusBadge>
      </div>

      {loading ? <LoadingRows /> : null}
      {error ? (
        <div className="m-5 flex flex-col gap-3 rounded-lg border border-[#F5B7B7] bg-[#FFF7F7] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-bold text-[#B42318]">{error}</p>
          <Button type="button" variant="outline" onClick={onRetry}>Retry</Button>
        </div>
      ) : null}
      {!loading && !error && providers.length === 0 ? (
        <div className="p-8 text-center">
          <CircleDollarSign className="mx-auto h-8 w-8 text-[#ED3500]" aria-hidden="true" />
          <p className="mt-3 text-base font-black text-[#1F2933]">No database-managed providers yet</p>
          <p className="mt-2 text-sm font-semibold text-[#667085]">
            {runtimeFallback
              ? `${runtimeFallback.displayName} is currently keeping currency conversion active through environment settings.`
              : "Add and enable a provider before using live currency conversion."}
          </p>
        </div>
      ) : null}

      {providers.length ? (
        <>
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-[#FAFBFC] text-xs font-black uppercase tracking-[0.08em] text-[#667085]">
                <tr>
                  <th className="px-5 py-3">Provider</th>
                  <th className="px-4 py-3">Routing</th>
                  <th className="px-4 py-3">Credentials</th>
                  <th className="px-4 py-3">Health</th>
                  <th className="px-4 py-3">Cache / timeout</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {providers.map((provider) => (
                  <tr key={provider.id} className="align-top">
                    <td className="px-5 py-4">
                      <p className="font-black text-[#1F2933]">{provider.displayName}</p>
                      <p className="mt-1 text-xs font-semibold text-[#667085]">{provider.providerCode} · {provider.adapterCode}</p>
                    </td>
                    <td className="px-4 py-4"><RoutingBadges provider={provider} /></td>
                    <td className="px-4 py-4">
                      <StatusBadge tone={provider.credentialsConfigured ? "success" : "warning"}>
                        {provider.credentialsConfigured ? "Configured" : "Missing"}
                      </StatusBadge>
                    </td>
                    <td className="max-w-64 px-4 py-4"><Health provider={provider} lastTest={lastTest} /></td>
                    <td className="px-4 py-4 font-bold text-[#475467]">
                      {provider.cacheTtlMinutes} min / {provider.timeoutMs.toLocaleString("en-IN")} ms
                    </td>
                    <td className="px-5 py-4">
                      <ProviderActions provider={provider} onEdit={onEdit} onPrimary={onPrimary} onTest={onTest} testingId={testingId} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 p-4 md:hidden">
            {providers.map((provider) => (
              <article key={provider.id} className="rounded-lg border border-[#E5E7EB] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#1F2933]">{provider.displayName}</p>
                    <p className="mt-1 text-xs font-semibold text-[#667085]">{provider.providerCode}</p>
                  </div>
                  <RoutingBadges provider={provider} />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Detail label="Credentials" value={provider.credentialsConfigured ? "Configured" : "Missing"} />
                  <Detail label="Cache / timeout" value={`${provider.cacheTtlMinutes} min / ${provider.timeoutMs} ms`} />
                </div>
                <div className="mt-4"><Health provider={provider} lastTest={lastTest} /></div>
                <div className="mt-4"><ProviderActions provider={provider} onEdit={onEdit} onPrimary={onPrimary} onTest={onTest} testingId={testingId} /></div>
              </article>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}

function QuoteTable({ comparison }: { comparison: FxQuoteComparison | null }) {
  if (!comparison) {
    return (
      <div className="p-8 text-center text-sm font-semibold text-[#667085]">
        Run a comparison to inspect live provider rates and freshness.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-left text-sm">
        <thead className="bg-[#FAFBFC] text-xs font-black uppercase tracking-[0.08em] text-[#667085]">
          <tr>
            <th className="px-5 py-3">Provider</th>
            <th className="px-4 py-3">Live rate</th>
            <th className="px-4 py-3">Converted amount</th>
            <th className="px-4 py-3">Median deviation</th>
            <th className="px-4 py-3">Provider timestamp</th>
            <th className="px-4 py-3">Latency</th>
            <th className="px-5 py-3">Result</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E7EB]">
          {comparison.quotes.map((quote) => (
            <tr key={quote.providerId ?? quote.providerCode}>
              <td className="px-5 py-4">
                <p className="font-black text-[#1F2933]">{quote.displayName}</p>
                {quote.isPrimary ? <StatusBadge tone="success">Primary</StatusBadge> : null}
              </td>
              <td className="px-4 py-4 font-black text-[#163B5C]">
                {quote.rate ? `1 ${comparison.baseCurrency} = ${formatRate(quote.rate)} ${comparison.quoteCurrency}` : "—"}
              </td>
              <td className="px-4 py-4 font-black text-[#1F2933]">
                {quote.convertedMinor === null ? "—" : moneyFromMinor(quote.convertedMinor, comparison.quoteCurrency)}
              </td>
              <td className="px-4 py-4">
                {quote.deviationBps === null || quote.deviationBps === undefined
                  ? "—"
                  : `${quote.deviationBps >= 0 ? "+" : ""}${(quote.deviationBps / 100).toFixed(2)}%`}
              </td>
              <td className="px-4 py-4 font-semibold text-[#475467]">{formatDateTime(quote.providerTimestamp)}</td>
              <td className="px-4 py-4 font-bold text-[#475467]">{quote.latencyMs} ms</td>
              <td className="max-w-64 px-5 py-4">
                <StatusBadge tone={quote.status === "SUCCESS" ? "success" : "danger"}>{quote.status}</StatusBadge>
                {quote.error ? <p className="mt-2 text-xs font-bold leading-5 text-[#B42318]">{quote.error}</p> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProviderActions({
  provider,
  onEdit,
  onPrimary,
  onTest,
  testingId,
}: {
  provider: FxProvider;
  onEdit: (provider: FxProvider) => void;
  onPrimary: (provider: FxProvider) => void;
  onTest: (provider: FxProvider) => void;
  testingId: string | null;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-2">
      <Button type="button" size="sm" variant="outline" onClick={() => onEdit(provider)}>
        <Edit3 className="h-4 w-4" aria-hidden="true" /> Edit
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={() => onTest(provider)} disabled={testingId === provider.id}>
        {testingId === provider.id ? <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" /> : <TestTube2 className="h-4 w-4" aria-hidden="true" />}
        Test
      </Button>
      {!provider.isPrimary ? (
        <Button type="button" size="sm" onClick={() => onPrimary(provider)} disabled={!provider.isEnabled}>
          Make primary
        </Button>
      ) : null}
    </div>
  );
}

function RoutingBadges({ provider }: { provider: FxProvider }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <StatusBadge tone={provider.isEnabled ? "success" : "neutral"}>{provider.isEnabled ? "Enabled" : "Disabled"}</StatusBadge>
      {provider.isPrimary ? <StatusBadge tone="info">Primary</StatusBadge> : <StatusBadge tone="neutral">Priority {provider.priority}</StatusBadge>}
    </div>
  );
}

function Health({ provider, lastTest }: { provider: FxProvider; lastTest: { providerId: string; text: string; success: boolean } | null }) {
  const test = lastTest?.providerId === provider.id ? lastTest : null;
  const healthy = test ? test.success : provider.lastHealthStatus === "HEALTHY";
  const label = test ? test.text : provider.lastError ?? healthLabel(provider.lastHealthStatus);
  return (
    <div>
      <div className="flex items-center gap-2">
        <span className={cn("h-2.5 w-2.5 rounded-full", healthy ? "bg-[#16803B]" : provider.lastHealthStatus === "NEVER_TESTED" ? "bg-[#98A2B3]" : "bg-[#B42318]")} />
        <p className="font-black text-[#1F2933]">{test ? (test.success ? "Live test passed" : "Live test failed") : healthLabel(provider.lastHealthStatus)}</p>
      </div>
      <p className={cn("mt-1 text-xs font-semibold leading-5", test && !test.success ? "text-[#B42318]" : "text-[#667085]")}>{label}</p>
      {provider.lastCheckedAt ? <p className="mt-1 text-xs font-semibold text-[#98A2B3]">{formatDateTime(provider.lastCheckedAt)}</p> : null}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-black text-[#344054]">
      <span>{label}</span>
      {children}
      {hint ? <span className="text-xs font-semibold leading-5 text-[#667085]">{hint}</span> : null}
    </label>
  );
}

function CheckField({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className={cn("flex min-h-10 items-center gap-2 text-sm font-black text-[#344054]", disabled && "opacity-50")}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#ED3500]"
      />
      {label}
    </label>
  );
}

function CurrencySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass}>
      {currencies.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
    </select>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28 rounded-lg border border-white/80 bg-white/85 p-3 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.08em] text-[#667085]">{label}</p>
      <p className="mt-1 text-xl font-black text-[#163B5C]">{value}</p>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs font-black uppercase text-[#667085]">{label}</p><p className="mt-1 font-bold text-[#1F2933]">{value}</p></div>;
}

function NoticeBox({ notice }: { notice: Exclude<Notice, null> }) {
  return (
    <div className={cn("rounded-lg border p-3 text-sm font-bold", notice.tone === "success" ? "border-[#B7E2C3] bg-[#F1FBF4] text-[#126B32]" : "border-[#F5B7B7] bg-[#FFF7F7] text-[#B42318]")}>
      {notice.text}
    </div>
  );
}

function LoadingRows() {
  return <div className="grid gap-3 p-5"><div className="h-16 animate-pulse rounded-lg bg-[#F2F4F7]" /><div className="h-16 animate-pulse rounded-lg bg-[#F2F4F7]" /></div>;
}

function providerPayload(form: ProviderForm): UpsertFxProviderPayload {
  return {
    adapterCode: form.adapterCode,
    providerCode: form.providerCode.trim().toUpperCase(),
    displayName: form.displayName.trim(),
    apiBaseUrl: form.apiBaseUrl.trim(),
    ...(form.apiKey.trim() ? { apiKey: form.apiKey.trim() } : {}),
    ...(form.clearApiKey ? { clearApiKey: true } : {}),
    isEnabled: form.isEnabled,
    isPrimary: form.isEnabled && form.isPrimary,
    priority: Number(form.priority),
    timeoutMs: Number(form.timeoutMs),
    cacheTtlMinutes: Number(form.cacheTtlMinutes),
    notes: form.notes.trim(),
  };
}

function emptyForm(): ProviderForm {
  return {
    adapterCode: "FRANKFURTER",
    providerCode: "FRANKFURTER",
    displayName: "Frankfurter",
    apiBaseUrl: "https://api.frankfurter.dev/v2",
    apiKey: "",
    clearApiKey: false,
    isEnabled: true,
    isPrimary: false,
    priority: "100",
    timeoutMs: "5000",
    cacheTtlMinutes: "60",
    notes: "",
  };
}

function fallbackCatalog(): SupportedFxProvider[] {
  return [
    {
      adapterCode: "FRANKFURTER",
      providerCode: "FRANKFURTER",
      displayName: "Frankfurter",
      apiBaseUrl: "https://api.frankfurter.dev/v2",
      requiresApiKey: false,
      description: "Keyless reference rates.",
    },
    {
      adapterCode: "CURRENCYAPI",
      providerCode: "CURRENCYAPI",
      displayName: "CurrencyAPI",
      apiBaseUrl: "https://api.currencyapi.com/v3",
      requiresApiKey: true,
      description: "API-key reference rates.",
    },
  ];
}

function majorToMinor(value: string) {
  const normalized = value.replaceAll(",", "").trim();
  if (!/^\d+(\.\d{0,2})?$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100);
}

function formatRate(rate: number | null) {
  if (rate === null || !Number.isFinite(rate)) return "—";
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 8 }).format(rate);
}

function moneyFromMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 2 }).format(amountMinor / 100);
}

function formatDateTime(value: string | null) {
  if (!value) return "Not supplied";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not supplied"
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "medium" }).format(date);
}

function healthLabel(status: FxProvider["lastHealthStatus"]) {
  if (status === "HEALTHY") return "Healthy";
  if (status === "ERROR") return "Needs attention";
  return "Not tested";
}
