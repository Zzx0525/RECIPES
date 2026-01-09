// 定義食材清單
let ingredients = [];
let ingTypeMap = {};

// 定義食譜及其所需食材
let recipes = [];
let table, ingredientsTable;

function preload() {
  // 載入 CSV 檔案，設定 header 讓 p5.js 自動辨識欄位名稱
  table = loadTable('recipes.csv', 'csv', 'header');
  ingredientsTable = loadTable('ingredients.csv', 'csv', 'header');
}

let selectedIngredients = []; // 儲存使用者選取的食材
let ingredientButtons = []; // 儲存所有食材按鈕以便控制
let allBtn; // 全選按鈕
let searchInput; // 搜尋框
let resultStartY = 200; // 結果顯示區域的起始 Y 座標
let resultsContainer, leftCol, rightCol; // HTML 容器

// 分類相關變數
let activeIngCat = '全部'; // 目前選取的食材分類
let activeRecCat = '全部'; // 目前選取的食譜分類
let ingCatButtons = []; // 食材分類按鈕陣列
let recCatButtons = []; // 食譜分類按鈕陣列
let resetChecksBtn; // 重置勾選按鈕

const ingCategories = ['全部', '肉類', '菜類', '穀物', '其他'];
const recCategories = ['全部', '肉菜', '素菜', '甜品', '酒類'];

function setup() {
  noCanvas(); // 不再需要 Canvas，改用 HTML 排版
  
  // 建立主版面結構
  let mainLayout = createDiv('').class('main-layout');
  let topPanel = createDiv('').class('panel top-panel').parent(mainLayout);
  let bottomPanel = createDiv('').class('panel bottom-panel').parent(mainLayout);
  
  // 解析食材 CSV
  for (let r = 0; r < ingredientsTable.getRowCount(); r++) {
    let row = ingredientsTable.getRow(r);
    let name = row.getString('name');
    let category = row.getString('category').trim(); // 去除可能存在的空白或換行符號
    ingredients.push(name);
    ingTypeMap[name] = category;
  }

  // 解析 CSV 資料並轉換為 recipes 陣列格式
  for (let r = 0; r < table.getRowCount(); r++) {
    let row = table.getRow(r);
    recipes.push({
      name: row.getString('name'),
      required: row.getString('required').split(';'), // 使用分號分割食材
      category: row.getString('category').trim(), // 去除可能存在的空白或換行符號
      checked: false // 新增勾選狀態
    });
  }

  // 讀取 LocalStorage 中的勾選狀態
  let savedChecks = localStorage.getItem('checkedRecipes');
  if (savedChecks) {
    let checkedNames = JSON.parse(savedChecks);
    for (let r of recipes) {
      if (checkedNames.includes(r.name)) {
        r.checked = true;
      }
    }
  }

  // 讀取 LocalStorage 中的已選食材
  let savedIngredients = localStorage.getItem('selectedIngredients');
  if (savedIngredients) {
    selectedIngredients = JSON.parse(savedIngredients);
  }

  // --- 上半部內容 (食材選擇) ---
  createElement('h2', '華夏千秋食譜查詢器').parent(topPanel);
  createP('請點擊下方按鈕選擇你擁有的食材：').parent(topPanel);

  let topControls = createDiv('').class('controls-row').parent(topPanel);

  // 建立全選/全不選按鈕
  allBtn = createButton('全選 / 全不選').parent(topControls);
  allBtn.mousePressed(toggleAll);
  
  // 建立搜尋框
  searchInput = createInput('').parent(topControls);
  searchInput.attribute('placeholder', '搜尋食材...');
  searchInput.input(filterIngredients); // 改呼叫篩選函式
  
  let ingCatDiv = createDiv('').class('controls-row').parent(topPanel);
  
  // 建立食材分類按鈕
  for (let cat of ingCategories) {
    let btn = createButton(cat).parent(ingCatDiv);
    btn.mousePressed(() => {
      activeIngCat = cat;
      filterIngredients();
    });
    ingCatButtons.push(btn);
  }

  // 建立食材按鈕網格
  let ingGrid = createDiv('').class('ingredients-grid').parent(topPanel);

  // 根據食材清單建立按鈕
  for (let i = 0; i < ingredients.length; i++) {
    let btn = createButton(ingredients[i]).parent(ingGrid);
    ingredientButtons.push(btn); // 將按鈕存入陣列
    btn.size(80, 30);

    // 如果該食材在已選清單中，設定為選取樣式
    if (selectedIngredients.includes(ingredients[i])) {
      btn.style('background-color', '#FFD700');
    }
    
    // 設定按鈕點擊事件
    btn.mousePressed(() => toggleIngredient(ingredients[i], btn));
  }

  // --- 下半部內容 (食譜結果) ---
  let bottomHeader = createDiv('').class('controls-row').parent(bottomPanel);
  createElement('h3', '可製作的料理：').style('margin', '0 10px 0 0').parent(bottomHeader);

  // 建立食譜分類按鈕
  for (let cat of recCategories) {
    let btn = createButton(cat).parent(bottomHeader);
    btn.mousePressed(() => {
      activeRecCat = cat;
      // 更新按鈕樣式
      updateCategoryStyles(recCatButtons, activeRecCat);
      updateResults(); // 分類改變時更新結果
    });
    recCatButtons.push(btn);
  }
  updateCategoryStyles(recCatButtons, activeRecCat);
  
  // 建立重置勾選按鈕
  resetChecksBtn = createButton('重置勾選').parent(bottomHeader);
  resetChecksBtn.mousePressed(resetAllChecks);
  
  // 建立結果顯示區域的 HTML 容器
  resultsContainer = createDiv('').class('results-container').parent(bottomPanel);
  
  leftCol = createDiv('');
  leftCol.class('result-column');
  leftCol.parent(resultsContainer);
  
  rightCol = createDiv('');
  rightCol.class('result-column');
  rightCol.parent(resultsContainer);
  
  filterIngredients(); // 初始化食材顯示
  updateResults(); // 初始化列表
}

