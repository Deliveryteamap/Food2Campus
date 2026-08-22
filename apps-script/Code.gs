/**
 * DAILY BIRYANI - production Google Apps Script backend
 *
 * Bind this script to the Google Spreadsheet used for orders:
 * Extensions -> Apps Script
 *
 * Run setup() once after replacing this file.
 * Run setInitialAdminPassword() once.
 * Deploy as Web app -> Execute as Me -> Anyone.
 */

const CONFIG = {
  SPREADSHEET_ID: '1d8sdUR6jnT8UFwycfjvH6AgNEIYcez-d0Ko5VqG7Jpc',
  ORDERS_SHEET: 'Orders',
  MENU_SHEET: 'Menu',
  SETTINGS_SHEET: 'Settings',
  RECEIPTS_FOLDER: 'Daily Biryani Receipts',
  MENU_IMAGES_FOLDER: 'Daily Biryani Menu Images',
  ADMIN_USERNAME: 'Deliveryteam',
  TIMEZONE: 'Asia/Kolkata',
  SESSION_TTL_SECONDS: 21600,
  MAX_RECEIPT_BYTES: 5 * 1024 * 1024,
  MAX_MENU_IMAGE_BYTES: 3 * 1024 * 1024
};

const ORDER_HEADERS = [
  'Order ID','Order Date','Order Time','Customer Name','Phone','Area','Delivery Address','Landmark',
  'Items','Total Amount','Payment Method','Receipt URL','Payment Status','Food Ready','Order Status',
  'Special Instructions','Delivery Date'
];

const MENU_HEADERS = ['Item ID','Item Name','Price','Category','Available','Description','Image URL'];

const DEFAULT_MENU = [
  ['B001','Fry Biryani (Bilal Resturent)',210,'Biryani',true,'Aromatic biryani with rich spices.',''],
  ['B002','Mixed Biryani (Bilal Resturent)',210,'Biryani',true,'A flavorful mixed biryani.',''],
  ['B003','Dum Biryani (Bilal Resturent)',200,'Biryani',true,'Slow-cooked dum biryani.',''],
  ['V001','Veg Fried Rice',110,'Veg Fast Food',true,'Fresh vegetables tossed with seasoned rice.',''],
  ['V002','Veg Noodles',110,'Veg Fast Food',true,'Stir-fried noodles with fresh vegetables.',''],
  ['V003','Veg Manchurian',120,'Veg Fast Food',true,'Crispy vegetable manchurian in savory sauce.',''],
  ['V004','Veg Manchurian Noodles',120,'Veg Fast Food',true,'Noodles served with vegetable manchurian.',''],
  ['F001','Chicken Manchurian Fried Rice',150,'Fast Food',true,'Fried rice with chicken manchurian.',''],
  ['F002','Chicken Fried Rice',120,'Fast Food',true,'Classic chicken fried rice.',''],
  ['F003','Chicken Shawarma (Bilal Resturent)',120,'Fast Food',true,'Chicken shawarma with fresh fillings.',''],
  ['F004','Egg Noodles',120,'Fast Food',true,'Noodles tossed with egg and seasoning.',''],
  ['F005','Egg Fried Rice',120,'Fast Food',true,'Fried rice prepared with egg.',''],
  ['F006','Egg Manchurian Fried Rice',130,'Fast Food',true,'Fried rice with egg manchurian.',''],
  ['F007','Double Egg Chicken Noodles',130,'Fast Food',true,'Chicken noodles with double egg.',''],
  ['F008','Chicken Noodles',120,'Fast Food',true,'Classic chicken noodles.',''],
  ['F009','Double Egg Chicken Fried Rice',130,'Fast Food',true,'Chicken fried rice with double egg.',''],
  ['F010','Egg Manchurian',120,'Fast Food',true,'Egg manchurian in savory sauce.',''],
  ['F011','Double Egg Fried Rice',130,'Fast Food',true,'Fried rice with double egg.',''],
  ['D001','Thums Up (250 ml)',30,'Cool Drinks',true,'250 ml bottle.',''],
  ['E001','Raw Eggs',10,'Eggs',true,'₹10 per egg.',''],
  ['J001','Sugar Cane Juice',60,'Juice',true,'300 ml bottle.','']
];

function doGet() {
  return json({ok:true, service:'Daily Biryani API', time:new Date().toISOString()});
}

