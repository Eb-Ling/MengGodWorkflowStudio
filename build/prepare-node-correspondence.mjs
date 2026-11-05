import fs from 'node:fs/promises';
import path from 'node:path';
import {nodeCorrespondence} from './node-correspondence.mjs';
const report=nodeCorrespondence(),out=path.resolve('build/verification/node-correspondence-'+Date.now());await fs.mkdir(out,{recursive:true});
for(const p of report.pixels){await fs.writeFile(path.join(out,p.name+'.frag'),p.actual);await fs.writeFile(path.join(out,p.name+'.reference.frag'),'#version 430\nin vec2 v_uv;out vec4 fragColor;void main(){fragColor='+p.expected+';}');}
await fs.writeFile(path.join(out,'report.json'),JSON.stringify({count:report.count,covered:report.covered,mappings:report.mappings,pixels:report.pixels.map(p=>p.name)},null,2));await fs.writeFile('build/verification/latest-node-correspondence.txt',out);console.log(out);
