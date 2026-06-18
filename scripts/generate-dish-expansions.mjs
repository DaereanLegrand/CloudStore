import { readFileSync, writeFileSync } from 'fs'

const recipes = JSON.parse(readFileSync('scripts/output/nestle-recipes.json', 'utf-8'))

const STOP_WORDS = new Set([
  'con','para','sin','las','los','una','unas','unos','del','que','por','mas',
  'como','hacer','cómo','receta','casera','fácil','rápido','tradicional',
  'delicioso','perfecto','aprende','preparar','clásico','clásica','fresco',
  'fresca','casero','casera','fáciles','todo','todos','más','muy','bien',
  'este','esta','estos','estas','ese','esa','esos','esas','aquel','aquella',
  'el','la','lo','le','se','te','me','nos','les','su','sus','tu','mis',
  'tus','nuestro','nuestra','nuestros','nuestras','de','en','al','a','e',
  'i','o','u','y','ni','pero','sino','porque','cuando','donde','como',
])

const generated = []

for (const r of recipes) {
  if (!r.ingredients || r.ingredients.length === 0) continue

  const wordCount = {}
  for (const ing of r.ingredients) {
    const name = ing.nombre.toLowerCase()
      .replace(/[®©™]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    const words = name.split(/\s+/).filter(w => w.length > 2 && !STOP_WORDS.has(w))
    for (const w of words) wordCount[w] = (wordCount[w] || 0) + 1
  }

  const sorted = Object.entries(wordCount).sort((a, b) => b[1] - a[1])
  const top = sorted.slice(0, 8).map(([word]) => word)

  if (top.length >= 2) {
    const slug = r.slug

    // Also generate from the recipe title for better matching
    const titleWords = r.titulo.toLowerCase()
      .replace(/[¿?!¡®©™,.]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w) && !w.startsWith('maggi') && !w.startsWith('nestlé') && !w.startsWith('nestle'))
      .slice(0, 4)
      .join(' ')

    generated.push({
      slug,
      keywords: [slug.replace(/-/g, ' '), titleWords].filter(Boolean),
      replacement: top.join(' OR '),
      titulo: r.titulo
    })
  }
}

const output = generated.map(g =>
  `  { keywords: [${g.keywords.map(k => `"${k}"`).join(', ')}], replacement: "${g.replacement}" },`
).join('\n')

const code = `// Auto-generated dish→ingredient expansions (${generated.length} recipes)
[
${output}
]`

writeFileSync('scripts/output/dish-expansions.txt', code)
console.log(`Generated ${generated.length} dish expansions`)
console.log('Saved to scripts/output/dish-expansions.txt')
console.log('')
console.log('Sample entries:')
generated.slice(0, 5).forEach(g => console.log(`  "${g.keywords[0]}" → ${g.replacement.replace(/ OR /g, ', ')}`))
