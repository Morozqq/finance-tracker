// GitHub Pages has no SPA rewrite: a cold load of /transactions returns 404.
// Serving a copy of index.html as 404.html lets the router take over.
import { copyFileSync } from 'node:fs'
import { resolve } from 'node:path'

const dist = resolve(process.cwd(), 'dist')
copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))
console.log('dist/404.html written')
