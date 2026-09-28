import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Check,
  ChefHat,
  ChevronRight,
  CircleAlert,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Snack = {
  id: number;
  name: string;
  price: number;
  color: string;
  weight: string | null;
  image_url: string | null;
  description: string;
  icon: string | null;
  is_published: boolean;
  sort_order: number;
};

type Settings = {
  announcement: string;
  hero_title: string;
  hero_subtitle: string;
  about_title: string;
  about_body: string;
};

type SnackForm = Omit<Snack, "id">;

const blankSnack: SnackForm = {
  name: "",
  price: 50,
  color: "classic",
  weight: "",
  image_url: "",
  description: "",
  icon: "",
  is_published: true,
  sort_order: 0,
};

const defaultSettings: Settings = {
  announcement: "Made in Sri Lanka · Shared everywhere",
  hero_title: "A little joy, packed fresh.",
  hero_subtitle: "Familiar flavours and satisfying crunch for tea breaks, school bags, and every in-between moment.",
  about_title: "Good ingredients. Good company.",
  about_body: "We make snacks with care in Sri Lanka, bringing quality and warmth to the everyday.",
};

export default function AdminPanel() {
  const { user, loading, logout } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginPending, setLoginPending] = useState(false);
  const [section, setSection] = useState<"catalog" | "site">("catalog");
  const [search, setSearch] = useState("");
  const [snacks, setSnacks] = useState<Snack[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [editor, setEditor] = useState<Snack | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<SnackForm>(blankSnack);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isOwner = user?.role === "owner";

  async function loadData() {
    const [{ data: snackData, error: snackError }, { data: settingsData, error: settingsError }] = await Promise.all([
      supabase.from("snacks").select("*").order("sort_order", { ascending: true }),
      supabase.from("site_settings").select("*").eq("id", 1).single(),
    ]);
    if (snackError) throw snackError;
    if (settingsError) throw settingsError;
    setSnacks((snackData ?? []) as Snack[]);
    setSettings((settingsData ?? defaultSettings) as Settings);
  }

  useEffect(() => {
    if (isOwner) void loadData().catch(error => toast.error(error instanceof Error ? error.message : "Could not load studio data"));
  }, [isOwner]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setLoginPending(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoginPending(false);
    if (error) toast.error(error.message);
  }

  async function saveSnack() {
    setBusy(true);
    const payload = {
      name: form.name.trim(),
      price: Number(form.price),
      color: form.color.trim(),
      weight: form.weight || null,
      image_url: form.image_url || null,
      description: form.description.trim(),
      icon: form.icon || null,
      is_published: form.is_published,
      sort_order: Number(form.sort_order),
      updated_at: new Date().toISOString(),
    };
    const result = editor
      ? await supabase.from("snacks").update(payload).eq("id", editor.id)
      : await supabase.from("snacks").insert(payload);
    setBusy(false);
    if (result.error) {
      toast.error(result.error.message);
      return;
    }
    toast.success("Catalog saved");
    setEditor(null);
    setIsCreating(false);
    setForm(blankSnack);
    await loadData();
  }

  async function deleteSnack(snack: Snack) {
    if (!window.confirm(`Remove ${snack.name} from the catalog?`)) return;
    const { error } = await supabase.from("snacks").delete().eq("id", snack.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Snack removed");
      await loadData();
    }
  }

  async function toggleSnack(snack: Snack) {
    const { error } = await supabase.from("snacks").update({
      is_published: !snack.is_published,
      updated_at: new Date().toISOString(),
    }).eq("id", snack.id);
    if (error) toast.error(error.message);
    else await loadData();
  }

  async function uploadImage(file: File) {
    setUploading(true);
    const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
    const { error } = await supabase.storage.from("product-images").upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) {
      setUploading(false);
      toast.error(error.message);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setForm(current => ({ ...current, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Image uploaded");
  }

  async function saveSettings() {
    setBusy(true);
    const { error } = await supabase.from("site_settings").update(settings).eq("id", 1);
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Site content saved");
  }

  const filteredSnacks = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term ? snacks.filter(snack => `${snack.name} ${snack.color} ${snack.price}`.toLowerCase().includes(term)) : snacks;
  }, [search, snacks]);

  if (loading) return <LoadingScreen />;
  if (!user) {
    return (
      <div className="access-screen">
        <form className="access-card" onSubmit={signIn}>
          <div className="studio-mark large"><ChefHat size={26} /></div>
          <span className="eyebrow">Kanta Studio</span>
          <h1>Owner sign in</h1>
          <p>Use the Supabase owner account to manage the public catalog.</p>
          <label className="form-label">Email<input type="email" value={email} onChange={event => setEmail(event.target.value)} required /></label>
          <label className="form-label">Password<input type="password" value={password} onChange={event => setPassword(event.target.value)} required /></label>
          <Button type="submit" disabled={loginPending}>{loginPending ? "Signing in…" : "Sign in"}</Button>
          <a href="/">Return to public site</a>
        </form>
      </div>
    );
  }
  if (!isOwner) return <AccessScreen title="This space is private" message="This account is signed in but does not have owner access." action="Sign out" onAction={() => void logout()} />;

  return (
    <div className="studio-shell">
      <aside className="studio-sidebar">
        <div className="studio-brand"><div className="studio-mark"><ChefHat size={18} /></div><div><strong>Kanta</strong><span>Studio</span></div></div>
        <div className="studio-owner-card"><span className="eyebrow">Owner workspace</span><strong>{user.name || "Kanta owner"}</strong><span>{user.email}</span></div>
        <nav className="studio-nav">
          <button className={section === "catalog" ? "active" : ""} onClick={() => setSection("catalog")}><PackagePlus size={17} /> Catalog <ChevronRight size={15} /></button>
          <button className={section === "site" ? "active" : ""} onClick={() => setSection("site")}><Settings2 size={17} /> Site content <ChevronRight size={15} /></button>
        </nav>
        <div className="studio-sidebar-bottom"><a href="/" target="_blank" rel="noreferrer"><ArrowUpRight size={16} /> View public site</a><button onClick={() => void logout()}><LogOut size={16} /> Sign out</button></div>
      </aside>
      <main className="studio-main">
        <header className="studio-topbar"><div><span className="eyebrow">Kanta Studio / {section === "catalog" ? "Catalog" : "Site content"}</span><h1>{section === "catalog" ? "The snack shelf" : "Shape the storefront"}</h1></div><span className="status-pill"><span /> Live changes</span></header>
        {section === "catalog" ? (
          <>
            <div className="stats-grid"><Stat label="Total snacks" value={snacks.length} note="Across every price point" icon={<LayoutDashboard size={18} />} /><Stat label="Published" value={snacks.filter(snack => snack.is_published).length} note="Visible on the public site" icon={<Check size={18} />} accent /><Stat label="With imagery" value={snacks.filter(snack => snack.image_url).length} note="Ready for the shelf" icon={<ImagePlus size={18} />} /></div>
            <div className="section-toolbar"><div className="search-field"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search snacks, colours, prices" /></div><Button className="add-button" onClick={() => { setForm(blankSnack); setEditor(null); setIsCreating(true); }}><Plus size={17} /> Add snack</Button></div>
            <div className="catalog-heading"><div><span className="eyebrow">Editable catalog</span><h2>{search ? `${filteredSnacks.length} matching snacks` : "Everyday favourites"}</h2></div></div>
            <div className="snack-grid">{filteredSnacks.map(snack => <article className={`snack-admin-card ${!snack.is_published ? "is-hidden" : ""}`} key={snack.id}><div className="snack-card-image">{snack.image_url ? <img src={snack.image_url} alt="" /> : <div className="image-placeholder"><ImagePlus size={22} /><span>Needs image</span></div>}<span className={`visibility-badge ${snack.is_published ? "published" : "draft"}`}>{snack.is_published ? "Live" : "Hidden"}</span></div><div className="snack-card-content"><div className="snack-card-title"><div><span className="snack-color">{snack.color}</span><h3>{snack.name}</h3></div><strong>Rs. {snack.price}</strong></div><p>{snack.description}</p><div className="snack-card-footer"><label className="publish-toggle"><Switch checked={snack.is_published} onCheckedChange={() => void toggleSnack(snack)} /><span>{snack.is_published ? "Published" : "Hidden"}</span></label><div className="card-actions"><button onClick={() => { setForm({ ...snack, weight: snack.weight ?? "", image_url: snack.image_url ?? "", icon: snack.icon ?? "" }); setEditor(snack); setIsCreating(false); }}><Pencil size={15} /></button><button onClick={() => void deleteSnack(snack)}><Trash2 size={15} /></button></div></div></div></article>)}</div>
          </>
        ) : <SiteContentSection settings={settings} setSettings={setSettings} saving={busy} onSave={() => void saveSettings()} />}
        {(isCreating || editor) && <SnackEditor form={form} setForm={setForm} isCreating={isCreating} uploading={uploading} fileInputRef={fileInputRef} onClose={() => { setEditor(null); setIsCreating(false); }} onUpload={file => void uploadImage(file)} onSave={() => void saveSnack()} saving={busy} />}
      </main>
    </div>
  );
}

function SnackEditor({ form, setForm, isCreating, uploading, fileInputRef, onClose, onUpload, onSave, saving }: { form: SnackForm; setForm: React.Dispatch<React.SetStateAction<SnackForm>>; isCreating: boolean; uploading: boolean; fileInputRef: React.RefObject<HTMLInputElement | null>; onClose: () => void; onUpload: (file: File) => void; onSave: () => void; saving: boolean; }) {
  const update = (field: keyof SnackForm, value: string | number | boolean) => setForm(current => ({ ...current, [field]: value }));
  return <div className="editor-drawer"><div className="drawer-header"><div><span className="eyebrow">{isCreating ? "New catalog item" : "Edit catalog item"}</span><h2>{isCreating ? "Add a snack" : form.name}</h2></div><button className="drawer-close" onClick={onClose}><X /></button></div><div className="drawer-body"><div className="image-upload-box"><div className="editor-preview">{form.image_url ? <img src={form.image_url} alt="Snack preview" /> : <ImagePlus size={30} />}</div><div><strong>Product image</strong><p>JPG, PNG, WEBP or GIF</p><input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={event => { const file = event.target.files?.[0]; if (file) onUpload(file); }} /><Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>{uploading ? "Uploading…" : <><Upload size={15} /> Upload image</>}</Button></div></div><div className="form-grid"><Field label="Snack name" value={form.name} onChange={value => update("name", value)} /><Field label="Price (Rs.)" type="number" value={form.price} onChange={value => update("price", Number(value))} /><Field label="Colour / variant" value={form.color} onChange={value => update("color", value)} /><Field label="Weight" value={form.weight ?? ""} onChange={value => update("weight", value)} /><Field label="Display order" type="number" value={form.sort_order} onChange={value => update("sort_order", Number(value))} /></div><label className="form-label">Description<textarea value={form.description} onChange={event => update("description", event.target.value)} rows={5} /></label><label className="editor-publish"><Switch checked={form.is_published} onCheckedChange={checked => update("is_published", checked)} /><span><strong>Publish to public site</strong><small>Hidden snacks stay in your studio.</small></span></label></div><div className="drawer-footer"><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={onSave} disabled={saving || !form.name.trim() || !form.description.trim()}>{saving ? "Saving…" : <><Check size={16} /> Save snack</>}</Button></div></div>;
}

function SiteContentSection({ settings, setSettings, saving, onSave }: { settings: Settings; setSettings: React.Dispatch<React.SetStateAction<Settings>>; saving: boolean; onSave: () => void; }) {
  const update = (field: keyof Settings, value: string) => setSettings(current => ({ ...current, [field]: value }));
  return <div className="content-editor"><div className="content-editor-intro"><div><span className="eyebrow">Public copy</span><h2>Keep the storefront feeling fresh.</h2></div><Button onClick={onSave} disabled={saving}><Check size={16} /> {saving ? "Saving…" : "Save changes"}</Button></div><div className="settings-form"><Field label="Announcement bar" value={settings.announcement} onChange={value => update("announcement", value)} /><Field label="Hero title" value={settings.hero_title} onChange={value => update("hero_title", value)} /><label className="form-label">Hero subtitle<textarea value={settings.hero_subtitle} onChange={event => update("hero_subtitle", event.target.value)} rows={4} /></label><Field label="Story title" value={settings.about_title} onChange={value => update("about_title", value)} /><label className="form-label">Story body<textarea value={settings.about_body} onChange={event => update("about_body", event.target.value)} rows={5} /></label></div></div>;
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string | number; onChange: (value: string) => void; type?: string }) {
  return <label className="form-label">{label}<input type={type} value={value} onChange={event => onChange(event.target.value)} /></label>;
}

function Stat({ label, value, note, icon, accent = false }: { label: string; value: number; note: string; icon: React.ReactNode; accent?: boolean }) {
  return <div className={`stat-card ${accent ? "accent" : ""}`}><div className="stat-icon">{icon}</div><span>{label}</span><strong>{value}</strong><small>{note}</small></div>;
}

function AccessScreen({ title, message, action, onAction }: { title: string; message: string; action: string; onAction: () => void }) {
  return <div className="access-screen"><div className="access-card"><div className="studio-mark large"><ChefHat size={26} /></div><span className="eyebrow">Kanta Studio</span><h1>{title}</h1><p>{message}</p><Button onClick={onAction}>{action}</Button><a href="/">Return to public site</a></div></div>;
}

function LoadingScreen() {
  return <div className="access-screen"><div className="loading-orb" /><p>Opening Kanta Studio…</p></div>;
}