// 篩選食材按鈕顯示 (取代原本的 repositionUI)
function filterIngredients() {
  updateCategoryStyles(ingCatButtons, activeIngCat);

  let filterText = searchInput.value();

  for (let i = 0; i < ingredientButtons.length; i++) {
    let btn = ingredientButtons[i];
    let ingName = ingredients[i];
    let ingCat = ingTypeMap[ingName];
    
    // 檢查食材名稱是否包含搜尋文字 AND 符合目前分類
    let matchSearch = ingName.includes(filterText);
    let matchCat = (activeIngCat === '全部' || ingCat === activeIngCat);

    if (matchSearch && matchCat) {
      btn.show();
    } else {
      btn.hide();
    }
  }
}

// 輔助函式：更新分類按鈕樣式 (Highlight 選中的)
function updateCategoryStyles(buttons, activeCat) {
  for (let btn of buttons) {
    if (btn.html() === activeCat) {
      btn.style('background-color', '#87CEEB'); // 選中時變天藍色
      btn.style('color', 'white');
    } else {
      btn.style('background-color', ''); // 恢復預設
      btn.style('color', 'black');
    }
  }
}

// 切換食材選取狀態的函式
function toggleIngredient(ing, btn) {
  let index = selectedIngredients.indexOf(ing);
  if (index === -1) {
    // 如果未選取，則加入並改變按鈕顏色 (金色)
    selectedIngredients.push(ing);
    btn.style('background-color', '#FFD700');
  } else {
    // 如果已選取，則移除並恢復按鈕顏色
    selectedIngredients.splice(index, 1);
    btn.style('background-color', '');
  }
  localStorage.setItem('selectedIngredients', JSON.stringify(selectedIngredients));
  updateResults(); // 更新列表
}

