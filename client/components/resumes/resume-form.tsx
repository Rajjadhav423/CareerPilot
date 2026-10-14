"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, Eye, EyeOff, Plus, Trash2 } from "lucide-react";

import { RESUME_LIMITS, type ResumeLayout, type SectionType } from "@/lib/api/resumes";
import {
  emptyEntry,
  emptyGroup,
  newId,
  newSection,
  SECTION_PRESETS,
  SECTION_TYPES,
  type EditableEntry,
  type EditableGroup,
  type EditableResume,
  type EditableSection,
} from "@/lib/resumes/editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field } from "@/components/ui/field";
import { Lozenge } from "@/components/ui/lozenge";
import { TextField } from "@/components/ui/text-field";
import { Textarea } from "@/components/ui/textarea";

const FORMAT_HINT = "Use **bold**, *italic*, [link text](https://…) or saved details like {{github}}";
const TYPE_LABEL: Record<SectionType, string> = { entries: "Entries", text: "Paragraph", list: "Bullet list", skills: "Skills" };

type ResumeFormProps = {
  value: EditableResume;
  onChange: (next: EditableResume) => void;
  /** Server validation errors keyed like "data.sections[1].entries[0].title" */
  errors: Record<string, string>;
};

/** The resume editor's form: basics, then any sections the user chooses, in their order. */
export function ResumeForm({ value, onChange, errors }: ResumeFormProps) {
  const basics = value.basics;
  const setBasics = (patch: Partial<EditableResume["basics"]>) => onChange({ ...value, basics: { ...basics, ...patch } });
  const setSections = (sections: EditableSection[]) => onChange({ ...value, sections });
  const err = (path: string) => errors[`data.${path}`];

  return (
    <div className="flex flex-col gap-4">
      <Card className="gap-4 p-4">
        <h2 className="text-base font-semibold">Basics</h2>
        <div className="grid gap-4 @lg:grid-cols-2">
          <Field htmlFor="basics-name" label="Full name" required error={err("basics.fullName")}>
            <TextField id="basics-name" value={basics.fullName} maxLength={100} autoComplete="name"
              onChange={(e) => setBasics({ fullName: e.target.value })} aria-invalid={!!err("basics.fullName")} />
          </Field>
          <Field htmlFor="basics-headline" label="Headline" hint="e.g. Backend Engineer · Java & Spring">
            <TextField id="basics-headline" value={basics.headline} maxLength={150}
              onChange={(e) => setBasics({ headline: e.target.value })} />
          </Field>
          <Field htmlFor="basics-email" label="Email" error={err("basics.email")}>
            <TextField id="basics-email" type="email" inputMode="email" autoComplete="email" value={basics.email}
              maxLength={254} onChange={(e) => setBasics({ email: e.target.value })} aria-invalid={!!err("basics.email")} />
          </Field>
          <Field htmlFor="basics-phone" label="Phone">
            <TextField id="basics-phone" type="tel" autoComplete="tel" value={basics.phone} maxLength={40}
              onChange={(e) => setBasics({ phone: e.target.value })} />
          </Field>
          <Field htmlFor="basics-location" label="Location" className="@lg:col-span-2">
            <TextField id="basics-location" value={basics.location} maxLength={100}
              onChange={(e) => setBasics({ location: e.target.value })} />
          </Field>
        </div>
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold text-subtle">Links</p>
          {basics.links.map((link, i) => (
            <div key={i} className="grid items-end gap-2 @lg:grid-cols-[1fr_2fr_auto]">
              <Field htmlFor={`link-${i}-label`} label="Label">
                <TextField id={`link-${i}-label`} value={link.label} maxLength={40} placeholder="GitHub"
                  onChange={(e) => setBasics({ links: basics.links.map((l, j) => (j === i ? { ...l, label: e.target.value } : l)) })} />
              </Field>
              <Field htmlFor={`link-${i}-url`} label="Web address" error={err(`basics.links[${i}].url`)}>
                <TextField id={`link-${i}-url`} value={link.url} maxLength={500} inputMode="url" placeholder="github.com/you"
                  onChange={(e) => setBasics({ links: basics.links.map((l, j) => (j === i ? { ...l, url: e.target.value } : l)) })}
                  aria-invalid={!!err(`basics.links[${i}].url`)} />
              </Field>
              <Button variant="subtle" size="icon" aria-label={`Remove link ${i + 1}`}
                onClick={() => setBasics({ links: basics.links.filter((_, j) => j !== i) })}>
                <Trash2 />
              </Button>
            </div>
          ))}
          <Button className="self-start" size="compact" disabled={basics.links.length >= RESUME_LIMITS.links}
            onClick={() => setBasics({ links: [...basics.links, { label: "", url: "" }] })}>
            <Plus /> Add link
          </Button>
        </div>
      </Card>

      {value.sections.map((section, index) => (
        <SectionCard
          key={section.id}
          section={section}
          index={index}
          count={value.sections.length}
          errors={errors}
          onChange={(next) => setSections(value.sections.map((s, i) => (i === index ? next : s)))}
          onMove={(by) => setSections(move(value.sections, index, by))}
          onRemove={() => setSections(value.sections.filter((_, i) => i !== index))}
        />
      ))}

      <AddSectionMenu
        disabled={value.sections.length >= RESUME_LIMITS.sections}
        onAdd={(type, title) => setSections([...value.sections, newSection(type, title)])}
      />

      <MarginsCard layout={value.layout} errors={errors} onChange={(layout) => onChange({ ...value, layout })} />
    </div>
  );
}

