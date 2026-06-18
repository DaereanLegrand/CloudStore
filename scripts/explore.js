import puppeteer from 'puppeteer'

const URL = 'https://www.plazavea.com.pe/aceite-de-oliva-valdeporres-extra-virgen-botella-250ml/p'

const browser = await puppeteer.launch({ headless: true })
const page = await browser.newPage()
await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 30000 })
await new Promise(r => setTimeout(r, 2000))

const data = await page.evaluate(() => {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  const ld = Array.from(scripts).map(s => s.textContent)
  const nextData = document.getElementById('__NEXT_DATA__')?.textContent
  const title = document.title
  const metaDesc = document.querySelector('meta[name="description"]')?.content
  const ogImage = document.querySelector('meta[property="og:image"]')?.content
  const ogPrice = document.querySelector('meta[property="product:price:amount"]')?.content
  const ogCurrency = document.querySelector('meta[property="product:price:currency"]')?.content
  return { ld, nextData, title, metaDesc, ogImage, ogPrice, ogCurrency }
})

console.log(JSON.stringify(data, null, 2))
await browser.close()
