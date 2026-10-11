# Microregno

Gestionale fantasy 2D nel browser: costruisci un regno, gestisci risorse e popolazione, affronta una sfida diversa ogni giorno.

## Funzionalità
- Mappa a griglia con proiezione isometrica leggera e terreno generato proceduralmente.
- Sprite SVG originali per municipio, case, fattoria, segheria, cava, mercato, sei nuovi edifici civici e produttivi, strade, alberi e rocce.
- Economia, popolazione, costi, vincoli del terreno, bonus ambientali e sblocco del mercato.
- Edifici migliorabili fino al livello 3: aumentano produzione o capienza e richiedono investimenti di risorse.
- Campagna in quattro epoche (Insediamento, Villaggio, Borgo e Città): sblocchi persistenti, requisiti diversi, ricompense e cronaca della crescita.
- Carta della Corona come obiettivo finale: popolazione, edifici di livello 3, grandi opere, regioni esplorate, accordi diplomatici e Università Reale.
- Università Reale sbloccata nella Città: aumenta la velocità di avanzamento della ricerca.
- Traguardi di popolazione a 8, 12, 18 e 24 abitanti con ricompense una tantum in monete; gli obiettivi si aggiornano secondo l’epoca.
- Piccoli abitanti animati percorrono il centro del villaggio e gli edifici migliorati mostrano il loro livello sulla mappa.
- Salvataggio locale, progressione offline limitata, regno persistente e sfida giornaliera.
- Richieste dei cittadini con scelte a tempo, conseguenze su umore e fiducia, cronaca persistente e scadenze.
- Quattro stagioni con effetti reali su raccolti, consumo di cibo, produzione e colore del territorio.
- Cittadini persistenti con nomi, tratti, bisogni, salute, energia, umore, competenze e mestieri assegnabili.
- Filiere produttive: grano, farina, pane, strumenti e rimedi; mulino, panificio, officina e magazzino.
- Mercato dinamico con prezzi aggiornati ogni 120 minuti di gioco, domanda variabile e vendita di beni lavorati in presenza di un mercante.
- Rete stradale costruibile: gli edifici produttivi adiacenti a una strada lavorano con efficienza maggiore; le strade non richiedono miglioramenti di livello. Pane, farina, grano e rimedi deperiscono nel tempo; i magazzini riducono gli sprechi e aumentano la capienza.
- Sala del Regno con leggi economiche, gestione delle dispense, politiche forestali e pattuglie.
- Ricerca in sei percorsi, spedizioni esplorative, nuove regioni, reperti, rischi e ricompense.
- Diplomazia con tre comunità vicine, accordi permanenti e rotte commerciali.
- Quattro grandi progetti a tre fasi e avvenimenti concatenati con conseguenze su risorse e comunità.
- Mappa della frontiera con regioni scoperte, spedizioni possibili e territori ancora coperti dalla nebbia; eventi climatici temporanei, inclusa la siccità che rallenta i raccolti e avvia storie di recupero.
- Obiettivi, record locali, demolizione con rimborso parziale e interfaccia responsive.

## Come si gioca

Il primo obiettivo è portare il borgo a **8 abitanti**. La guida in gioco segue cinque passaggi:
1. Costruisci una fattoria per produrre cibo.
2. Costruisci una casa: aggiunge 6 posti abitativi.
3. Mantieni le dispense rifornite e raggiungi 8 abitanti: con Fattoria e Casa nascerà il Villaggio.
4. Nel Villaggio, costruisci una segheria vicino a un bosco e organizza le prime botteghe.
5. Apri il Mercato, migliora un edificio al livello 2 e porta il regno a 12 abitanti per fondare il Borgo.

**Regole essenziali**
- Seleziona un edificio nel pannello a destra, poi clicca una casella libera sulla mappa.
- Verde = posizione valida; rosso = posizione non valida.
- La segheria richiede un bosco vicino; la cava richiede roccia vicina.
- Il Villaggio si fonda a 8 abitanti se hai almeno una Fattoria e una Casa: sblocca Segheria, Cava, Mercato, Strade, Mulino e Magazzino.
- Il Borgo si fonda a 12 abitanti con un Mercato e un edificio migliorato: sblocca scuola, ricerca, spedizioni, diplomazia e grandi opere.
- La Città richiede 18 abitanti, una scuola, due ricerche, un progetto completato, due regioni scoperte e un edificio di livello 3; sblocca l’Università Reale.
- Per firmare la Carta della Corona servono 24 abitanti, due edifici al livello 3, tre grandi opere, due accordi diplomatici, tre regioni scoperte, un’Università Reale e 100 monete.
- Il municipio ospita i 5 abitanti iniziali; costruisci una casa o migliora il municipio per aumentare la capienza.
- La popolazione cresce ogni 20 minuti di gioco se ci sono almeno 18 unità di cibo e posti abitativi liberi.
- Fattorie vicine all'acqua e segherie vicine ai boschi producono di più; le statistiche mostrano i bonus reali.
- Gli edifici si possono migliorare fino al livello 3 dal pannello Dettagli; i miglioramenti costano anche monete, che diventano una risorsa da pianificare.
- Il regno principale è persistente. La sfida giornaliera è opzionale e ha un salvataggio separato.
- Ogni richiesta presenta tre risposte: pagare o scambiare risorse, aiutare la comunità o conservare le scorte. Le richieste scadono dopo 3 minuti reali; ignorarle abbassa umore e fiducia.
- Umore almeno 75: produzione +5%; umore fino a 25: produzione −10%; umore sotto 20: la popolazione non cresce. Fiducia almeno 75: gli abitanti generano il 20% di monete in più.
- Le stagioni cambiano ogni 360 minuti di gioco (circa 6 minuti reali). Inverno riduce la produzione agricola e aumenta del 50% il consumo di cibo; l'autunno aumenta la resa agricola del 35%.
- Accogliere un nuovo abitante richiede capienza libera; in alternativa, una richiesta può finanziare un piccolo alloggio che aggiunge due posti abitativi.
- La cronaca del borgo conserva le ultime sei conseguenze. Le richieste, i traguardi e lo stato della comunità sono inclusi nel salvataggio locale.

