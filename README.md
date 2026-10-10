# Microregno

Gestionale fantasy 2D nel browser: costruisci un regno, gestisci risorse e popolazione, affronta una sfida diversa ogni giorno.

## Funzionalità
- Mappa a griglia con proiezione isometrica leggera e terreno generato proceduralmente.
- Sprite SVG originali per municipio, case, fattoria, segheria, cava, mercato, alberi e rocce.
- Economia, popolazione, costi, vincoli del terreno e sblocco del mercato.
- Salvataggio locale, progressione offline limitata, regno persistente e sfida giornaliera.
- Obiettivi, record locali, demolizione con rimborso parziale e interfaccia responsive.

## Requisiti e avvio
Serve Node.js 20+ e npm.

~~~bash
npm install
npm run dev
~~~

Per verificare e compilare: **npm run typecheck**, **npm test**, **npm run build**. La cartella **dist/** contiene il sito statico pubblicabile su GitHub Pages, Netlify, Cloudflare Pages o altro hosting statico.

### Pubblicare su GitHub Pages

1. Apri **Settings → Pages** nel repository e scegli **GitHub Actions** come sorgente di pubblicazione.
2. Apri **Actions → Deploy Microregno → Run workflow** e avvia il workflow sul branch `main`.
3. Quando il job termina correttamente, GitHub mostra l'URL pubblico nella pagina del workflow e in **Settings → Pages**.

Il workflow di deploy è manuale per evitare tentativi di pubblicazione prima di aver configurato Pages. Il workflow CI continua invece a verificare test e build a ogni push/PR.

## Struttura
- **src/game/engine.ts**: costruzioni, produzione, popolazione e terreno.
- **src/game/KingdomScene.ts**: rendering e input Phaser.
- **src/game/challenge.ts**: sfide giornaliere.
- **src/game/save.ts**: salvataggi e progressione offline.
- **src/ui.ts** e **src/style.css**: interfaccia e layout.
- **public/assets/**: sprite SVG originali.

## Limiti
I salvataggi e i record sono locali. Account, sincronizzazione, classifiche online e anti-cheat richiedono un backend e non sono inclusi in questa base. La licenza open source non è ancora stata scelta.