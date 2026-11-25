import { createIndex } from './index'

const ix = createIndex()
ix.add('a', 'alpha beta gamma')
ix.add('b', 'alpha beta')

console.log('Infinity:', ix.search('alpha', Infinity))
console.log('NaN:', ix.search('alpha', NaN))
console.log('1.9:', ix.search('alpha', 1.9))
console.log('huge:', ix.search('alpha', 1e9).length)
console.log('empty query k=Inf:', ix.search('', Infinity))

const j = createIndex()
j.add('u', 'hej,värld')
console.log('unicode sep:', j.search('v', 5), j.search('hej', 5), j.search('värld', 5))

const d = createIndex()
d.add('d', 'version 2 and v2')
console.log('digits:', d.search('2', 5), d.search('v2', 5), d.search('version 2', 5))

const p = createIndex()
p.add('p', '!!! ???')
console.log('punct-only doc:', p.search('x', 5), p.search('', 5))

console.log('dupe query term:', ix.search('alpha alpha', 5))

// deep posting list: same term in every doc, plus a rare term
const big = createIndex()
for (let i = 0; i < 5000; i++) big.add('x' + i, 'common filler ' + (i === 4321 ? 'needle' : ''))
console.log('deep AND:', big.search('common needle', 10))
console.log('single common k=3:', big.search('common', 3))