function doPost(e) {
  try {
    const p = e && e.parameter ? e.parameter : {};
    const action = p.action || '';
    switch (action) {
      case 'getMenu': return json({ok:true, menu:getMenu_()});
      case 'createOrder': return json(createOrder_(p));
      case 'login': return json(login_(p));
      case 'getOrders': requireAuth_(p.token); return json({ok:true, orders:getOrders_()});
      case 'updateOrder': requireAuth_(p.token); return json(updateOrder_(p));
      case 'saveMenu': requireAuth_(p.token); return json(saveMenu_(p));
      case 'addMenuItem': requireAuth_(p.token); return json(addMenuItem_(p));
      case 'uploadMenuImage': requireAuth_(p.token); return json(uploadMenuImage_(p));
      case 'changePassword': requireAuth_(p.token); return json(changePassword_(p));
      default: return json({ok:false,error:'Unknown action.'});
    }
  } catch (err) {
    console.error(err);
    return json({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function setup() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const orders = getOrCreateSheet_(ss, CONFIG.ORDERS_SHEET);
  ensureHeaders_(orders, ORDER_HEADERS);
  migrateHeaders_(orders, ORDER_HEADERS);

  const menu = getOrCreateSheet_(ss, CONFIG.MENU_SHEET);
  if (menu.getLastRow() === 0) {
    menu.getRange(1,1,1,MENU_HEADERS.length).setValues([MENU_HEADERS]);
    menu.getRange(2,1,DEFAULT_MENU.length,MENU_HEADERS.length).setValues(DEFAULT_MENU);
  } else {
    migrateMenuSheet_(menu);
  }

  const settings = getOrCreateSheet_(ss, CONFIG.SETTINGS_SHEET);
  ensureHeaders_(settings, ['Key','Value']);
  setSettingIfMissing_(settings,'BusinessName','Daily Biryani');
  setSettingIfMissing_(settings,'OrderCutoff','18:00');
  setSettingIfMissing_(settings,'AdminUsername',CONFIG.ADMIN_USERNAME);
  getOrCreateReceiptFolder_();
  getOrCreateMenuImagesFolder_();
  return 'Setup complete. Run setInitialAdminPassword() if needed, then deploy the web app.';
}

function setInitialAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt('Daily Biryani Admin', 'Enter the initial admin password:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return 'Cancelled.';
  const password = result.getResponseText();
  validatePassword_(password);
  const salt = randomHex_(16);
  PropertiesService.getScriptProperties().setProperties({
    ADMIN_SALT: salt,
    ADMIN_PASSWORD_HASH: hash_(password,salt)
  }, true);
  return 'Admin password saved securely.';
}

function login_(p) {
  const username = String(p.username || '').trim();
  const password = String(p.password || '');
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('ADMIN_SALT');
  const hash = props.getProperty('ADMIN_PASSWORD_HASH');
  if (!salt || !hash) throw new Error('Admin is not initialized. Run setInitialAdminPassword() in Apps Script.');
  if (username !== CONFIG.ADMIN_USERNAME || !constantTimeEqual_(hash,hash_(password,salt))) throw new Error('Invalid username or password.');
  const token = Utilities.getUuid() + Utilities.getUuid().replace(/-/g,'');
  const sessions = getSessions_();
  sessions[token] = Date.now() + CONFIG.SESSION_TTL_SECONDS * 1000;
  saveSessions_(sessions);
  return {ok:true,token};
}

function requireAuth_(token) {
  if (!token) throw new Error('Admin login required.');
  const sessions = getSessions_();
  const expiry = sessions[token];
  if (!expiry || Number(expiry) < Date.now()) {
    delete sessions[token];
    saveSessions_(sessions);
    throw new Error('Admin session expired. Please log in again.');
  }
  sessions[token] = Date.now() + CONFIG.SESSION_TTL_SECONDS * 1000;
  saveSessions_(sessions);
}

function changePassword_(p) {
  const oldPassword = String(p.oldPassword || '');
  const newPassword = String(p.newPassword || '');
  const props = PropertiesService.getScriptProperties();
  const salt = props.getProperty('ADMIN_SALT');
  const oldHash = props.getProperty('ADMIN_PASSWORD_HASH');
  if (!salt || !oldHash || !constantTimeEqual_(oldHash,hash_(oldPassword,salt))) throw new Error('Current password is incorrect.');
  validatePassword_(newPassword);
  const newSalt = randomHex_(16);
  props.setProperties({ADMIN_SALT:newSalt,ADMIN_PASSWORD_HASH:hash_(newPassword,newSalt)},true);
  return {ok:true};
}

function resetAdminPassword() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.prompt(
    'Reset Admin Password',
    'Enter your new admin password (minimum 10 characters):',
    ui.ButtonSet.OK_CANCEL
  );
  if (response.getSelectedButton() !== ui.Button.OK) {
    return;
  }
  const password = response.getResponseText();
  if (!password || password.length < 10) {
    ui.alert('Password must be at least 10 characters.');
    return;
  }
  const salt = Utilities.getUuid();
  const hash = hash_(password, salt);
  PropertiesService.getScriptProperties().setProperties({
    ADMIN_SALT: salt,
    ADMIN_PASSWORD_HASH: hash
  }, true);
  ui.alert('Admin password has been reset successfully.');
}

function createOrder_(p) {
  const customer = parseJson_(p.customer, {});
  const requestedItems = parseJson_(p.items, []);
  if (!customer.name || !/^\d{10}$/.test(String(customer.phone || ''))) throw new Error('Valid customer name and 10-digit phone are required.');
  if (!customer.area || !customer.address) throw new Error('Delivery area and address are required.');
  if (!Array.isArray(requestedItems) || !requestedItems.length) throw new Error('Select at least one item.');

  const menu = getMenu_();
  const map = {};
  menu.forEach(m => map[m.id] = m);
  let total = 0;
  const normalized = [];
  requestedItems.forEach(x => {
    const id = String(x.id || '');
    const qty = Number(x.qty);
    if (!map[id] || !map[id].available) throw new Error('One of the selected items is unavailable. Please refresh the menu.');
    if (!Number.isInteger(qty) || qty < 1 || qty > 20) throw new Error('Invalid quantity.');
    total += map[id].price * qty;
    normalized.push({id,name:map[id].name,price:map[id].price,qty});
  });
  if (Number(p.total) !== total) throw new Error('Order total changed. Please refresh and try again.');

  const receiptBase64 = String(p.receiptBase64 || '');
  if (!receiptBase64) throw new Error('Payment receipt is required.');
  const bytes = Utilities.base64Decode(receiptBase64);
  if (bytes.length > CONFIG.MAX_RECEIPT_BYTES) throw new Error('Receipt is too large. Maximum 5 MB.');
  const receiptType = String(p.receiptType || 'image/jpeg');
  if (!/^image\/(jpeg|png|webp)$|^application\/pdf$/.test(receiptType)) throw new Error('Only JPG, PNG, WEBP or PDF receipts are allowed.');

  const orderId = makeOrderId_();
  const receiptName = sanitizeFileName_(String(p.receiptName || 'payment-receipt'));
  const blob = Utilities.newBlob(bytes,receiptType,orderId + '_' + receiptName);
  const file = getOrCreateReceiptFolder_().createFile(blob);
  file.setDescription('Payment receipt for ' + orderId);

  const now = new Date();
  const tz = CONFIG.TIMEZONE;
  const itemsText = normalized.map(x=>x.name+' × '+x.qty).join(', ');
  const row = [
    orderId, Utilities.formatDate(now,tz,'yyyy-MM-dd'), Utilities.formatDate(now,tz,'HH:mm:ss'), String(customer.name).trim(),
    String(customer.phone).trim(), String(customer.area).trim(), String(customer.address).trim(), String(customer.landmark||'').trim(),
    itemsText, total, 'UPI QR', file.getUrl(), 'Pending', false, 'New', String(customer.instructions||'').trim(), Utilities.formatDate(new Date(now.getTime()+24*60*60*1000),tz,'yyyy-MM-dd')
  ];
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.ORDERS_SHEET);
  sheet.appendRow(row);
  return {ok:true,orderId};
}

function getOrders_() {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.ORDERS_SHEET);
  if (!sheet || sheet.getLastRow()<2) return [];
  const lastCol = Math.max(ORDER_HEADERS.length, sheet.getLastColumn());
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,lastCol).getDisplayValues();
  const today = Utilities.formatDate(new Date(), CONFIG.TIMEZONE, 'yyyy-MM-dd');
  return values.filter(r=>String(r[1])===today).reverse().map(r=>({
    orderId:r[0],orderDate:r[1],orderTime:r[2],customerName:r[3],phone:r[4],area:r[5],address:r[6],landmark:r[7],items:r[8],
    totalAmount:Number(String(r[9]).replace(/[^0-9.-]/g,''))||0,paymentMethod:r[10],receiptUrl:r[11],paymentStatus:r[12]||'Pending',
    foodReady: String(r[13]).toLowerCase()==='true' || String(r[13]).toLowerCase()==='yes', orderStatus:r[14]||'New',instructions:r[15],deliveryDate:r[16]
  }));
}

