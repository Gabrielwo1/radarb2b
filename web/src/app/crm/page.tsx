import type { Metadata } from "next";
import { Crm } from "@/components/crm/Crm";

export const metadata: Metadata = { title: "Radar B2B — CRM" };

export default function Page() {
  return <Crm />;
}
