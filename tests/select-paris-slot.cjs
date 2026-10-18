// EVOL-TEST-004 lot B — un seul contrôle à 05:00 Europe/Paris.
// Usage : node tests/select-paris-slot.cjs [event] [cron] [UTC-ISO]
// Retour 0 si exécution, 2 si créneau à ignorer.
'use strict';
const event=process.argv[2]||process.env.GITHUB_EVENT_NAME||'workflow_dispatch';
const slot=process.argv[3]||process.env.S3E_SCHEDULE_CRON||'';
const date=new Date(process.argv[4]||Date.now());
const valid={ '0 3 * * *':3, '0 4 * * *':4 };
function parisHourAtSlot(date,utcHour){
 const base=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate(),utcHour));
 return new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Paris',hour:'2-digit',hourCycle:'h23'}).format(base);
}
if(!Number.isFinite(date.getTime()))throw Error('Date UTC incorrecte');
if(event!=='schedule'){console.log('Exécution directe autorisée : '+event);process.exit(0);}
if(!Object.prototype.hasOwnProperty.call(valid,slot))throw Error('Créneau cron inconnu : '+slot);
const parisHour=parisHourAtSlot(date,valid[slot]);
if(parisHour==='05'){
 console.log('Créneau sélectionné pour 05:00 Europe/Paris : '+slot);
 process.exit(0);
}
console.log('Créneau écarté car il correspond à '+parisHour+':00 Paris : '+slot);
process.exit(2);
