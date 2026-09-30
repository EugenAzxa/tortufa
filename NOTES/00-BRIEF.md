# ТОРТУФА — sweet web magazine (mission brief)

**Goal:** a viral, editorial-magazine-style website for the cake shop behind https://tortufa.ru
(«Уфа Десерт» / кондитерский цех «Дионис», Ufa, Russia).

**Repo:** https://github.com/EugenAzxa/tortufa.git
**Local folder:** `c:\Users\dj_la\OneDrive\Рабочий стол\tortufa`

## Must-have features (from the user)
1. Web-magazine feel — editorial, not a plain shop.
2. **Click a cake → see how it looks inside** (cross-section / "разрез"). The viral hook.
3. **Interactive delivery map** — where they deliver.
4. **Mobile version** — first-class, not an afterthought.
5. 3D cakes if possible.

## Source facts (scraped from the live site)
- Brand: Интернет-магазин кондитерского цеха «Уфа Десерт» (компания «Дионис»)
- Tagline on site: «Дионис — сладкий вкус домашнего уюта»
- Phones: +7 (967) 747-21-14, +7 (927) 960-51-43
- Email: info@tortufa.ru
- Address: г. Уфа, ул. Гагарина 25/1 · 8:00–20:00
- Free delivery from 1000 ₽; 5% off orders over 3000 ₽
- 100+ product varieties, full-cycle production, no deep freezing
- Product lines: Готовые торты, Торты на заказ, К чаю (пирожные/печенье/кексы/пряники/
  чак-чак/баурсак/пироги), Полуфабрикаты, Постная продукция (vegan-ish, без яиц и молока)

## Data
- The live site is WordPress + WooCommerce and its **Store API is public**:
  `https://tortufa.ru/wp-json/wc/store/v1/products?per_page=100&page=N`
  `https://tortufa.ru/wp-json/wc/store/v1/products/categories?per_page=100`
- `tools/scrape.mjs` pulls it into `data/raw-products.json` (158 products) and
  `data/raw-categories.json` (17 categories).
- **Key insight:** every product's `short_description` lists weight + the real component
  stack, e.g. *«Вес: 1100 гр. Ванильный бисквит, воздушный крем-чиз, лимонный конфитюр,
  хрустящая меренга…»*. That text is parsed into an ordered layer stack (type + colour +
  texture) which drives BOTH the 2D cross-section and the 3D cake. Nothing is invented —
  the interiors are the actual recipes.
