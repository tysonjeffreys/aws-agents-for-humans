import { readFile } from 'node:fs/promises';
const names = ['app.mjs','components.mjs','theme.css','surface.css','manrope-latin.woff2','Manrope-OFL.txt'];
export function assetReader(root = new URL('../public/',import.meta.url)) {
  return async path => {
    const name = path === '/index.html' ? 'index.html' : names.find(name => path === '/assets/'+name);
    if (!name) return null;
    return {body:await readFile(new URL(name,root)),type:name.endsWith('.html') ? 'text/html; charset=utf-8' :
      name.endsWith('.css') ? 'text/css; charset=utf-8' : name.endsWith('.mjs') ? 'text/javascript; charset=utf-8' :
        name.endsWith('.woff2') ? 'font/woff2' : 'text/plain; charset=utf-8'};
  };
}
