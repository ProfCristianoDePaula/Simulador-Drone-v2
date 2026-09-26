import fs from 'node:fs';
import {courseMissions} from '../src/training/catalog.js';
const values=courseMissions.map(m=>`('${m.id}',${m.version},$mission$${JSON.stringify(m)}$mission$::jsonb,true)`).join(',\n');
fs.writeFileSync('supabase/migrations/202609240003_catalog.sql',`begin;\ninsert into public.academy_missions(id,version,config,published) values\n${values};\ncommit;\n`);