La grafica degli edifici è inclusa localmente come SVG con dimensioni esplicite; non dipende da immagini caricate da siti terzi.


### Sala del Regno e simulazione vivente

Apri **Sala del Regno** nella barra superiore per passare fra cinque sezioni:
- **Cittadini & Economia**: assegna mestieri, osserva fame, energia, felicità e salute, e gestisci le filiere grano → farina → pane. Le abilità crescono facendo il mestiere; il personale influisce sulla resa degli edifici. Le strade danno un bonus agli edifici produttivi adiacenti. Puoi vendere grano, farina, pane, attrezzi e rimedi se hai un mercato e un mercante assegnato; le quotazioni riflettono una domanda che cambia con il tempo e con le scorte.
- **Leggi**: tasse (basse, equilibrate o alte), dispense (riserva, equilibrio o generosità), gestione dei boschi e pattuglie. Le politiche modificano davvero i tassi economici e la sicurezza. Il taglio intensivo riduce la salute forestale; protezione e ricerca di silvicoltura favoriscono la rigenerazione. Le pattuglie richiedono 2 monete per ora di gioco.
- **Esplorazione**: assegna il mestiere Esploratore e invia spedizioni per ottenere scorte, attrezzi e punti conoscenza. Il successo dipende dalle competenze e dagli strumenti; le zone lontane richiedono cartografia o grandi opere.
- **Ricerca**: avvia una sola ricerca alla volta. I punti conoscenza arrivano lentamente e aumentano con la scuola e gli studiosi. Irrigazione, utensili, commercio, istruzione, cartografia e silvicoltura offrono benefici permanenti.
- **Progetti & Eventi**: finanzia tre fasi per acquedotto, ponte, quartiere artigiano e grande archivio. Gli eventi emergono durante la partita; alcune decisioni avviano una seconda storia dopo un intervallo.

Gli accordi diplomatici si gestiscono nella sezione Esplorazione dal Borgo in poi. Le epoche sono conservate nel salvataggio e i regni salvati prima dell’aggiornamento vengono migrati automaticamente. Il finale di campagna arriva con la Carta della Corona: dopo averla firmata puoi continuare a giocare in modalità libera. L’Università Reale, sbloccata nell’epoca della Città, accelera la ricerca.

Gli accordi diplomatici si gestiscono nella sezione Esplorazione. Doni e scambi aumentano le relazioni; a 55 punti può essere firmato un trattato, che genera entrate ricorrenti. Tutti i cittadini, scorte, progressi di ricerca, spedizioni, leggi, eventi, progetti e relazioni sono inclusi nel salvataggio locale. I salvataggi precedenti vengono migrati automaticamente alla prima apertura.

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
- **src/game/progression.ts**: epoche, requisiti, ricompense e Carta della Corona.
- **src/game/KingdomScene.ts**: rendering e input Phaser.
- **src/game/challenge.ts**: sfide giornaliere.
- **src/game/community.ts**: richieste dei cittadini, scelte, conseguenze e stagioni.
- **src/game/livingWorld.ts**: cittadini persistenti, filiere produttive, leggi, ricerche, spedizioni, diplomazia, progetti ed eventi concatenati.
- **src/game/save.ts**: salvataggi e progressione offline.
- **src/ui.ts** e **src/style.css**: interfaccia e layout.
- **public/assets/**: sprite SVG originali.

## Limiti
I salvataggi e i record sono locali. Le stagioni si alternano rapidamente per rendere visibili i cambiamenti in una sessione breve. I cittadini hanno bisogni, attività giornaliere e percorsi locali verso casa, lavoro o piazza, ma la navigazione è limitata alla mappa attuale: non sono ancora presenti una simulazione urbana completa, routine lavorative dettagliate per ogni edificio o un sistema di animazioni individuali avanzato.
 Account, sincronizzazione, classifiche online e anti-cheat richiedono un backend e non sono inclusi in questa base. La licenza open source non è ancora stata scelta.

## Economia delle scorte e commercio

- I beni lavorati condividono una capienza complessiva: 100 unità di base, più 80 per ogni livello di Magazzino. Il limite viene applicato anche quando si carica un vecchio salvataggio troppo pieno; pane, farina e grano in eccesso vengono rimossi prima dei rimedi e degli attrezzi.
- Le fattorie producono grano, i mulini lo trasformano in farina e i panifici in pane. Il pane viene consumato dagli abitanti come supplemento quando c’è cibo di base e diventa una razione di emergenza quando il cibo scarseggia.
- I rimedi sono usati automaticamente ogni 60 minuti di gioco per curare di 22 punti salute il residente più debilitato (solo se ha salute sotto 92); un rimedio viene consumato per trattamento.
- Gli attrezzi presenti in magazzino aumentano del 12% l’efficienza di fattorie, segherie, cave, mulini, panifici e officine. Con postazioni produttive attive, un attrezzo viene consumato per la manutenzione ogni 180 minuti di gioco; restano inoltre utilizzabili per le spedizioni.
- Un Mercato con un cittadino Mercante permette di vendere beni lavorati e comprare pacchetti da 5 unità di legname, pietra o cibo. Il prezzo d’acquisto dipende dalla disponibilità delle risorse nel regno e dalla domanda del mercato, così comprare per risolvere una carenza urgente ha un costo visibile.