const MARGINS = [
  { key: "marginTop", label: "Top", fallback: 15 },
  { key: "marginRight", label: "Right", fallback: 16 },
  { key: "marginBottom", label: "Bottom", fallback: 16 },
  { key: "marginLeft", label: "Left", fallback: 16 },
] as const;

/** Page margins in mm. Empty = the template default (shown as the placeholder). */
function MarginsCard({ layout, errors, onChange }: {
  layout: ResumeLayout | null; errors: Record<string, string>; onChange: (layout: ResumeLayout | null) => void;
}) {
  function set(key: (typeof MARGINS)[number]["key"], text: string) {
    const next: ResumeLayout = { ...layout };
    const value = text.trim() === "" ? null : Number(text);
    if (value === null || !Number.isFinite(value)) delete next[key];
    else next[key] = value;
    onChange(Object.keys(next).length ? next : null);
  }

  return (
    <Card className="gap-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">Page margins</h2>
          <p className="text-xs text-subtlest">Millimetres, 5–40. Leave empty for the template default.</p>
        </div>
        {layout && (
          <Button size="compact" variant="subtle" onClick={() => onChange(null)}>Reset</Button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 @lg:grid-cols-4">
        {MARGINS.map((m) => (
          <Field key={m.key} htmlFor={`margin-${m.key}`} label={`${m.label} (mm)`} error={errors[`data.layout.${m.key}`]}>
            <TextField id={`margin-${m.key}`} type="number" inputMode="decimal" min={5} max={40} step={1}
              placeholder={String(m.fallback)} value={layout?.[m.key] ?? ""}
              onChange={(e) => set(m.key, e.target.value)} aria-invalid={!!errors[`data.layout.${m.key}`]} />
          </Field>
        ))}
      </div>
    </Card>
  );
}

function AddSectionMenu({ onAdd, disabled }: { onAdd: (type: SectionType, title: string) => void; disabled: boolean }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="primary" className="self-start" disabled={disabled}>
          <Plus /> Add section
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-96 w-72 overflow-y-auto">
        <DropdownMenuLabel>Common sections</DropdownMenuLabel>
        {SECTION_PRESETS.map((preset) => (
          <DropdownMenuItem key={preset.title} onSelect={() => onAdd(preset.type, preset.title)}>
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">{preset.title}</span>
              <span className="text-xs text-subtlest">{preset.hint}</span>
            </div>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Custom section</DropdownMenuLabel>
        {SECTION_TYPES.map((t) => (
          <DropdownMenuItem key={t.type} onSelect={() => onAdd(t.type, "New section")}>
            <div className="flex min-w-0 flex-col">
              <span className="font-medium">{t.label}</span>
              <span className="text-xs text-subtlest">{t.hint}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SectionCardProps = {
  section: EditableSection;
  index: number;
  count: number;
  errors: Record<string, string>;
  onChange: (next: EditableSection) => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
};

function SectionCard({ section, index, count, errors, onChange, onMove, onRemove }: SectionCardProps) {
  const [open, setOpen] = useState(true);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const path = `data.sections[${index}]`;
  const titleError = errors[`${path}.title`];
  const set = (patch: Partial<EditableSection>) => onChange({ ...section, ...patch });

  return (
    <Card className={section.visible ? "gap-3 p-4" : "gap-3 p-4 opacity-75"}>
      <div className="flex items-start gap-2">
        <Button variant="subtle" size="icon" aria-label={open ? "Collapse section" : "Expand section"}
          aria-expanded={open} onClick={() => setOpen(!open)} className="mt-0.5 shrink-0">
          {open ? <ChevronDown /> : <ChevronRight />}
        </Button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <label htmlFor={`${section.id}-title`} className="sr-only">Section title</label>
          <TextField id={`${section.id}-title`} value={section.title} maxLength={60} className="font-semibold"
            onChange={(e) => set({ title: e.target.value })} aria-invalid={!!titleError} />
          <div className="flex flex-wrap items-center gap-2">
            <Lozenge>{TYPE_LABEL[section.type]}</Lozenge>
            {!section.visible && <Lozenge appearance="moved">Hidden from PDF</Lozenge>}
            {titleError && <span className="text-xs text-danger-text">Title {titleError}</span>}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <Button variant="subtle" size="icon-compact" aria-label={section.visible ? "Hide section from PDF" : "Show section in PDF"}
            aria-pressed={!section.visible} onClick={() => set({ visible: !section.visible })}>
            {section.visible ? <Eye /> : <EyeOff />}
          </Button>
          <Button variant="subtle" size="icon-compact" aria-label="Move section up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp />
          </Button>
          <Button variant="subtle" size="icon-compact" aria-label="Move section down" disabled={index === count - 1}
            onClick={() => onMove(1)}>
            <ArrowDown />
          </Button>
          <Button variant="subtle" size="icon-compact" aria-label={`Delete section ${section.title}`}
            onClick={() => setConfirmRemove(true)}>
            <Trash2 />
          </Button>
        </div>
      </div>

      {confirmRemove && (
        <div className="flex flex-wrap items-center gap-2 rounded-sm bg-danger px-3 py-2 text-sm" role="alert">
          <span className="flex-1">Delete “{section.title || "this section"}” and everything in it?</span>
          <Button size="compact" variant="danger" onClick={onRemove}>Delete</Button>
          <Button size="compact" variant="subtle" onClick={() => setConfirmRemove(false)}>Cancel</Button>
        </div>
      )}

      {open && (
        <>
          {section.type === "text" && (
            <Field htmlFor={`${section.id}-content`} label="Text" hint={`Blank line = new paragraph. ${FORMAT_HINT}`}
              error={errors[`${path}.content`]}>
              <Textarea id={`${section.id}-content`} rows={4} value={section.content} maxLength={4000}
                onChange={(e) => set({ content: e.target.value })} />
            </Field>
          )}

          {section.type === "list" && (
            <Field htmlFor={`${section.id}-items`} label="Points" hint={`One per line. ${FORMAT_HINT}`}>
              <Textarea id={`${section.id}-items`} rows={4} value={section.items.map((i) => i.text).join("\n")}
                onChange={(e) => {
                  const lines = e.target.value.split("\n").slice(0, RESUME_LIMITS.items);
                  set({ items: lines.map((text, i) => ({ id: section.items[i]?.id ?? newId("i"), text, visible: section.items[i]?.visible ?? true })) });
                }} />
            </Field>
          )}

          {section.type === "entries" && (
            <EntriesEditor section={section} path={path} errors={errors} onChange={(entries) => set({ entries })} />
          )}

          {section.type === "skills" && (
            <SkillsEditor section={section} path={path} errors={errors} onChange={(groups) => set({ groups })} />
          )}
        </>
      )}
    </Card>
  );
}

function EntriesEditor({ section, path, errors, onChange }: {
  section: EditableSection; path: string; errors: Record<string, string>; onChange: (entries: EditableEntry[]) => void;
}) {
  const entries = section.entries;
  const update = (i: number, patch: Partial<EditableEntry>) => onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <div className="flex flex-col gap-3">
      {entries.map((entry, i) => {
        const id = `${section.id}-${entry.id}`;
        const err = (field: string) => errors[`${path}.entries[${i}].${field}`];
        return (
          <div key={entry.id} className={`flex flex-col gap-3 rounded-sm border border-border p-3 ${entry.visible ? "" : "opacity-75"}`}>
            <ItemToolbar
              label={entry.title || entry.subtitle || `Entry ${i + 1}`}
              visible={entry.visible}
              first={i === 0}
              last={i === entries.length - 1}
              onToggle={() => update(i, { visible: !entry.visible })}
              onMove={(by) => onChange(move(entries, i, by))}
              onRemove={() => onChange(entries.filter((_, j) => j !== i))}
            />
            <div className="grid gap-3 @lg:grid-cols-2">
              <Field htmlFor={`${id}-title`} label="Title" required hint="Job title, degree, project…" error={err("title")}>
                <TextField id={`${id}-title`} value={entry.title} maxLength={150}
                  onChange={(e) => update(i, { title: e.target.value })} aria-invalid={!!err("title")} />
              </Field>
              <Field htmlFor={`${id}-subtitle`} label="Subtitle" hint="Company, school, issuer…">
                <TextField id={`${id}-subtitle`} value={entry.subtitle ?? ""} maxLength={150}
                  onChange={(e) => update(i, { subtitle: e.target.value })} />
              </Field>
              <Field htmlFor={`${id}-start`} label="Start" hint="e.g. Jan 2022">
                <TextField id={`${id}-start`} value={entry.startDate ?? ""} maxLength={30}
                  onChange={(e) => update(i, { startDate: e.target.value })} />
              </Field>
              <Field htmlFor={`${id}-end`} label="End">
                <TextField id={`${id}-end`} value={entry.current ? "" : entry.endDate ?? ""} maxLength={30}
                  disabled={entry.current} placeholder={entry.current ? "Present" : undefined}
                  onChange={(e) => update(i, { endDate: e.target.value })} />
              </Field>
              <Checkbox id={`${id}-current`} className="@lg:col-span-2" checked={entry.current}
                onCheckedChange={(checked) => update(i, { current: checked === true })} label="Ongoing (shows “Present”)" />
              <Field htmlFor={`${id}-location`} label="Location">
                <TextField id={`${id}-location`} value={entry.location ?? ""} maxLength={100}
                  onChange={(e) => update(i, { location: e.target.value })} />
              </Field>
              <Field htmlFor={`${id}-url`} label="Link" error={err("url")}>
                <TextField id={`${id}-url`} value={entry.url ?? ""} maxLength={500} inputMode="url"
                  onChange={(e) => update(i, { url: e.target.value })} aria-invalid={!!err("url")} />
              </Field>
              <Field htmlFor={`${id}-description`} label="Description" className="@lg:col-span-2" hint={FORMAT_HINT}
                error={err("description")}>
                <Textarea id={`${id}-description`} rows={2} className="min-h-16" value={entry.description ?? ""} maxLength={1500}
                  onChange={(e) => update(i, { description: e.target.value })} />
              </Field>
              <Field htmlFor={`${id}-bullets`} label="Bullet points" className="@lg:col-span-2"
                hint={`One per line. Start with a verb; add numbers where you can. ${FORMAT_HINT}`} error={err("bullets")}>
                <Textarea id={`${id}-bullets`} rows={4} value={entry.bullets.join("\n")}
                  onChange={(e) => update(i, { bullets: e.target.value.split("\n").slice(0, RESUME_LIMITS.bullets) })} />
              </Field>
            </div>
          </div>
        );
      })}
      <Button className="self-start" size="compact" disabled={entries.length >= RESUME_LIMITS.entries}
        onClick={() => onChange([...entries, emptyEntry()])}>
        <Plus /> Add entry
      </Button>
    </div>
  );
}

function SkillsEditor({ section, path, errors, onChange }: {
  section: EditableSection; path: string; errors: Record<string, string>; onChange: (groups: EditableGroup[]) => void;
}) {
  const groups = section.groups;
  const update = (i: number, patch: Partial<EditableGroup>) => onChange(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, i) => {
        const id = `${section.id}-${group.id}`;
        return (
          <div key={group.id} className={`flex flex-col gap-2 rounded-sm border border-border p-3 ${group.visible ? "" : "opacity-75"}`}>
            <ItemToolbar
              label={group.name || `Group ${i + 1}`}
              visible={group.visible}
              first={i === 0}
              last={i === groups.length - 1}
              onToggle={() => update(i, { visible: !group.visible })}
              onMove={(by) => onChange(move(groups, i, by))}
              onRemove={() => onChange(groups.filter((_, j) => j !== i))}
            />
            <div className="grid gap-3 @lg:grid-cols-[1fr_2fr]">
              <Field htmlFor={`${id}-name`} label="Group name" hint="Optional, e.g. Languages">
                <TextField id={`${id}-name`} value={group.name} maxLength={60} onChange={(e) => update(i, { name: e.target.value })} />
              </Field>
              <Field htmlFor={`${id}-keywords`} label="Skills" hint="Separate with commas" error={errors[`${path}.groups[${i}].keywords`]}>
                <TextField id={`${id}-keywords`} value={group.keywords.join(", ")}
                  onChange={(e) => update(i, { keywords: e.target.value.split(/,\s?/).slice(0, 50) })} />
              </Field>
            </div>
          </div>
        );
      })}
      <Button className="self-start" size="compact" disabled={groups.length >= RESUME_LIMITS.groups}
        onClick={() => onChange([...groups, emptyGroup()])}>
        <Plus /> Add group
      </Button>
    </div>
  );
}

function ItemToolbar({ label, visible, first, last, onToggle, onMove, onRemove }: {
  label: string; visible: boolean; first: boolean; last: boolean;
  onToggle: () => void; onMove: (by: -1 | 1) => void; onRemove: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <p className="min-w-0 truncate text-sm font-medium">
        {label}
        {!visible && <span className="ml-2 text-xs font-normal text-subtlest">(hidden)</span>}
      </p>
      <div className="flex shrink-0 items-center">
        <Button variant="subtle" size="icon-compact" aria-label={visible ? `Hide ${label}` : `Show ${label}`}
          aria-pressed={!visible} onClick={onToggle}>
          {visible ? <Eye /> : <EyeOff />}
        </Button>
        <Button variant="subtle" size="icon-compact" aria-label="Move up" disabled={first} onClick={() => onMove(-1)}>
          <ArrowUp />
        </Button>
        <Button variant="subtle" size="icon-compact" aria-label="Move down" disabled={last} onClick={() => onMove(1)}>
          <ArrowDown />
        </Button>
        <Button variant="subtle" size="icon-compact" aria-label={`Remove ${label}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
    </div>
  );
}

function move<T>(items: T[], index: number, by: -1 | 1): T[] {
  const next = [...items];
  const target = index + by;
  if (target < 0 || target >= next.length) return items;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
