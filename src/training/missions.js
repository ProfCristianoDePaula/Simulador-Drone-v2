import {courseMissions,preChecklist,postChecklist} from './catalog.js';
export const rubric=Object.freeze({preFlight:20,piloting:30,objectives:35,postFlight:15});
export const missions=courseMissions.map(m=>({...m,features:[...new Set(m.goals.map(g=>g.kind))],status:'available'}));
export const checklists={preFlight:preChecklist,postFlight:postChecklist};
