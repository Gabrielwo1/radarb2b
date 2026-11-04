"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { META_PIXEL_ID, rastrear } from "@/lib/pixel";

// Meta Pixel: visita de página a cada troca de rota e "Contact" em qualquer link de WhatsApp.
// O cadastro (CompleteRegistration) é disparado no formulário de criar conta.
export function MetaPixel() {
  const pathname = usePathname();
  const primeira = useRef(true);

  // A primeira visita sai do script de init; aqui só as navegações dentro do site
  useEffect(() => {
    if (primeira.current) { primeira.current = false; return; }
    rastrear("PageView");
  }, [pathname]);

  useEffect(() => {
    const aoClicar = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (link && /(^|\/\/)(wa\.me|api\.whatsapp\.com)\//.test(link.href)) rastrear("Contact", { content_name: "WhatsApp" });
    };
    document.addEventListener("click", aoClicar, true);
    return () => document.removeEventListener("click", aoClicar, true);
  }, []);

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${META_PIXEL_ID}');fbq('track','PageView');`}
    </Script>
  );
}
