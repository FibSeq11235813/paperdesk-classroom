export const TOOL_CATALOG={pen:'Pen',highlighter:'Highlighter',eraser:'Eraser',select:'Select / resize',point:'Point',line:'Line / arrows',rect:'Rectangle',ellipse:'Ellipse',compass:'Compass',protractor:'Protractor',pan:'Pan',zoom:'Zoom box',graph:'Graphing',coin:'Coin flip',dice:'Dice',random:'Random numbers',spinner:'Spinner wheel',names:'Name picker',counter:'Counter',tree:'Tree Diagram'};
export const WIDGET_TOOLS=['coin','dice','random','spinner','names','counter','tree'];
export const defaultToolPolicy=()=>Object.fromEntries(Object.keys(TOOL_CATALOG).map(key=>[key,true]));
export function normalizeToolPolicy(value){
 if(value===null||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid tool settings.');
 for(const [key,enabled] of Object.entries(value))if(!(key in TOOL_CATALOG)||typeof enabled!=='boolean')throw new Error('Invalid tool setting.');
 return {...defaultToolPolicy(),...value};
}
