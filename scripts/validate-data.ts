import { existsSync } from 'node:fs';
import { validateData } from '../src/data/validate.ts';

const issues = validateData({ iconExists: (f) => existsSync(`src/assets/poi/${f}`) });
for (const i of issues) console.log(`${i.level === 'error' ? '✖' : '⚠'} ${i.message}`);
const errors = issues.filter((i) => i.level === 'error').length;
console.log(`${errors} error(s), ${issues.length - errors} warning(s)`);
process.exit(errors ? 1 : 0);