function updateOrder_(p) {
  const id=String(p.orderId||''), field=String(p.field||'');
  let value = p.value;
  if (field === 'foodReady') value = String(value).toLowerCase()==='true';
  else value = String(value||'');
  const allowed={
    paymentStatus:['Pending','Verified','Rejected'],
    foodReady:[true,false],
    orderStatus:['New','Confirmed','Preparing','Ready','Out for Delivery','Delivered','Cancelled']
  };
  if(!allowed[field] || !allowed[field].some(v=>String(v)===String(value))) throw new Error('Invalid order update.');
  const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.ORDERS_SHEET);
  if(!sheet || sheet.getLastRow()<2) throw new Error('Order not found.');
  const ids=sheet.getRange(2,1,sheet.getLastRow()-1,1).getDisplayValues().flat();
  const idx=ids.indexOf(id);if(idx<0)throw new Error('Order not found.');
  const col=field==='paymentStatus'?13:(field==='foodReady'?14:15);
  sheet.getRange(idx+2,col).setValue(value);
  if(field==='foodReady' && value===true) sheet.getRange(idx+2,15).setValue('Ready');
  if(field==='paymentStatus' && value==='Verified') sheet.getRange(idx+2,15).setValue('Confirmed');
  return {ok:true};
}

function getMenu_(){
  const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.MENU_SHEET);
  if(!sheet||sheet.getLastRow()<2)return [];
  migrateMenuSheet_(sheet);
  const values=sheet.getRange(2,1,sheet.getLastRow()-1,MENU_HEADERS.length).getValues();
  return values.map(r=>({
    id:String(r[0]),name:String(r[1]),price:Number(r[2])||0,category:String(r[3]||'Other'),
    available:r[4]===true||String(r[4]).toLowerCase()==='true',description:String(r[5]||''),imageUrl:String(r[6]||'')
  }));
}

