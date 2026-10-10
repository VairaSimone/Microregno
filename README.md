# Microregno

Gestionale fantasy 2D nel browser: costruisci un regno, gestisci risorse e popolazione, affronta una sfida diversa ogni giorno.

## Funzionalità
- Mappa a griglia con proiezione isometrica leggera e terreno generato proceduralmente.
- Sprite SVG originali per municipio, case, fattoria, segheria, cava, mercato, alberi e rocce.
- Economia, popolazione, costi, vincoli del terreno, bonus ambientali e sblocco del mercato.
- Edifici migliorabili fino al livello 3: aumentano produzione o capienza e richiedono investimenti di risorse.
- Salvataggio locale, progressione offline limitata, regno persistente e sfida giornaliera.
- Obiettivi, record locali, demolizione con rimborso parziale e interfaccia responsive.

## Come si gioca

Il primo obiettivo è portare il borgo a **8 abitanti**. La guida in gioco segue cinque passaggi:
1. Costruisci una fattoria per produrre cibo.
2. Costruisci una casa: aggiunge 6 posti abitativi.
3. Mantieni almeno 18 unità di cibo e attendi che il villaggio raggiunga 6 abitanti.
4. Costruisci una segheria vicino a un bosco per generare legname.
5. Raggiungi 8 abitanti: a quel punto si sblocca il mercato.

**Regole essenziali**
- Seleziona un edificio nel pannello a destra, poi clicca una casella libera sulla mappa.
- Verde = posizione valida; rosso = posizione non valida.
- La segheria richiede un bosco vicino; la cava richiede roccia vicina.
- Segheria e cava si sbloccano a 6 abitanti; il mercato a 8.
- Il municipio ospita i 5 abitanti iniziali; costruisci una casa o migliora il municipio per aumentare la capienza.
- La popolazione cresce ogni 20 minuti di gioco se ci sono almeno 18 unità di cibo e posti abitativi liberi.
- Fattorie vicine all'acqua e segherie vicine ai boschi producono di più; le statistiche mostrano i bonus reali.
- Gli edifici si possono migliorare fino al livello 3 dal pannello Dettagli.
- Il regno principale è persistente. La sfida giornaliera è opzionale e ha un salvataggio separato.

La grafica degli edifici è inclusa localmente come SVG con dimensioni esplicite; non dipende da immagini caricate da siti terzi.

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