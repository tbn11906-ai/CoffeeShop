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

// 1. Categories
const catFile = path.join(__dirname, '..', 'data', 'category.csv');
const catRaw = fs.readFileSync(catFile, 'utf8');
const catRows = parseCSV(catRaw);
const categories = {};
for (let i = 1; i < catRows.length; i++) {
  const [id, name, desc] = catRows[i];
  if (id) {
    categories[id] = { id: parseInt(id), name, description: desc || '' };
  }
}
console.log('Categories:', categories);

// 2. Products
const prodFile = path.join(__dirname, '..', 'data', 'product.csv');
const prodRaw = fs.readFileSync(prodFile, 'utf8');
const prodRows = parseCSV(prodRaw);
console.log('Product columns:', prodRows[0]);

const products = [];
const missingImages = [];
const existingImages = [];

for (let i = 1; i < prodRows.length; i++) {
  const [id, name, price, image, description, published_date, category_id] = prodRows[i];
  if (!id) continue;
  
  const cleanImage = (image || '').replace(/^['"]|['"]$/g, '');
  const localImgPath = path.join(__dirname, '..', cleanImage);
  const exists = fs.existsSync(localImgPath);

  if (exists) {
    existingImages.push({ id, name, cleanImage });
  } else {
    missingImages.push({ id, name, cleanImage });
  }

  products.push({
    id: parseInt(id),
    name: name,
    price: parseInt(price) || 0,
    image: cleanImage,
    imageExists: exists,
    description: description ? description.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : '',
    rawDescription: description || '',
    categoryId: parseInt(category_id),
    categoryName: categories[category_id] ? categories[category_id].name : 'Khác'
  });
}

console.log(`Total products parsed: ${products.length}`);
console.log(`Images found: ${existingImages.length}`);
console.log(`Images missing: ${missingImages.length}`);
if (missingImages.length > 0) {
  console.log('Missing items:', missingImages);
}
