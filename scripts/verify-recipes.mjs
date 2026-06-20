import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, 'output')

function loadJSON(name) {
  const p = join(OUTPUT, name)
  if (!existsSync(p)) { console.error(`MISSING: ${name}`); return null }
  return JSON.parse(readFileSync(p, 'utf-8'))
}

function slug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function isValidUUID(s) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}

function pick100(recipes) {
  const sorted = [...recipes].sort((a, b) => slug(a.titulo).localeCompare(slug(b.titulo)))
  return sorted.slice(0, 100)
}

const recipes = loadJSON('nestle-recipes.json')
const mapping = loadJSON('ingredient-mapping.json')

if (!recipes || !mapping) {
  console.error('FAIL: Missing required data files')
  process.exit(1)
}

const mappingByRecipe = {}
for (const ing of mapping.ingredients) {
  if (!mappingByRecipe[ing.recipe_slug]) mappingByRecipe[ing.recipe_slug] = []
  mappingByRecipe[ing.recipe_slug].push(ing)
}

const toVerify = pick100(recipes)
console.log(`\n=== VERIFICATION: ${toVerify.length} recipes ===`)
console.log(`Total recipes in file: ${recipes.length}`)
console.log(`Total mapping ingredients: ${mapping.ingredients.length}\n`)

let passed = 0
let failed = 0
const failures = []
let totalIngredientChecks = 0
let totalProductChecks = 0

for (const recipe of toVerify) {
  const slug_ = recipe.slug || slug(recipe.titulo)
  let recipeOk = true
  const issues = []

  // Check recipe has required fields
  if (!recipe.titulo || !recipe.titulo.trim()) { issues.push('MISSING titulo'); recipeOk = false }
  if (!slug_ || !slug_.trim()) { issues.push('MISSING slug'); recipeOk = false }

  // Check instructions exist
  const hasInstructions = recipe.instrucciones && (
    (Array.isArray(recipe.instrucciones) && recipe.instrucciones.length > 0) ||
    (typeof recipe.instrucciones === 'string' && recipe.instrucciones.trim().length > 0)
  )
  if (!hasInstructions) issues.push('MISSING instrucciones (empty)')

  // Check nutrient fields exist
  if (recipe.calorias == null) issues.push('MISSING calorias')

  // Check ingredients
  const ings = mappingByRecipe[slug_] || []
  if (ings.length === 0) {
    issues.push('0 ingredients in mapping')
    recipeOk = false
  }
  totalIngredientChecks += ings.length

  for (const ing of ings) {
    // Check ingredient_raw exists
    if (!ing.ingredient_raw || !ing.ingredient_raw.trim()) {
      issues.push(`ingredient has empty ingredient_raw`)
      recipeOk = false
      continue
    }

    // Check product_id is valid UUID
    if (!ing.product_id || !isValidUUID(ing.product_id)) {
      issues.push(`"${ing.ingredient_raw.slice(0, 40)}" has INVALID product_id: ${ing.product_id}`)
      recipeOk = false
      continue
    }
    totalProductChecks++

    // Check cantidad_recipe
    if (ing.cantidad_recipe == null || isNaN(ing.cantidad_recipe) || Number(ing.cantidad_recipe) <= 0) {
      issues.push(`"${ing.ingredient_raw.slice(0, 40)}" cantidad_recipe=${ing.cantidad_recipe} INVALID`)
      recipeOk = false
    }

    // Check cantidad_producto
    if (ing.cantidad_producto == null || isNaN(ing.cantidad_producto) || Number(ing.cantidad_producto) <= 0) {
      issues.push(`"${ing.ingredient_raw.slice(0, 40)}" cantidad_producto=${ing.cantidad_producto} INVALID`)
      recipeOk = false
    }

    // Verify quantity correspondence
    if (ing.cantidad_recipe > 0 && ing.cantidad_producto > 0) {
      const ratio = ing.cantidad_producto / ing.cantidad_recipe
      if (ratio <= 0 || ratio > 100) {
        issues.push(`"${ing.ingredient_raw.slice(0, 40)}" ratio=${ratio.toFixed(4)} SUSPICIOUS (product_qty/recipe_qty out of range)`)
        recipeOk = false
      }
    }
  }

  if (recipeOk) {
    passed++
    console.log(`  ✓ ${recipe.titulo.slice(0, 50).padEnd(52)} | ${ings.length} ingredients, ${ings.filter(i => i.product_id && isValidUUID(i.product_id)).length} mapped`)
  } else {
    failed++
    failures.push({ recipe: recipe.titulo || slug_, issues })
    console.log(`  ✗ ${(recipe.titulo || slug_).slice(0, 50).padEnd(52)} | ${issues.length} issue(s)`)
  }
}

console.log(`\n=== RESULTS ===`)
console.log(`Recipes checked: ${toVerify.length}`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)
console.log(`Ingredient records checked: ${totalIngredientChecks}`)
console.log(`Product ID UUIDs validated: ${totalProductChecks}`)
console.log(`Mapping coverage: ${totalIngredientChecks > 0 ? (totalProductChecks / totalIngredientChecks * 100).toFixed(1) : 0}%\n`)

if (failures.length > 0) {
  console.log(`=== FAILURES (${failures.length}) ===`)
  for (const f of failures) {
    console.log(`\n${f.recipe}:`)
    for (const i of f.issues) console.log(`  - ${i}`)
  }
  process.exit(1)
} else {
  console.log('ALL 100 RECIPES VERIFIED OK')
  process.exit(0)
}
