'use client';

import { useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Building2,
  ChartNoAxesCombined,
  ChevronRight,
  CircleDashed,
  LayoutDashboard,
  Menu,
  Package,
  ReceiptText,
  Settings2,
  ShoppingBag,
  Users,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

const sections = [
  {
    name: 'Overview',
    icon: LayoutDashboard,
    description: 'A clear view of your daily business.',
  },
  {
    name: 'Sales',
    icon: ReceiptText,
    description: 'Quotations, sales and receipts, together in one place.',
  },
  {
    name: 'Purchases',
    icon: ShoppingBag,
    description: 'Keep supplier bills, purchases and expenses organised.',
  },
  {
    name: 'Inventory',
    icon: Package,
    description: 'Follow your stock, its value and what needs replenishing.',
  },
  {
    name: 'Money',
    icon: Wallet,
    description: 'Bring cash, bank and mobile-money records together.',
  },
  {
    name: 'Contacts',
    icon: Users,
    description: 'Build a clear picture of your customers and suppliers.',
  },
  {
    name: 'Reports',
    icon: ChartNoAxesCombined,
    description: 'Understand your cash flow, profit and business performance.',
  },
  {
    name: 'Business setup',
    icon: Settings2,
    description: 'Your business details, products and opening balances.',
  },
] as const;
type SectionName = (typeof sections)[number]['name'];

function Brand() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex size-9 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground"
        aria-hidden="true"
      >
        b.
      </span>
      <span className="text-lg font-semibold tracking-tight">
        bizrail
        <span className="ml-1 font-normal text-muted-foreground">africa</span>
      </span>
    </div>
  );
}

