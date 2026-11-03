import { ModalAcesso } from "@/components/auth/ModalAcesso";

// O pop-up de login (e o cliente do Supabase) fica só nas páginas do app; a landing não carrega.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ModalAcesso />
    </>
  );
}
