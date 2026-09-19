'use client';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import {
  LayoutDashboard,
  ReceiptText,
  Package,
  BookOpen,
  RefreshCw,
  ShieldCheck,
  Menu,
  LogOut,
  Download,
  Wifi,
  WifiOff,
  ArrowUpRight,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { EventQueue, type DeviceEvent } from '@/lib/offline/event-queue';
import {
  api,
  restore,
  retainedProfile,
  saveProfile,
  snapshot,
  synchronize,
  project,
  money,
  minor,
  date,
  emptySnapshot,
  type Profile,
  type Snapshot,
  type Kind,
  type Outcome,
} from '@/lib/offline/workspace';

const inputClass =
  'h-11 w-full rounded-md border bg-background px-3 text-sm focus:outline-2 focus:outline-ring';
const names: Record<Kind, string> = {
  sale: 'Sale',
  quotation: 'Quotation',
  cash_receipt: 'Cash receipt',
  purchase: 'Purchase',
  expense: 'Expense',
};
const navigation = [
  ['Overview', LayoutDashboard],
  ['Capture', Plus],
  ['Activity', ReceiptText],
  ['Inventory', Package],
  ['Ledger', BookOpen],
  ['Sync & devices', ShieldCheck],
] as const;
interface Administration {
  devices: {
    id: string;
    actor_id: string;
    username: string;
    revoked_at: string | null;
  }[];
  review: {
    id: string;
    actor_id: string;
    device_id: string;
    state: string;
    reason: string;
    envelope: { kind: Kind; payload: { description: string } };
    decision: string | null;
    review_reason: string | null;
  }[];
}
interface InstallPrompt extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
}
export function Workspace() {
  const [profile, setProfile] = useState<Profile | null>(null),
    [base, setBase] = useState<Snapshot>(emptySnapshot),
    [events, setEvents] = useState<DeviceEvent[]>([]),
    [loading, setLoading] = useState(true);
  const db = useRef<EventQueue | null>(null),
    syncing = useRef(false);
  const [active, setActive] = useState('Overview'),
    [drawer, setDrawer] = useState(false),
    [online, setOnline] = useState(true),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [storage, setStorage] = useState(''),
    [tick, setTick] = useState(() => Date.now());
  const [create, setCreate] = useState(false),
    [signIn, setSignIn] = useState(false),
    [kind, setKind] = useState<Kind>('sale'),
    [productId, setProductId] = useState(''),
    [editing, setEditing] = useState<{ id: string; version: number } | null>(
      null,
    );
  const [admin, setAdmin] = useState<Administration | null>(null),
    [install, setInstall] = useState<InstallPrompt | null>(null),
    [update, setUpdate] = useState<ServiceWorkerRegistration | null>(null),
    [offlineReady, setOfflineReady] = useState(false);
  const refresh = useCallback(async () => {
    if (db.current) {
      setEvents(await db.current.events.orderBy('sequence').toArray());
      setBase(await snapshot(db.current));
    }
  }, []);
  const fail = (e: unknown) =>
    setError(
      e instanceof Error ? e.message : 'The action could not be completed.',
    );
  useEffect(() => {
    let disposed = false;
    void restore()
      .then(async (saved) => {
        if (disposed) {
          saved?.db.close();
          return;
        }
        if (saved) {
          db.current = saved.db;
          setProfile(saved.profile);
          setBase(await snapshot(saved.db));
          setEvents(await saved.db.events.orderBy('sequence').toArray());
        }
      })
      .catch((e) => setError(`Local storage is unavailable: ${String(e)}`))
      .finally(() => setLoading(false));
    const connection = () => setOnline(navigator.onLine);
    connection();
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallPrompt);
    };
    window.addEventListener('beforeinstallprompt', prompt);
    const timer = setInterval(() => setTick(Date.now()), 15000);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker
        .register('/sw.js', { updateViaCache: 'none' })
        .then((registration) => {
          if (registration.waiting) setUpdate(registration);
          registration.addEventListener('updatefound', () =>
            registration.installing?.addEventListener('statechange', () => {
              if (registration.waiting) setUpdate(registration);
            }),
          );
          void navigator.serviceWorker.ready.then(() => setOfflineReady(true));
        })
        .catch(() =>
          setStorage(
            'Offline app installation is unavailable. Keep this tab open until setup succeeds.',
          ),
        );
    if (navigator.storage) {
      void navigator.storage.persisted().then((persisted) => {
        if (!persisted)
          setStorage(
            'Browser storage is not protected from eviction. Keep a local export of unsynced work.',
          );
      });
      void navigator.storage.estimate().then(({ usage = 0, quota = 0 }) => {
        if (quota && usage / quota > 0.8)
          setStorage(
            'Device storage is nearly full. Sync or export your pending work.',
          );
      });
    }
    return () => {
      disposed = true;
      clearInterval(timer);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
      window.removeEventListener('beforeinstallprompt', prompt);
    };
  }, []);
  const runSync = useCallback(async () => {
    if (!db.current || !profile || syncing.current || !navigator.onLine) return;
    syncing.current = true;
    setBusy(true);
    setError('');
    try {
      await synchronize(db.current, profile);
      await refresh();
      setMessage(
        'Sync complete. Your accepted records are saved on the server.',
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not sync. Your device records are retained.',
      );
      await refresh();
    } finally {
      syncing.current = false;
      setBusy(false);
    }
  }, [profile, refresh]);
  useEffect(() => {
    const initial = setTimeout(() => {
      if (profile && online) void runSync();
    }, 0);
    const timer = setInterval(() => {
      if (navigator.onLine) void runSync();
    }, 30000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [profile, online, runSync]);
  const pending = events.filter((e) => e.state === 'pending'),
    issues = events.filter((e) =>
      ['rejected', 'conflict', 'quarantined'].includes(e.state),
    );
  const totals = project(base, events);
  const editingDocument = base.documents.find(
    (document) => document.id === editing?.id,
  );
  const leaseValid =
    !!profile &&
    tick >= Date.parse(profile.grant.issuedAt) &&
    tick < Date.parse(profile.grant.expiresAt);
  const blocked = events.some(
    (e) =>
      e.state === 'quarantined' &&
      (e.reason?.toLowerCase().includes('revoked') ||
        e.reason === 'actor_disabled'),
  );
  const canCapture = leaseValid && !blocked && !!base.at;
  async function authenticate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    const form = new FormData(e.currentTarget),
      username = String(form.get('username')),
      password = String(form.get('password'));
    try {
      const identity = await api<Profile['identity']>(
        create ? 'register' : 'login',
        {
          username,
          password,
          ...(create ? { name: String(form.get('name')) } : {}),
        },
      );
      // Switching accounts never erases the old tenant's database. Its active pointer is replaced only after enrolment.
      const retained = await retainedProfile(identity);
      const enrolled = await api<Profile>(
        'enrol',
        { deviceId: retained?.context.deviceId ?? crypto.randomUUID() },
        retained?.deviceToken,
      );
      const next = new EventQueue(enrolled.context);
      await saveProfile(next, enrolled);
      db.current?.close();
      db.current = next;
      setProfile(enrolled);
      setSignIn(false);
      setBase(await snapshot(next));
      setEvents(await next.events.toArray());
      setMessage(
        'Device enrolled. Offline capture is available for up to 24 hours.',
      );
      if (navigator.storage?.persist)
        void navigator.storage.persist().then((ok) => {
          if (ok) setStorage('');
        });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function renew() {
    if (!profile) return;
    setError('');
    try {
      const next = await api<Profile>(
        'enrol',
        { deviceId: profile.context.deviceId },
        profile.deviceToken,
      );
      await saveProfile(db.current!, next);
      setProfile(next);
      setTick(Date.now());
      setMessage(
        'Offline permission renewed. Existing queued records retain their original grants.',
      );
    } catch (e) {
      fail(e);
      setSignIn(true);
    }
  }
  async function capture(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!db.current || !canCapture || busy) return;
    setBusy(true);
    setError('');
    try {
      const f = new FormData(form),
        isItem = ['sale', 'purchase', 'quotation'].includes(kind),
        quantity = Number(f.get('quantity'));
      const amount = String(f.get(isItem ? 'unitPrice' : 'amount') ?? '');
      if (minor(amount) <= 0n)
        throw new Error('Amount must be greater than zero');
      const payload: DeviceEvent['payload'] = {
        documentId: editing?.id ?? crypto.randomUUID(),
        expectedVersion: editing?.version ?? 0,
        description: String(f.get('description')).trim(),
        party: String(f.get('party') ?? 'Walk-in').trim() || 'Walk-in',
        settlement: String(f.get('settlement') ?? 'cash'),
      };
      if (!payload.description) throw new Error('Add a description');
      if (isItem) {
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100000)
          throw new Error('Enter a whole quantity between 1 and 100,000');
        const product = totals.products.find((p) => p.id === productId);
        if (!product) throw new Error('Select a cached product');
        if (kind === 'sale' && product.quantity < quantity)
          throw new Error('Not enough provisional stock');
        Object.assign(payload, { productId, quantity, unitPrice: amount });
      } else payload.amount = amount;
      const dependsOn = events
        .filter(
          (event) =>
            event.state === 'pending' &&
            (event.payload.documentId === payload.documentId ||
              (isItem && event.payload.productId === productId)),
        )
        .map((event) => event.id)
        .slice(-1);
      await db.current.capture({ kind, payload, dependsOn });
      setEditing(null);
      await refresh();
      form.reset();
      setMessage(
        `${names[kind]} saved on this device. ${online ? 'Ready to sync.' : 'It will sync when you reconnect.'}`,
      );
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  }
  async function exportWork() {
    if (!db.current || !profile) return;
    const records = await db.current.events.toArray();
    const blob = new Blob(
      [
        JSON.stringify(
          {
            format: 'bizrail-offline-export-v1',
            context: profile.context,
            exportedAt: new Date().toISOString(),
            events: records,
          },
          null,
          2,
        ),
      ],
      { type: 'application/json' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bizrail-pending-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage(
      'Local copy exported. It excludes passwords and device credentials. Keep it private for recovery review.',
    );
  }
  async function logout() {
    if (!(await db.current?.prepareLogout())) {
      setError(
        'Pending or unresolved work is retained. Sync it before clearing this device, or use “Switch account” to retain it and sign in separately.',
      );
      return;
    }
    try {
      await api('logout', {}, profile?.deviceToken);
      if (db.current) await db.current.delete();
      if (profile)
        localStorage.removeItem(
          `bizrail.device.${profile.identity.tenantId}.${profile.identity.actorId}`,
        );
      localStorage.removeItem('bizrail.active');
      db.current = null;
      setProfile(null);
      setEvents([]);
      setBase(emptySnapshot);
    } catch (e) {
      fail(e);
    }
  }
  async function loadAdmin() {
    try {
      setAdmin(await api<Administration>('administration'));
    } catch (e) {
      fail(e);
    }
  }
  async function revoke(id: string) {
    const reason = window.prompt('Reason for revoking this device:');
    if (!reason) return;
    try {
      await api('revoke', { deviceId: id, reason });
      await loadAdmin();
      setMessage('Device revoked. Any unaccepted upload will be quarantined.');
      if (id === profile?.context.deviceId) {
        await db.current?.quarantine('Device authority revoked');
        await refresh();
      }
    } catch (e) {
      fail(e);
    }
  }
  async function review(id: string, decision: 'release' | 'reject') {
    const reason = window.prompt('Record the review reason:');
    if (!reason) return;
    try {
      const result = await api<Outcome>('review', {
        eventId: id,
        decision,
        reason,
      });
      setMessage(
        `Review recorded: ${result.state}${result.reason ? ` — ${result.reason}` : ''}. Original evidence is retained.`,
      );
      await loadAdmin();
      await runSync();
    } catch (e) {
      fail(e);
    }
  }
  function select(name: string) {
    setActive(name);
    setDrawer(false);
    setError('');
    if (name === 'Sync & devices' && online) void loadAdmin();
  }
  const authForm = (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>
          {create ? 'Create a local workspace' : 'Sign in to your workspace'}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Connect online to enrol this device. Your password stays on the server
          as a secure hash.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={authenticate} className="space-y-4">
          {create && (
            <label className="block text-sm">
              Business name
              <input
                name="name"
                className={inputClass}
                required
                maxLength={100}
              />
            </label>
          )}
          <label className="block text-sm">
            Username
            <input
              name="username"
              className={inputClass}
              autoComplete="username"
              pattern="[a-zA-Z0-9_.-]{3,64}"
              required
            />
          </label>
          <label className="block text-sm">
            Password
            <input
              name="password"
              type="password"
              className={inputClass}
              autoComplete={create ? 'new-password' : 'current-password'}
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <p className="text-xs text-muted-foreground">
            Use at least 12 characters.
          </p>
          <Button className="w-full" disabled={busy || !online}>
            {busy
              ? 'Connecting…'
              : create
                ? 'Create & enrol device'
                : 'Sign in & enrol device'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setCreate(!create)}
          >
            {create
              ? 'Already have an account? Sign in'
              : 'Create a local development workspace'}
          </Button>
          {profile && (
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setSignIn(false)}
            >
              Return to retained offline workspace
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
  if (loading)
    return (
      <main className="grid min-h-screen place-items-center">
        Opening your workspace…
      </main>
    );
  if (!profile || signIn)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 py-12">
        <Brand />
        <div className="max-w-md text-center">
          <h1 className="mt-5 text-3xl font-semibold">
            Everyday business.
            <br />
            Ready when you are.
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Local development workspace · ZMW · Lusaka time
          </p>
        </div>
        {error && (
          <p
            role="alert"
            className="max-w-md rounded-lg bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        )}
        {authForm}
        <p className="max-w-md text-center text-xs text-muted-foreground">
          Development posting rules are not accountant-approved. New workspaces
          include 100 sample items for testing. Use test records only.
        </p>
      </main>
    );
  const nav = (
    <nav aria-label="Workspace navigation" className="space-y-1">
      {navigation.map(([name, Icon]) => (
        <Button
          key={name}
          variant="ghost"
          className={`h-11 w-full justify-start gap-3 ${active === name ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground'}`}
          aria-current={active === name ? 'page' : undefined}
          onClick={() => select(name)}
        >
          <Icon size={18} />
          {name}
        </Button>
      ))}
    </nav>
  );
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[235px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar p-5 lg:flex">
        <Brand />
        <div className="my-8 rounded-xl border p-3">
          <p className="truncate text-sm font-semibold">
            {profile.identity.name}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Main branch · ZMW
          </p>
        </div>
        {nav}
        <div className="mt-auto space-y-3 pt-8">
          <p className="text-xs text-muted-foreground">
            Signed in as {profile.identity.username}
          </p>
          <Button variant="ghost" size="sm" onClick={() => void logout()}>
            <LogOut size={15} /> Sign out
          </Button>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b bg-card px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Sheet open={drawer} onOpenChange={setDrawer}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Bizrail Africa</SheetTitle>
                </SheetHeader>
                <div className="p-4">
                  {nav}
                  <Button
                    className="mt-8"
                    variant="outline"
                    onClick={() => void logout()}
                  >
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
            <span className="text-sm text-muted-foreground">
              Workspace <span className="mx-2">/</span>
              <span className="font-medium text-foreground">{active}</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline">
              {online ? <Wifi size={13} /> : <WifiOff size={13} />}{' '}
              {online ? 'Online' : 'Offline'}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => void runSync()}
              disabled={busy || !online}
            >
              <RefreshCw size={14} className={busy ? 'animate-spin' : ''} />{' '}
              {busy
                ? 'Working…'
                : `Sync${pending.length ? ` (${pending.length})` : ''}`}
            </Button>
          </div>
        </header>
        <main className="mx-auto max-w-7xl space-y-6 p-5 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                {profile.identity.name}
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                {active === 'Overview' ? 'Your business, at a glance.' : active}
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {active === 'Overview'
                  ? 'Keep the day moving, even without a connection.'
                  : 'Main branch · Amounts in ZMW · Africa/Lusaka'}
              </p>
            </div>
            {active !== 'Capture' && (
              <Button onClick={() => select('Capture')}>
                <Plus size={16} /> Record transaction
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-accent/40 px-4 py-3 text-xs">
            <span>
              {offlineReady ? 'Offline app ready' : 'Preparing offline app'} ·{' '}
              {pending.length} pending · Last sync: {date(base.at)}
            </span>
            <span>Offline permission: {date(profile.grant.expiresAt)}</span>
          </div>
          {!canCapture && (
            <div
              role="alert"
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm"
            >
              {!base.at
                ? 'Complete the first online sync to cache your authorised catalogue.'
                : blocked
                  ? 'This device has been revoked. Pending work is preserved for review.'
                  : 'Offline permission has expired or the device clock is incorrect. Connect online to renew before capturing.'}
              <Button
                className="ml-3"
                size="sm"
                variant="outline"
                disabled={!online}
                onClick={() => void renew()}
              >
                Verify online
              </Button>
            </div>
          )}
          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </div>
          )}
          {message && (
            <p
              role="status"
              className="flex items-start gap-2 text-sm text-primary"
            >
              <CheckCircle2 size={16} className="mt-0.5 shrink-0" />
              {message}
            </p>
          )}
          {active === 'Overview' && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  ['Sales recorded', money(totals.sales)],
                  ['Expenses recorded', money(totals.expenses)],
                  ['Cash balance', money(totals.balances['1000'] ?? 0n)],
                  [
                    'Stock on hand',
                    `${totals.products.reduce((s, p) => s + p.quantity, 0)} units`,
                  ],
                ].map(([label, value]) => (
                  <Card key={label}>
                    <CardContent className="p-5">
                      <p className="text-sm text-muted-foreground">{label}</p>
                      <p
                        className="mt-3 text-2xl font-semibold"
                        data-testid={
                          label === 'Sales recorded'
                            ? 'sales-total'
                            : label === 'Expenses recorded'
                              ? 'expenses-total'
                              : undefined
                        }
                      >
                        {value}
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {pending.length
                          ? 'Includes provisional device records'
                          : 'Server accepted records'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle>Keep business moving</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-3 sm:grid-cols-2">
                    {Object.entries(names).map(([key, label]) => (
                      <button
                        key={key}
                        className="flex items-center justify-between rounded-lg border p-4 text-left text-sm font-medium hover:bg-accent"
                        onClick={() => {
                          setKind(key as Kind);
                          setEditing(null);
                          select('Capture');
                        }}
                      >
                        {label}
                        <ArrowUpRight size={17} />
                      </button>
                    ))}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Sync & device health</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 text-sm">
                    <p>
                      <strong>{pending.length}</strong> records waiting to sync
                    </p>
                    <p>
                      <strong>{issues.length}</strong> records need attention
                    </p>
                    <p className="text-muted-foreground">
                      Local changes are provisional until accepted. Reconnecting
                      never silently overwrites a financial record.
                    </p>
                    <Button
                      variant="outline"
                      onClick={() => select('Sync & devices')}
                    >
                      View sync details
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
          {active === 'Capture' && (
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
              <Card>
                <CardHeader>
                  <CardTitle>
                    {editing
                      ? 'Edit quotation'
                      : `Record ${names[kind].toLowerCase()}`}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-6 flex flex-wrap gap-2">
                    {Object.entries(names).map(([key, label]) => (
                      <Button
                        key={key}
                        type="button"
                        size="sm"
                        variant={kind === key ? 'default' : 'outline'}
                        onClick={() => {
                          setKind(key as Kind);
                          setEditing(null);
                        }}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                  <form
                    key={`${kind}-${editing?.id ?? 'new'}`}
                    onSubmit={capture}
                    className="space-y-4"
                  >
                    <label className="block text-sm">
                      Description
                      <input
                        name="description"
                        className={inputClass}
                        required
                        maxLength={200}
                        defaultValue={
                          editing
                            ? String(
                                base.documents.find((d) => d.id === editing.id)
                                  ?.payload.description ?? '',
                              )
                            : ''
                        }
                      />
                    </label>
                    <label className="block text-sm">
                      Customer / supplier reference
                      <input
                        name="party"
                        defaultValue={String(
                          editingDocument?.payload.party ?? '',
                        )}
                        className={inputClass}
                        maxLength={100}
                        placeholder="Walk-in"
                      />
                    </label>
                    {['sale', 'purchase', 'quotation'].includes(kind) ? (
                      <>
                        <label className="block text-sm">
                          Product
                          <select
                            name="productId"
                            className={inputClass}
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            required
                          >
                            <option value="">Select a cached product</option>
                            {totals.products.map((p) => (
                              <option value={p.id} key={p.id}>
                                {p.name} — {p.quantity} units
                              </option>
                            ))}
                          </select>
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                          <label className="block text-sm">
                            Quantity
                            <input
                              name="quantity"
                              type="number"
                              min="1"
                              max="100000"
                              step="1"
                              defaultValue={String(
                                editingDocument?.payload.quantity ?? 1,
                              )}
                              className={inputClass}
                              required
                            />
                          </label>
                          <label className="block text-sm">
                            Unit price (ZMW)
                            <input
                              key={productId}
                              name="unitPrice"
                              inputMode="decimal"
                              defaultValue={
                                editingDocument?.payload.productId === productId
                                  ? String(editingDocument.payload.unitPrice)
                                  : productId
                                    ? (
                                        Number(
                                          base.products.find(
                                            (p) => p.id === productId,
                                          )?.price_minor ?? 0,
                                        ) / 100
                                      ).toFixed(2)
                                    : ''
                              }
                              className={inputClass}
                              required
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <label className="block text-sm">
                        Amount (ZMW)
                        <input
                          name="amount"
                          inputMode="decimal"
                          className={inputClass}
                          required
                        />
                      </label>
                    )}
                    {kind !== 'cash_receipt' && kind !== 'quotation' && (
                      <label className="block text-sm">
                        Settlement
                        <select name="settlement" className={inputClass}>
                          <option value="cash">Cash</option>
                          <option value="credit">On credit</option>
                        </select>
                      </label>
                    )}
                    <Button type="submit" disabled={!canCapture || busy}>
                      {busy ? 'Saving…' : 'Save on device'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Saved locally first. Stock and ledger totals update
                      immediately.
                    </p>
                  </form>
                </CardContent>
              </Card>
              <Card className="h-fit">
                <CardHeader>
                  <CardTitle>Before you record</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm text-muted-foreground">
                  <p>
                    This workspace uses development accounting rules with no tax
                    calculation or fiscal confirmation.
                  </p>
                  <p>
                    Cash receipts reduce receivables. Quotations do not move
                    stock or post journals.
                  </p>
                  <p>
                    External payments and fiscal approvals cannot be confirmed
                    offline.
                  </p>
                  <p>
                    Posted financial records are immutable. Quotation edits use
                    version checks.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}
          {active === 'Activity' && (
            <Card>
              <CardHeader>
                <CardTitle>Transaction history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!events.length && !base.documents.length && (
                  <Empty text="No transactions yet. Record your first sale or expense." />
                )}
                {events
                  .filter((e) => e.state !== 'accepted')
                  .map((e) => (
                    <div key={e.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap justify-between gap-2">
                        <strong className="text-sm">
                          {names[e.kind]} ·{' '}
                          {String(e.payload.description ?? 'Retained event')}
                        </strong>
                        <Badge variant="outline">
                          {e.state === 'pending' ? 'Provisional' : e.state}
                        </Badge>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {date(e.capturedAt)} ·{' '}
                        {e.reason ?? 'Saved on this device'}
                      </p>
                      <details className="mt-2 text-xs">
                        <summary>Source details</summary>
                        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
                          {JSON.stringify(e.payload, null, 2)}
                        </pre>
                      </details>
                    </div>
                  ))}
                {base.documents.map((d) => (
                  <div key={d.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap justify-between gap-2">
                      <strong className="text-sm">
                        {names[d.kind]} · {String(d.payload.description)}
                      </strong>
                      <span className="text-sm font-semibold">
                        {money(d.total_minor)}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Accepted · {date(d.occurred_at)} · Version {d.version}
                    </p>
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      Source: {d.id}
                    </p>
                    {d.kind === 'quotation' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-3"
                        onClick={() => {
                          setEditing({ id: d.id, version: d.version });
                          setKind('quotation');
                          setProductId(String(d.payload.productId));
                          select('Capture');
                        }}
                      >
                        Edit quotation
                      </Button>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {active === 'Inventory' && (
            <Card>
              <CardHeader>
                <CardTitle>Stock · Main branch</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {totals.products.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
                  >
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Unit price {money(p.price_minor)} ·{' '}
                        {pending.length
                          ? 'Includes provisional movements'
                          : 'Accepted stock'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold" data-testid="stock-quantity">
                        {p.quantity} units
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Value {money(p.value_minor)}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {active === 'Ledger' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Chart of accounts</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-3">Account</th>
                          <th className="p-3">Type</th>
                          <th className="p-3 text-right">
                            Balance (+ debit / − credit)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {base.accounts.map((a) => (
                          <tr className="border-b" key={a.id}>
                            <td className="p-3">
                              {a.code} · {a.name}
                            </td>
                            <td className="p-3">{a.kind}</td>
                            <td className="p-3 text-right tabular-nums">
                              {money(totals.balances[a.code] ?? 0n)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    {pending.length
                      ? 'Includes provisional device changes.'
                      : 'Accepted balances.'}{' '}
                    Net balance:{' '}
                    {money(
                      Object.values(totals.balances).reduce(
                        (a, b) => a + b,
                        0n,
                      ),
                    )}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Posted journals · read-only</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {base.journals.map((j) => (
                    <details key={j.id} className="rounded-lg border p-4">
                      <summary className="cursor-pointer text-sm font-medium">
                        {j.description}{' '}
                        <span className="text-xs font-normal text-muted-foreground">
                          · {date(j.occurred_at)}
                        </span>
                      </summary>
                      <p className="my-3 break-all text-xs text-muted-foreground">
                        Source: {j.source_id}
                      </p>
                      {j.lines.map((l, i) => (
                        <div
                          key={i}
                          className="flex justify-between gap-3 py-1 text-sm"
                        >
                          <span>
                            {l.code} {l.name}
                          </span>
                          <span>{money(l.amount)}</span>
                        </div>
                      ))}
                    </details>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
          {active === 'Sync & devices' && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Offline permission & recovery</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <p>
                    {pending.length} pending · {issues.length} need attention ·
                    Permission expires {date(profile.grant.expiresAt)}
                  </p>
                  <p className="break-all text-xs text-muted-foreground">
                    Device: {profile.context.deviceId}
                  </p>
                  {storage && <p className="text-amber-800">{storage}</p>}
                  <p className="text-muted-foreground">
                    Unsynced device loss is unrecoverable without a local copy.
                    Clearing browser data removes unsynced records. Export
                    regularly and keep the file private.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => void renew()}
                      disabled={!online}
                    >
                      Renew permission
                    </Button>
                    <Button variant="outline" onClick={() => void exportWork()}>
                      <Download size={15} />
                      Export device records
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCreate(false);
                        setSignIn(true);
                      }}
                    >
                      Switch account
                    </Button>
                    {install && (
                      <Button
                        variant="outline"
                        onClick={() => void install.prompt()}
                      >
                        Install app
                      </Button>
                    )}
                    {update && (
                      <Button
                        variant="outline"
                        disabled={pending.length > 0 || issues.length > 0}
                        onClick={() => {
                          navigator.serviceWorker.addEventListener(
                            'controllerchange',
                            () => location.reload(),
                            { once: true },
                          );
                          update.waiting?.postMessage({ type: 'SKIP_WAITING' });
                        }}
                      >
                        Apply app update
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    To install: use your browser’s “Install app” or “Add to Home
                    Screen” menu. App updates wait while unresolved work exists.
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Queue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {!events.length && (
                    <Empty text="Your device queue is clear." />
                  )}
                  {events.map((e) => (
                    <div
                      key={e.id}
                      className="flex flex-wrap justify-between gap-3 border-b py-3 text-sm"
                    >
                      <div>
                        <p>
                          {names[e.kind]} ·{' '}
                          {String(e.payload.description ?? e.id)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Sequence {e.sequence} ·{' '}
                          {e.reason ?? date(e.capturedAt)}
                        </p>
                      </div>
                      <Badge variant="outline">{e.state}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
              {profile.identity.canManage && (
                <>
                  <Card>
                    <CardHeader>
                      <CardTitle>Enrolled devices</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!online}
                        onClick={() => void loadAdmin()}
                      >
                        Refresh administration
                      </Button>
                      {admin?.devices.map((d) => (
                        <div
                          key={d.id}
                          className="flex flex-wrap justify-between gap-3 rounded-lg border p-3"
                        >
                          <div className="min-w-0 text-sm">
                            <p>
                              {d.username}{' '}
                              {d.id === profile.context.deviceId
                                ? '· This device'
                                : ''}
                            </p>
                            <p className="break-all text-xs text-muted-foreground">
                              {d.id}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={!online || !!d.revoked_at}
                            onClick={() => void revoke(d.id)}
                          >
                            {d.revoked_at ? 'Revoked' : 'Revoke'}
                          </Button>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Review preserved work</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!admin?.review.length && (
                        <Empty text="No server conflicts or quarantined events to review." />
                      )}
                      {admin?.review.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg border p-4 text-sm"
                        >
                          <p className="font-medium">
                            {names[r.envelope.kind]} ·{' '}
                            {r.envelope.payload.description}
                          </p>
                          <details className="my-3 text-xs">
                            <summary className="cursor-pointer">
                              Inspect original source record
                            </summary>
                            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-all">
                              {JSON.stringify(r.envelope, null, 2)}
                            </pre>
                          </details>
                          <p className="my-2 text-xs text-muted-foreground">
                            {r.state} · {r.reason}{' '}
                            {r.decision ? `· Reviewed: ${r.decision}` : ''}
                          </p>
                          {r.state === 'quarantined' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                disabled={
                                  !online ||
                                  r.actor_id === profile.context.actorId ||
                                  r.decision === 'reject'
                                }
                                onClick={() => void review(r.id, 'release')}
                              >
                                {r.decision === 'release'
                                  ? 'Retry reviewed posting'
                                  : 'Approve & post'}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={
                                  !online ||
                                  r.actor_id === profile.context.actorId ||
                                  !!r.decision
                                }
                                onClick={() => void review(r.id, 'reject')}
                              >
                                Reject
                              </Button>
                            </div>
                          )}
                          {r.actor_id === profile.context.actorId && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              A different authorised reviewer must decide on
                              your work.
                            </p>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Add a development reviewer</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <form
                        className="grid gap-3 sm:grid-cols-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          const form = e.currentTarget;
                          const f = new FormData(form);
                          void api('reviewer', {
                            username: String(f.get('username')),
                            password: String(f.get('password')),
                          })
                            .then(() => {
                              form.reset();
                              setMessage(
                                'Reviewer account created. Sign in separately to review quarantined work.',
                              );
                            })
                            .catch(fail);
                        }}
                      >
                        <label className="text-sm">
                          Username
                          <input
                            name="username"
                            className={inputClass}
                            required
                            minLength={3}
                          />
                        </label>
                        <label className="text-sm">
                          Password
                          <input
                            name="password"
                            type="password"
                            className={inputClass}
                            required
                            minLength={12}
                          />
                        </label>
                        <Button className="self-end" disabled={!online}>
                          Add reviewer
                        </Button>
                      </form>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          )}
          <footer className="border-t pt-5 text-xs text-muted-foreground">
            Development workspace · Posting policy awaits accountant approval ·
            External payments and fiscal confirmation are not enabled.
          </footer>
        </main>
      </div>
    </div>
  );
}
function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-xl font-bold text-white">
        b.
      </span>
      <span className="text-lg font-semibold tracking-tight">
        bizrail{' '}
        <span className="font-normal text-muted-foreground">africa</span>
      </span>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
      {text}
    </p>
  );
}
