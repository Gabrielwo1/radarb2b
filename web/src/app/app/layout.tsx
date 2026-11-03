import { ModalAcesso } from "@/components/auth/ModalAcesso";
import { ModalPlanos } from "@/components/planos/Planos";

// O pop-up de login (e o cliente do Supabase) fica só nas páginas do app; a landing não carrega.
// A janela de planos abre quando uma ação passa do limite grátis.
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ModalAcesso />
      <ModalPlanos />
    </>
  );
}
