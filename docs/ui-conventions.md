# UI conventions

User preference recorded 2026-09-13: use **shadcn/ui wherever possible** throughout Bizrail Africa.

- Use shadcn/ui primitives for buttons, forms, dialogs, navigation, tables and feedback when a suitable component exists. Compose product workflows from these components; add custom behaviour when the workflow needs it.
- Keep component source in `apps/web/components/ui` and configure the CLI through `apps/web/components.json`. Add only components in use through the official registry.
- Use Tailwind CSS and shared semantic colour/radius variables in `apps/web/app/globals.css` so subsequent screens have consistent styling.
- Keep components usable with a keyboard, labelled for assistive technology and responsive on small screens.
- Use the local development preview to review visible changes as features are built. Clearly identify preview-only flows and unavailable financial data; connecting the UI does not itself complete ledger, fiscal or offline acceptance gates.

References: [shadcn/ui installation](https://ui.shadcn.com/docs/installation/next), [CLI](https://ui.shadcn.com/docs/cli).