// 全選/全不選功能
function toggleAll() {
  if (selectedIngredients.length === ingredients.length) {
    // 如果目前已經是全選狀態，則清空
    selectedIngredients = [];
    for (let btn of ingredientButtons) {
      btn.style('background-color', '');
    }
  } else {
    // 否則全部選取
    selectedIngredients = [...ingredients];
    for (let btn of ingredientButtons) {
      btn.style('background-color', '#FFD700');
    }
  }
  localStorage.setItem('selectedIngredients', JSON.stringify(selectedIngredients));
  updateResults(); // 更新列表
}

// 重置所有勾選狀態
function resetAllChecks() {
  if (confirm('確定要清除所有已完成的食譜標記嗎？')) {
    for (let r of recipes) {
      r.checked = false;
    }
    localStorage.removeItem('checkedRecipes');
    updateResults();
  }
}

// 更新食譜列表 (核心邏輯)
function updateResults() {
  // 清空目前內容
  leftCol.html('<h3>可製作的料理</h3>');
  rightCol.html('<h3>只差一樣食材</h3>');
  
  // 如果沒有食譜資料，直接返回
  if (recipes.length === 0) return;

  // 分類食譜：完全符合 vs 只差一樣
  let matched = [];
  let almostMatched = [];

  for (let r of recipes) {
    // 篩選食譜分類
    if (activeRecCat !== '全部' && r.category !== activeRecCat) {
      continue;
    }

    let missing = r.required.filter(req => !selectedIngredients.includes(req));
    if (missing.length === 0) {
      matched.push(r);
    } else if (missing.length === 1) {
      almostMatched.push({ recipe: r, missing: missing[0] });
    }
  }
  
  // 將已勾選的食譜排序到最後 (false=0 在前, true=1 在後)
  matched.sort((a, b) => a.checked - b.checked);

  // --- 產生左欄內容 (可製作) ---
  if (matched.length === 0) {
    leftCol.child(createDiv('目前食材無法組成已知食譜。').style('color', '#999'));
  } else {
    for (let r of matched) {
      let itemDiv = createDiv('');
      itemDiv.class('recipe-item');
      itemDiv.parent(leftCol);
      
      // 建立勾選框
      let chk = createCheckbox('', r.checked);
      chk.parent(itemDiv);
      chk.changed(() => {
        r.checked = chk.checked();
        // 儲存狀態
        let checkedNames = recipes.filter(x => x.checked).map(x => x.name);
        localStorage.setItem('checkedRecipes', JSON.stringify(checkedNames));
        // 重新排序並更新顯示
        updateResults();
      });
      
      // 食譜名稱
      let nameSpan = createSpan(r.name);
      nameSpan.class('recipe-name');
      if (r.checked) nameSpan.style('color', '#999').style('text-decoration', 'line-through');
      nameSpan.parent(itemDiv);
      
      // 食材細節
      let detailSpan = createSpan(`(需要: ${r.required.join(', ')})`);
      detailSpan.class('recipe-details');
      detailSpan.parent(itemDiv);
    }
  }

  // --- 產生右欄內容 (差一樣) ---
  if (almostMatched.length === 0) {
    rightCol.child(createDiv('無相關推薦。').style('color', '#999'));
  } else {
    for (let item of almostMatched) {
      let itemDiv = createDiv('');
      itemDiv.class('recipe-item');
      itemDiv.parent(rightCol);
      
      // 食譜名稱
      let nameSpan = createSpan(item.recipe.name);
      nameSpan.class('recipe-name');
      nameSpan.style('color', '#d35400'); // 橘色
      nameSpan.parent(itemDiv);
      
      // 缺少的食材
      let missingSpan = createSpan(`(缺: ${item.missing})`);
      missingSpan.style('color', '#e74c3c').style('font-weight', 'bold').style('font-size', '0.9em');
      missingSpan.parent(itemDiv);
    }
  }
}
