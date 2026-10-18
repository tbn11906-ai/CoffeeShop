const fs = require('fs');
const path = require('path');

function parseCSV(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let curr = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        curr += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push(curr.trim());
      curr = '';
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') i++;
      row.push(curr.trim());
      if (row.length > 1 || (row.length === 1 && row[0] !== '')) {
        lines.push(row);
      }
      row = [];
      curr = '';
    } else {
      curr += c;
    }
  }
  if (curr.length > 0 || row.length > 0) {
    row.push(curr.trim());
    lines.push(row);
  }
  return lines;
}

// Read Category CSV
const catFile = path.join(__dirname, '..', 'data', 'category.csv');
const catRaw = fs.readFileSync(catFile, 'utf8');
const catRows = parseCSV(catRaw);
const categories = [];
const categoryMap = {};

for (let i = 1; i < catRows.length; i++) {
  const [id, name, desc] = catRows[i];
  if (id) {
    const cat = {
      id: parseInt(id),
      name: name.trim(),
      slug: name.trim().toLowerCase().replace(/\s+/g, '-'),
      description: desc ? desc.trim() : ''
    };
    categories.push(cat);
    categoryMap[id] = cat;
  }
}

// Read Product CSV
const prodFile = path.join(__dirname, '..', 'data', 'product.csv');
const prodRaw = fs.readFileSync(prodFile, 'utf8');
const prodRows = parseCSV(prodRaw);

const products = [];
const bestSellers = [1, 7, 10, 12, 24, 28, 30, 31, 38, 44]; // ID của các món huyền thoại Highlands
const newItems = [16, 22, 23, 36, 37]; // Cold Brew Đào, Citrus Coffee, Trà quả mọng...

for (let i = 1; i < prodRows.length; i++) {
  const [id, name, price, image, description, published_date, category_id] = prodRows[i];
  if (!id) continue;

  const numId = parseInt(id);
  const numPrice = parseInt(price) || 0;
  const cleanImg = (image || '').replace(/^['"]|['"]$/g, '');
  const localImgPath = path.join(__dirname, '..', cleanImg);
  const exists = fs.existsSync(localImgPath);

  // Clean html tags from description for short preview
  const plainDesc = description
    ? description.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  const catObj = categoryMap[category_id] || { id: parseInt(category_id) || 0, name: 'Khác' };
  const isCake = catObj.id === 4;
  const isPhindi = name.toUpperCase().includes('PHINDI');
  const isBestSeller = bestSellers.includes(numId);
  const isNew = newItems.includes(numId);

  // Tag list for rich badges
  const tags = [];
  if (isBestSeller) tags.push('Best Seller');
  if (isNew) tags.push('Món Mới');
  if (isPhindi) tags.push('PhinDi');

  products.push({
    id: numId,
    name: name.trim(),
    price: numPrice,
    image: cleanImg,
    imageExists: exists,
    description: plainDesc,
    rawDescription: description || '',
    categoryId: catObj.id,
    categoryName: catObj.name,
    isCake: isCake,
    isPhindi: isPhindi,
    isBestSeller: isBestSeller,
    isNew: isNew,
    tags: tags,
    // Size prices:
    sizes: isCake
      ? [{ code: 'STANDARD', name: 'Tiêu chuẩn', extra: 0 }]
      : [
          { code: 'S', name: 'Size Vừa (S)', extra: 0 },
          { code: 'M', name: 'Size Lớn (M)', extra: 6000 },
          { code: 'L', name: 'Size Khổng Lồ (L)', extra: 10000 }
        ]
  });
}

// Available toppings
const toppings = [
  { id: 'top_thach_cafe', name: 'Thạch Cà Phê', price: 10000 },
  { id: 'top_kem_phomai', name: 'Kem Phô Mai (Macchiato)', price: 10000 },
  { id: 'top_hat_sen', name: 'Hạt Sen Thơm Bùi', price: 10000 },
  { id: 'top_cu_nang', name: 'Củ Năng Giòn', price: 10000 },
  { id: 'top_thach_dao', name: 'Thạch Đào Giòn', price: 10000 },
  { id: 'top_sot_caramel', name: 'Sốt Caramel Thơm Béo', price: 10000 },
  { id: 'top_espresso_shot', name: 'Thêm 1 Shot Espresso Đậm Đà', price: 12000 }
];

const jsDir = path.join(__dirname, '..', 'js');
if (!fs.existsSync(jsDir)) {
  fs.mkdirSync(jsDir, { recursive: true });
}

const dataContent = `/**
 * Highlands Coffee - Menu & Product Data
 * Auto-generated from data/product.csv & data/category.csv
 * Date: ${new Date().toISOString()}
 */

window.HIGHLANDS_DATA = {
  categories: ${JSON.stringify(categories, null, 2)},
  products: ${JSON.stringify(products, null, 2)},
  toppings: ${JSON.stringify(toppings, null, 2)},
  defaultPlaceholder: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Crect width='400' height='400' fill='%23FAF6F0'/%3E%3Ccircle cx='200' cy='180' r='90' fill='%23B22830' opacity='0.08'/%3E%3Cpath d='M140 150h120v60c0 33-27 60-60 60s-60-27-60-60v-60zm120 20h20a20 20 0 0 1 0 40h-20v-40z' fill='none' stroke='%23B22830' stroke-width='8' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M160 120c0-10 10-20 10-30m30 30c0-10 10-20 10-30m30 30c0-10 10-20 10-30' stroke='%23D4AF37' stroke-width='6' stroke-linecap='round'/%3E%3Ctext x='200' y='320' font-family='sans-serif' font-size='18' font-weight='bold' fill='%2353382C' text-anchor='middle'%3EHighlands Coffee%3C/text%3E%3C/svg%3E"
};
`;

fs.writeFileSync(path.join(jsDir, 'data.js'), dataContent, 'utf8');
console.log('Successfully generated js/data.js with ' + products.length + ' products and ' + categories.length + ' categories.');