export function WorkspacePreview() {
  const [active, setActive] = useState<SectionName>('Overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const section = sections.find((item) => item.name === active)!;

  function selectSection(name: SectionName) {
    setActive(name);
    setMenuOpen(false);
  }

  const navigation = (
    <nav aria-label="Workspace navigation" className="space-y-1">
      {sections.map(({ name, icon: Icon }) => (
        <Button
          key={name}
          variant="ghost"
          onClick={() => selectSection(name)}
          aria-current={active === name ? 'page' : undefined}
          className={cn(
            'h-11 w-full justify-start gap-3 px-3 font-normal text-muted-foreground',
            active === name &&
              'bg-accent font-semibold text-accent-foreground hover:bg-accent hover:text-accent-foreground',
            name === 'Business setup' && 'mt-7',
          )}
        >
          <Icon className="size-[18px]" aria-hidden="true" />
          {name}
        </Button>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
      <a
        href="#workspace-content"
        className="sr-only fixed top-2 left-2 z-[100] rounded bg-primary p-3 text-primary-foreground focus:not-sr-only"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar px-5 py-7 lg:flex">
        <Brand />
        <div className="mt-9 flex items-center gap-3 rounded-xl border p-3">
          <Building2
            className="size-5 text-muted-foreground"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-medium">Your business</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Preview workspace
            </p>
          </div>
        </div>
        <p className="mt-8 mb-3 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground">
          WORKSPACE
        </p>
        {navigation}
        <div className="mt-auto pt-8">
          <Separator />
          <p className="pt-5 text-xs leading-5 text-muted-foreground">
            Everyday business.
            <br />
            One connected workspace.
          </p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="flex h-[76px] items-center justify-between gap-3 border-b bg-card px-5 sm:px-8 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu aria-hidden="true" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px] max-w-[85vw] p-5">
                <SheetHeader className="px-0 pt-8">
                  <SheetTitle>Bizrail Africa</SheetTitle>
                  <SheetDescription>
                    Explore your workspace preview.
                  </SheetDescription>
                </SheetHeader>
                {navigation}
              </SheetContent>
            </Sheet>
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Workspace
            </span>
            <ChevronRight
              className="hidden size-3 text-muted-foreground sm:inline"
              aria-hidden="true"
            />
            <span className="truncate text-sm font-medium">{active}</span>
          </div>
          <Badge
            variant="outline"
            className="shrink-0 gap-2 rounded-full px-3 py-1.5 font-normal"
          >
            <CircleDashed className="size-3" aria-hidden="true" />
            Preview
          </Badge>
        </header>

        <main
          id="workspace-content"
          tabIndex={-1}
          className="mx-auto max-w-[1440px] space-y-7 p-5 outline-none sm:p-8 lg:p-10"
        >
          <div>
            <p className="mb-2 text-xs font-medium tracking-wide text-primary">
              YOUR WORKSPACE, TAKING SHAPE
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {active === 'Overview' ? 'Your business at a glance.' : active}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {active === 'Overview'
                ? 'Sales, stock and money. A little more clarity for every business day.'
                : section.description}
            </p>
          </div>

          {active === 'Overview' ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    title: 'Sales today',
                    icon: ReceiptText,
                    detail: 'Sales will appear here',
                  },
                  {
                    title: 'Cash & accounts',
                    icon: Wallet,
                    detail: 'Balances not connected',
                  },
                  {
                    title: 'Amount owed to you',
                    icon: BookOpen,
                    detail: 'No receivables connected',
                  },
                  {
                    title: 'Stock value',
                    icon: Package,
                    detail: 'Inventory not connected',
                  },
                ].map(({ title, icon: Icon, detail }) => (
                  <Card key={title} className="gap-5 p-5">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-sm font-medium text-muted-foreground">
                        {title}
                      </h2>
                      <Icon
                        className="size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <div>
                      <p
                        className="text-3xl font-medium tracking-tight"
                        aria-label="No value available"
                      >
                        —{' '}
                        <span className="text-xs font-normal tracking-normal text-muted-foreground">
                          ZMW
                        </span>
                      </p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {detail}
                      </p>
                    </div>
                  </Card>
                ))}
              </div>

              <Card className="border-0 bg-accent ring-0">
                <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
                  <div className="max-w-xl">
                    <p className="mb-3 text-xs font-semibold tracking-wide text-primary">
                      A PLACE FOR YOUR NEXT CHAPTER
                    </p>
                    <h2 className="text-2xl font-semibold tracking-tight">
                      Less scattered. More in control.
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      Explore the first look at Bizrail. Your business records
                      will come together here as each workflow becomes
                      available.
                    </p>
                  </div>
                  <Button
                    className="h-11 self-start px-5 sm:self-center"
                    onClick={() => selectSection('Sales')}
                  >
                    Explore sales <ArrowRight aria-hidden="true" />
                  </Button>
                </CardContent>
              </Card>

              <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
                <Card>
                  <CardHeader className="p-5 pb-0">
                    <CardTitle>
                      <h2>Recent activity</h2>
                    </CardTitle>
                    <CardDescription>
                      Your latest business records, in one place.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex min-h-56 flex-col items-center justify-center px-6 py-8 text-center">
                    <div className="mb-4 flex size-12 items-center justify-center rounded-2xl border bg-background">
                      <ReceiptText
                        className="size-5 text-muted-foreground"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="text-sm font-medium">
                      No activity to show yet
                    </h3>
                    <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
                      Transactions are not connected in this preview. Your
                      future sales and expenses will appear here.
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="p-5 pb-0">
                    <CardTitle>
                      <h2>Find your way around</h2>
                    </CardTitle>
                    <CardDescription>
                      Start with the essentials.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 px-3 pb-2">
                    {[
                      {
                        name: 'Sales' as const,
                        detail: 'Quotations, invoices & receipts',
                        icon: ReceiptText,
                      },
                      {
                        name: 'Inventory' as const,
                        detail: 'Products, stock & movements',
                        icon: Package,
                      },
                      {
                        name: 'Money' as const,
                        detail: 'Cash, bank & mobile money',
                        icon: Wallet,
                      },
                    ].map(({ name, detail, icon: Icon }) => (
                      <Button
                        key={name}
                        variant="ghost"
                        onClick={() => selectSection(name)}
                        className="h-auto w-full justify-start gap-3 rounded-lg p-3 text-left"
                      >
                        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-background">
                          <Icon aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 whitespace-normal">
                          <span className="block text-sm">{name}</span>
                          <span className="mt-1 block text-xs font-normal text-muted-foreground">
                            {detail}
                          </span>
                        </span>
                        <ArrowUpRight
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                      </Button>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="flex min-h-80 flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
                  <section.icon className="size-6" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-semibold">
                  {active} will live here
                </h2>
                <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
                  This is a preview of your workspace. {section.description}{' '}
                  This workflow is not available yet.
                </p>
                <Button
                  variant="outline"
                  className="mt-6 h-11 px-4"
                  onClick={() => selectSection('Overview')}
                >
                  Back to overview <ArrowRight aria-hidden="true" />
                </Button>
              </CardContent>
            </Card>
          )}
          <footer className="flex flex-col gap-2 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:justify-between">
            <span>Bizrail Africa · Workspace preview</span>
            <span>No live business data connected</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