function saveMenu_(p){
  const menu=parseJson_(p.menu,[]);if(!Array.isArray(menu)||!menu.length)throw new Error('Menu cannot be empty.');
  const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.MENU_SHEET);
  migrateMenuSheet_(sheet);
  if(sheet.getMaxRows()>1) sheet.getRange(2,1,sheet.getMaxRows()-1,MENU_HEADERS.length).clearContent();
  sheet.getRange(2,1,menu.length,MENU_HEADERS.length).setValues(menu.map(m=>[
    String(m.id),String(m.name).trim(),Number(m.price),String(m.category||'Other').trim(),Boolean(m.available),String(m.description||'').trim(),String(m.imageUrl||'')
  ]));
  return {ok:true,menu:getMenu_()};
}

function addMenuItem_(p){
  const name=String(p.name||'').trim();
  const price=Number(p.price);
  const category=String(p.category||'').trim();
  const description=String(p.description||'').trim();
  const imageUrl=String(p.imageUrl||'').trim();
  if(!name)throw new Error('Item name is required.');
  if(!Number.isFinite(price)||price<0)throw new Error('Enter a valid price.');
  if(!category)throw new Error('Category is required.');
  const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(CONFIG.MENU_SHEET);
  migrateMenuSheet_(sheet);
  const existing=getMenu_();
  if(existing.some(x=>x.name.toLowerCase()===name.toLowerCase()))throw new Error('An item with this name already exists.');
  const id='M'+Utilities.getUuid().replace(/-/g,'').slice(0,8).toUpperCase();
  sheet.appendRow([id,name,price,category,true,description,imageUrl]);
  return {ok:true,item:{id,name,price,category,available:true,description,imageUrl}};
}

function uploadMenuImage_(p){
  const b64=String(p.base64||'');
  const type=String(p.type||'image/jpeg');
  const name=sanitizeFileName_(String(p.name||'menu-image.jpg'));
  if(!b64)throw new Error('Image data is missing.');
  if(!/^image\/(jpeg|png|webp)$/.test(type))throw new Error('Menu images must be JPG, PNG or WEBP.');
  const bytes=Utilities.base64Decode(b64);
  if(bytes.length>CONFIG.MAX_MENU_IMAGE_BYTES)throw new Error('Menu image is too large. Maximum 3 MB.');
  const folder=getOrCreateMenuImagesFolder_();
  const file=folder.createFile(Utilities.newBlob(bytes,type,name));
  file.setDescription('Daily Biryani menu image');
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e) {}
  const id=file.getId();
  return {ok:true,fileId:id,imageUrl:'https://drive.google.com/thumbnail?id='+encodeURIComponent(id)+'&sz=w800'};
}

