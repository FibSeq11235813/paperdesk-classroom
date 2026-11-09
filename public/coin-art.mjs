const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validCoinYear(value){const n=Number(value);if(!Number.isInteger(n)||n<0||n>9999||String(value).trim()==='')throw new Error('Choose a year from 0 to 9999.');return n;}
const portraits={
 franklin:'M36 87Q33 77 39 70L45 66Q40 63 42 57L38 53 42 50Q40 34 49 27Q59 20 68 27Q76 32 73 46L80 53 74 56 73 65Q69 70 62 69L60 76 76 87Z',
 kennedy:'M36 87 45 75 44 66Q36 65 36 59L29 56 34 50Q30 41 36 32Q45 22 62 26L72 32 75 45 72 59 66 69 68 78 80 87Z',
 anthony:'M33 88 42 77 45 69Q36 68 35 61L29 56 34 51Q33 38 43 32L47 27Q60 23 68 33L73 44 70 57 63 68 65 77 79 88Z',
 mercury:'M34 87 43 74 43 67Q36 66 35 59L29 56 35 51Q33 38 44 30L59 28 73 38 73 52 65 65 66 77 79 87Z'
};
function portrait(kind){
 const hair=kind==='franklin'?'<path d="M47 34Q34 38 34 55Q31 66 38 73M43 38Q36 53 40 65M67 34Q80 39 78 62L72 74M72 39Q78 53 72 65"/>':kind==='kennedy'?'<path d="M35 38 39 29 49 25 63 27 73 34 74 43 66 39 61 33 54 37 47 33 40 39Z"/><path d="m40 31 9-3m-4 6 13-5m-5 6 12-4m-3 6 8-2"/>':kind==='anthony'?'<path d="M45 33Q58 27 68 37L73 48M66 33Q80 27 83 38Q84 48 72 49M48 34 65 41M45 39 65 46M43 43 61 50"/><circle cx="75" cy="36" r="4"/>':'<path d="M42 34 56 25 72 38 69 50 54 40Z"/><path d="m57 29 8-13 3 13 7-9-2 15 9-6-8 15-6 3Z"/>';
 return `<path d="${portraits[kind]}" fill="url(#METAL)" stroke-width="1.1"/>${hair}<path d="M43 49q5-3 10 0m-10 0 5 1m-6 10 7 1m-7 4 7 1m8-19q7-2 7 5t-5 8M47 76l10 7 9-8m-27 9 29 1"/><path d="M46 68q6 4 13 0" stroke-width=".6"/>`;
}
function eagle(){return '<path d="M55 45 49 39 29 31 33 43 43 53 23 46 29 57 46 63 33 64 38 72 52 66 53 82 60 75 67 82 68 66 82 72 87 64 74 63 91 57 97 46 77 53 87 43 91 31 71 39 65 45 65 36 59 32 54 37Z" fill="url(#METAL)"/><path d="M52 53h16v16l-8 8-8-8Z"/><path d="M55 55v12m5-12v16m5-16v12M35 38l17 16m-21-6 19 10m35-20L68 54m21-6L70 58M48 80l-13 5m37-5 13 5"/><circle cx="59" cy="37" r=".8" fill="currentColor"/>';}
function bell(){return '<path d="M44 34h32v7H44Z M48 43h24q-3 17 9 30H39q12-13 9-30Z M36 74h48v6H36Z M58 80v6h6v-6" fill="url(#METAL)"/><path d="m60 43-4 10 6 8-5 7 5 7M43 67h34M47 49h26M42 70h36M49 32v-5h22v5"/><text x="60" y="56" text-anchor="middle" font-size="4">PASS AND STOW</text><path d="m84 53 3-6 3 6 6-1-5 5 2 6-6-3-5 3 2-6-5-5Z"/>';}
function motif(key,side){
 if(['franklin','kennedy','anthony','mercury'].includes(key)&&side==='Heads')return portrait(key);
 if(key==='franklin')return bell();
 if(key==='kennedy')return eagle();
 if(key==='anthony')return '<circle cx="81" cy="31" r="9"/><path d="M25 86Q60 72 96 87M33 88l8-3m25 0 10-2"/>'+eagle()+'<path d="m43 79-7 5m38-5 8 4"/>';
 if(key==='mercury')return '<path d="M51 31h18v53H51Z" fill="url(#METAL)"/><path d="M55 33v48m5-48v48m5-48v48M48 43h25M48 68h25M67 37q23 2 12 16H67Z M43 81Q28 57 43 39m-4 8-7-3m7 11-8-2m9 11-8 1m12 8-7 4"/>';
 if(side==='Tails')return '<text x="41" y="73" text-anchor="middle" font-size="46" font-family="Georgia" fill="currentColor">1</text><path d="M66 30 77 29 73 39 85 44 78 53 84 61 72 78 63 71 63 57 56 51Z" fill="url(#METAL)"/><text x="72" y="82" text-anchor="middle" font-size="8">EURO</text>';
 if(key==='euro-germany')return eagle();
 if(key==='euro-greece')return '<path d="M36 39q24-20 48 0l-4 40-20 8-20-8Z" fill="url(#METAL)"/><circle cx="49" cy="48" r="10"/><circle cx="71" cy="48" r="10"/><circle cx="49" cy="48" r="3" fill="currentColor"/><circle cx="71" cy="48" r="3" fill="currentColor"/><path d="m55 57 5 8 5-8M47 66l5 10m8-7v10m13-13-5 10M31 31l-5 37m3-24-7-5m6 13-7-2"/>';
 return '<path d="M35 32Q72 20 84 34L78 82H64Q46 76 35 32Z" fill="url(#METAL)"/><path d="M44 36q15 0 31-3L69 76Q54 68 44 36ZM49 39l13 32m-7-33 11 35m-5-36 9 37m-3-38 7 34M35 31l-3-5 10-3M70 82h13"/>';
}
export function coinArtwork(spec,side,year,uid){
 year=validCoinYear(year);const key=spec[4].heads.replace('-heads',''),euro=key.startsWith('euro-'),style=spec[2].split('-');
 const metal={silver:['#f7fafc','#b8c4ce','#5c6874'],gold:['#fff2b7','#d0aa55','#77541c'],copper:['#ffe1c2','#c78d64','#77462d']};
 const outer=metal[style[0]],inner=metal[style[1]||style[0]],id='engraving-'+String(uid).replace(/[^a-z0-9-]/gi,'');
 const header=euro?(key==='euro-germany'?'BUNDESREPUBLIK DEUTSCHLAND':key==='euro-greece'?'ΕΛΛΗΝΙΚΗ ΔΗΜΟΚΡΑΤΙΑ':'ÉIRE'):side==='Heads'?'LIBERTY':'UNITED STATES OF AMERICA';
 const lower=euro?(side==='Heads'?String(year):'ONE EURO'):side==='Heads'?String(year):spec[0]==='50¢'?'HALF DOLLAR':spec[0]==='$1'?'ONE DOLLAR':'ONE DIME';
 const art=motif(key,side).replaceAll('#METAL','#'+id+'-metal');
 return `<svg viewBox="0 0 120 120" role="img" aria-label="${esc(spec[1])}, illustrated ${side}, ${year}"><defs><radialGradient id="${id}-rim" cx="30%" cy="20%"><stop stop-color="${outer[0]}"/><stop offset=".6" stop-color="${outer[1]}"/><stop offset="1" stop-color="${outer[2]}"/></radialGradient><linearGradient id="${id}-metal" x2=".8" y2="1"><stop stop-color="${inner[0]}"/><stop offset=".45" stop-color="${inner[1]}"/><stop offset=".7" stop-color="${inner[0]}"/><stop offset="1" stop-color="${inner[2]}"/></linearGradient><path id="${id}-arc" d="M15 65A45 45 0 1 1 105 65"/></defs><circle cx="60" cy="60" r="58" fill="url(#${id}-rim)" stroke="${outer[2]}" stroke-width="1.5"/><circle cx="60" cy="60" r="${euro?44:52}" fill="url(#${id}-metal)" stroke="${outer[2]}" stroke-width=".8"/><circle cx="60" cy="60" r="55" fill="none" stroke="${outer[0]}" stroke-width="1.4" stroke-dasharray=".6 2.1"/><g fill="none" stroke="${inner[2]}" color="${inner[2]}" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round">${art}</g><text font-family="Georgia,serif" font-size="${euro?6:8}" font-weight="700" letter-spacing="1.1" fill="${outer[2]}"><textPath href="#${id}-arc" startOffset="50%" text-anchor="middle">${esc(header)}</textPath></text><text x="60" y="101" text-anchor="middle" font-family="Georgia,serif" font-size="${side==='Heads'?10:8}" font-weight="700" letter-spacing="1" fill="${outer[2]}">${esc(lower)}</text>${!euro&&side==='Heads'?`<text x="60" y="19" font-family="Georgia" font-size="4" text-anchor="middle" fill="${inner[2]}">IN GOD WE TRUST</text>`:''}</svg>`;
}
