import { connection } from "next/server";
import { saveAccountAction } from "@/lib/actions";

export const instant = false;
export const metadata = { title: "New office" };

export default async function NewAccountPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const { notice } = await searchParams;
  return (
    <div className="mx-auto max-w-xl px-4 py-5">
      <h1 className="mb-4 text-2xl font-semibold">Add an office</h1>
      {notice ? <p className="mb-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <AccountForm action={saveAccountAction} />
    </div>
  );
}

export function AccountForm({
  action,
  account,
}: {
  action: (formData: FormData) => void | Promise<void>;
  account?: {
    id: string;
    name: string;
    officeType: string;
    specialty: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    phone: string | null;
    email: string | null;
    website: string | null;
    officeHours: string | null;
    generalNotes: string | null;
    providerCount: number;
    latitude: number | null;
    longitude: number | null;
  };
}) {
  return (
    <form action={action} className="grid gap-3">
      {account ? <input type="hidden" name="id" value={account.id} /> : null}
      <Field name="name" label="Office name" defaultValue={account?.name} required />
      <Field name="officeType" label="Office type" defaultValue={account?.officeType ?? "Clinic"} />
      <Field name="specialty" label="Specialty" defaultValue={account?.specialty} required />
      <Field name="street" label="Street" defaultValue={account?.street} required />
      <div className="grid grid-cols-3 gap-2">
        <Field name="city" label="City" defaultValue={account?.city} required />
        <Field name="state" label="State" defaultValue={account?.state} required />
        <Field name="zip" label="ZIP" defaultValue={account?.zip} required />
      </div>
      <Field name="phone" label="Phone" defaultValue={account?.phone ?? ""} />
      <Field name="email" label="Email" defaultValue={account?.email ?? ""} />
      <Field name="website" label="Website" defaultValue={account?.website ?? ""} />
      <Field name="officeHours" label="Office hours" defaultValue={account?.officeHours ?? ""} />
      <Field name="providerCount" label="Providers" type="number" defaultValue={String(account?.providerCount ?? 1)} />
      <div className="grid grid-cols-2 gap-2">
        <Field name="latitude" label="Latitude" defaultValue={account?.latitude?.toString() ?? ""} />
        <Field name="longitude" label="Longitude" defaultValue={account?.longitude?.toString() ?? ""} />
      </div>
      <label className="text-sm">
        Office notes
        <textarea name="generalNotes" defaultValue={account?.generalNotes ?? ""} className="mt-1 w-full rounded-xl border border-slate-200 p-3" rows={3} placeholder="No patient information." />
      </label>
      <p className="text-xs text-[#66758B]">Leave latitude and longitude blank to geocode the address when a server Google Maps key is set. Without that key, type the coordinates yourself. A blank result is not filled with a guess.</p>
      <button className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="submit">Save office</button>
    </form>
  );
}

function Field({ name, label, defaultValue, required, type = "text" }: { name: string; label: string; defaultValue?: string; required?: boolean; type?: string }) {
  return (
    <label className="text-sm">
      {label}
      <input name={name} defaultValue={defaultValue} required={required} type={type} className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3" />
    </label>
  );
}
