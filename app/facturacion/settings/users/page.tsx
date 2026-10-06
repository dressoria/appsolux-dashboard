import SettingsPage from "@/app/settings/page";

export default function FacturacionSettingsUsersPage() {
  return <SettingsPage searchParams={Promise.resolve({ section: "users" })} />;
}