function migrateMenuSheet_(sheet){
  if(sheet.getMaxColumns()<MENU_HEADERS.length){
    sheet.insertColumnsAfter(sheet.getMaxColumns(), MENU_HEADERS.length-sheet.getMaxColumns());
  }
  if(sheet.getLastRow()===0){
    sheet.getRange(1,1,1,MENU_HEADERS.length).setValues([MENU_HEADERS]);
  }
  if(sheet.getLastRow()>=1){
    const current=sheet.getRange(1,1,1,MENU_HEADERS.length).getValues()[0];
    const merged=MENU_HEADERS.map((h,i)=>current[i]||h);
    sheet.getRange(1,1,1,MENU_HEADERS.length).setValues([merged]);
    sheet.setFrozenRows(1);
    sheet.getRange(1,1,1,MENU_HEADERS.length).setFontWeight('bold');
  }
}

function migrateHeaders_(sheet,headers){
  if(sheet.getLastColumn()<headers.length) sheet.insertColumnsAfter(sheet.getLastColumn()||1,headers.length-Math.max(1,sheet.getLastColumn()));
  const current=sheet.getRange(1,1,1,headers.length).getValues()[0];
  const merged=headers.map((h,i)=>current[i]||h);
  sheet.getRange(1,1,1,headers.length).setValues([merged]);
  sheet.setFrozenRows(1);
  sheet.getRange(1,1,1,headers.length).setFontWeight('bold');
}

function getOrCreateSheet_(ss,name){return ss.getSheetByName(name)||ss.insertSheet(name)}
function ensureHeaders_(sheet,headers){if(sheet.getLastRow()===0){sheet.getRange(1,1,1,headers.length).setValues([headers]);sheet.setFrozenRows(1);sheet.getRange(1,1,1,headers.length).setFontWeight('bold')}}
function setSettingIfMissing_(sheet,key,value){const lastRow=sheet.getLastRow();if(lastRow<2){sheet.appendRow([key,value]);return}const vals=sheet.getRange(2,1,lastRow-1,2).getValues();if(!vals.some(r=>String(r[0]).trim()===String(key).trim()))sheet.appendRow([key,value])}
function getOrCreateReceiptFolder_(){return getOrCreateFolder_(CONFIG.RECEIPTS_FOLDER,'RECEIPT_FOLDER_ID')}
function getOrCreateMenuImagesFolder_(){return getOrCreateFolder_(CONFIG.MENU_IMAGES_FOLDER,'MENU_IMAGES_FOLDER_ID')}
function getOrCreateFolder_(name,propKey){const props=PropertiesService.getScriptProperties();const id=props.getProperty(propKey);if(id){try{return DriveApp.getFolderById(id)}catch(e){}}const it=DriveApp.getFoldersByName(name);const folder=it.hasNext()?it.next():DriveApp.createFolder(name);props.setProperty(propKey,folder.getId());return folder}
function makeOrderId_(){const lock=LockService.getScriptLock();lock.waitLock(10000);try{const p=PropertiesService.getScriptProperties();const n=(Number(p.getProperty('LAST_ORDER_NUMBER'))||1000)+1;p.setProperty('LAST_ORDER_NUMBER',String(n));return 'ORD'+n}finally{lock.releaseLock()}}
function parseJson_(s,fallback){try{return typeof s==='string'?JSON.parse(s):s}catch(e){return fallback}}
function json(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON)}
function validatePassword_(p){if(!p||p.length<10)throw new Error('Password must be at least 10 characters.')}
function hash_(value,salt){const bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,salt+value,Utilities.Charset.UTF_8);return bytes.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('')}
function randomHex_(n){return Utilities.getUuid().replace(/-/g,'').slice(0,n*2)}
function constantTimeEqual_(a,b){if(!a||!b||a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function sanitizeFileName_(name){return name.replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100)}
function getSessions_(){const raw=PropertiesService.getScriptProperties().getProperty('ADMIN_SESSIONS');if(!raw)return{};try{return JSON.parse(raw)}catch(e){return{}}}
function saveSessions_(sessions){const now=Date.now();Object.keys(sessions).forEach(k=>{if(Number(sessions[k])<now)delete sessions[k]});PropertiesService.getScriptProperties().setProperty('ADMIN_SESSIONS',JSON.stringify(sessions))}
