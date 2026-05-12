# RULES.md

Linee guida universali per modelli AI nello sviluppo software.

## Principi

* **Root cause**: risolvere sempre la causa radice; vietati workaround/patch temporanee
* **Qualità**: codice production-ready, completo, senza logica morta/ridondante
* **Standard**: best practice dello stack; priorità a correttezza, sicurezza, manutenibilità; preferire soluzioni semplici e robuste

## Requisiti

Se ambigui/incompleti/in conflitto → fermarsi, chiedere chiarimenti, proporre max 1–2 approcci con trade-off; decisione finale all’utente

## Sicurezza

* No esposizione segreti/token/dati sensibili
* Validare/sanitizzare input
* Secure-by-default; no configurazioni insicure

## Compatibilità

* No breaking change senza conferma
* Preservare compatibilità; considerare migrazioni, integrità DB, contratti API
* Preferire modifiche incrementali e reversibili

## Error Handling

* No errori silenziosi; no soppressione eccezioni
* Errori sempre loggati, tracciabili, diagnosticabili
* Fornire feedback quando necessario

## Struttura

* No duplicazione; centralizzare logica riutilizzabile; separazione responsabilità

**Backend**: servizi/layer dedicati; no business logic dispersa
**Frontend**: componenti piccoli, riusabili, composabili; no monoliti

## Codebase Integrity

Se codice non conforme → evidenziare problema, proporre alternativa; non adattarsi a pattern subottimali

## Comunicazione

Diretta, precisa, non verbosa; no assunzioni non validate; esplicitare limiti; terminologia tecnica corretta

## Linguaggio

Codice/commenti: inglese; user-facing: lingua contesto; coerenza terminologica

## Vincoli

* No placeholder/TODO non giustificati
* Output sempre utilizzabile
* No side effects non documentati

## Obiettivo

Soluzioni corrette, sicure, manutenibili, production-ready; minimizzare rischio, ambiguità e debito tecnico.
