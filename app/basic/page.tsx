import { redirect } from "next/navigation";

import { routes } from "@/config/routes";

export default function BasicRedirectPage() {
  redirect(routes.facturacion);
}
