/* ---------- Utilities ---------- */
// Apply dark mode on every page load based on settings
document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
});

// Get a YYYY-MM-DD string for today (stable across refreshes)
function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Normalize Dictionary API response to { word, meaning, example }
function normalizeDictionaryEntry(apiData) {
  try {
    const entry = Array.isArray(apiData) ? apiData[0] : null;
    if (!entry || !entry.meanings || !entry.meanings.length) return null;

    // Find first definition with an example if possible
    let defObj = null;
    for (const m of entry.meanings) {
      const withExample = (m.definitions || []).find(d => d.example);
      if (withExample) { defObj = withExample; break; }
    }
    // Fallback: first available definition
    if (!defObj) {
      for (const m of entry.meanings) {
        if (m.definitions && m.definitions[0]) {
          defObj = m.definitions[0];
          break;
        }
      }
    }
    if (!defObj || !defObj.definition) return null;

    return {
      word: entry.word,
      meaning: defObj.definition,
      example: defObj.example || "No example available."
    };
  } catch {
    return null;
  }
}

/* ---------- API helpers ---------- */

// 1) Random word fetcher (better source)
// 1) Random word fetcher (better source)
async function fetchRandomWords(count = 2) {
  const url = `https://random-word-api.herokuapp.com/word?number=${count}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("API down");
    return res.json(); // ["apple","sky",...]
  } catch (err) {
    console.warn("⚠ Random Word API failed, using fallback list:", err);
    const fallbackWords = ["apple", "sky", "river", "music", "light"];
    // return as many as requested, cycling through fallbackWords
    return Array.from({ length: count }, (_, i) => 
      fallbackWords[i % fallbackWords.length]
    );
  }
}


// 2) Dictionary lookup
async function fetchDictionaryFor(word) {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const res = await fetch(url);
  if (!res.ok) return null; // some random words won't have entries
  return res.json();
}

// 3) Random words with retry
async function fetchValidRandomWords(count = 2, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randoms = await fetchRandomWords(count * 3); // fetch more candidates
    console.log("Candidate randoms:", randoms);

    const lookups = await Promise.all(
      randoms.map(async w => {
        const data = await fetchDictionaryFor(w);
        const normalized = normalizeDictionaryEntry(data);
        if (!normalized) console.log("No definition for:", w);
        return normalized;
      })
    );

    const validWords = lookups.filter(Boolean).slice(0, count);
    if (validWords.length) return validWords;
  }
  return [];
}

/* ---------- Rendering ---------- */

function displayWords(words) {
  const container = document.getElementById("wordContainer");
  if (!container) return;
  container.innerHTML = "";

  if (!words || !words.length) {
    container.innerHTML = `<div class="card"><p>Nothing to show.</p></div>`;
    return;
  }

  words.forEach(w => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${w.word}</h2>
      <p><strong>Meaning:</strong> ${w.meaning}</p>
      <p><strong>Example:</strong> ${w.example}</p>
      <button class="fav-btn">⭐ Add to Favorites</button>
    `;
    card.querySelector(".fav-btn").addEventListener("click", () => {
      saveFavorite(w);
      alert(`Added "${w.word}" to favorites!`);
    });
    container.appendChild(card);
  });
}

/* ---------- Favorites / History storage ---------- */

function saveFavorite(item) {
  const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
  // avoid duplicates by word+meaning
  const exists = favorites.some(f => f.word === item.word && f.meaning === item.meaning);
  if (!exists) {
    favorites.push(item);
    localStorage.setItem("favorites", JSON.stringify(favorites));
  }
}

function pushTodayToHistory(todayWords) {
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  const key = todayKey();

  // If the most recent history entry is for today, replace it; else unshift a new entry
  if (history.length && history[0].date === key) {
    history[0].words = todayWords;
  } else {
    history.unshift({ date: key, words: todayWords });
  }
  localStorage.setItem("history", JSON.stringify(history));
}

/* ---------- Page entry points ---------- */

// Called from index.html
async function loadWords() {
  const key = todayKey();
  const dailyWordCount = parseInt(localStorage.getItem("dailyWordCount") || "2", 10);

  const cachedDate = localStorage.getItem("lastDate");
  const cachedWords = JSON.parse(localStorage.getItem("todayWords") || "null");
  if (cachedDate === key && Array.isArray(cachedWords) && cachedWords.length) {
    displayWords(cachedWords);
    return;
  }

  const container = document.getElementById("wordContainer");
  if (container) container.innerHTML = `<div class="card"><p>Loading today's words…</p></div>`;

  const todayWords = await fetchValidRandomWords(dailyWordCount);
  if (!todayWords.length) {
    if (container) container.innerHTML = `<div class="card"><p>⚠ Could not load daily words. Try again.</p></div>`;
    return;
  }

  localStorage.setItem("todayWords", JSON.stringify(todayWords));
  localStorage.setItem("lastDate", key);
  pushTodayToHistory(todayWords);
  displayWords(todayWords);
}

// Called from history.html
function loadHistory() {
  const history = JSON.parse(localStorage.getItem("history") || "[]");
  const container = document.getElementById("historyContainer");
  if (!container) return;

  container.innerHTML = "";
  if (!history.length) {
    container.innerHTML = `<div class="card"><p>No history yet.</p></div>`;
    return;
  }

  history.forEach(entry => {
    const block = document.createElement("div");
    block.className = "card";
    block.innerHTML = `<h3>${entry.date}</h3>`;
    (entry.words || []).forEach(w => {
      const p = document.createElement("p");
      p.innerHTML = `<strong>${w.word}:</strong> ${w.meaning}`;
      block.appendChild(p);
    });
    container.appendChild(block);
  });
}

// Called from favorites.html
function loadFavorites() {
  const favorites = JSON.parse(localStorage.getItem("favorites") || "[]");
  const container = document.getElementById("favoritesContainer");
  if (!container) return;

  container.innerHTML = "";
  if (!favorites.length) {
    container.innerHTML = `<div class="card"><p>No favorites yet.</p></div>`;
    return;
  }

  favorites.forEach(w => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${w.word}</h2>
      <p>${w.meaning}</p>
      <p><em>${w.example}</em></p>
    `;
    container.appendChild(card);
  });
}

// Called from categories.html
async function loadCategory(topic) {
  lastCategory = topic; // ✅ save last chosen category
  const container = document.getElementById("categoryContainer");
  if (!container) return;
  container.innerHTML = `<p>Loading ${topic} words…</p>`;

  try {
    // Add randomization param to avoid repeated results
    const res1 = await fetch(`https://api.datamuse.com/words?topics=${topic}&max=10&v=enwiki`);
    const res2 = await fetch(`https://api.datamuse.com/words?ml=${topic}&max=10&v=enwiki`);
    if (!res1.ok || !res2.ok) throw new Error("Failed to fetch category words");

    const data1 = await res1.json();
    const data2 = await res2.json();
    const words = [...data1, ...data2].map(w => w.word);

    const lookups = await Promise.all(
      words.map(async w => {
        const dictData = await fetchDictionaryFor(w);
        return normalizeDictionaryEntry(dictData);
      })
    );

    const validWords = lookups.filter(Boolean);

    if (!validWords.length) {
      container.innerHTML = `<p>⚠ No valid words found for ${topic}, showing random instead.</p>`;
      const fallback = await fetchValidRandomWords(3);
      displayCategoryWords(fallback, container, topic);
      return;
    }

    displayCategoryWords(validWords.slice(0, 3), container, topic);

  } catch (err) {
    console.error("Error loading category:", err);
    container.innerHTML = `<p>⚠ Could not load words for ${topic}.</p>`;
  }
}

// New helper for refresh
function refreshCategory() {
  if (lastCategory) {
    loadCategory(lastCategory);
  }
}

// helper render
function displayCategoryWords(words, container, topic = null) {
  container.innerHTML = "";
  words.forEach(w => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h2>${w.word}</h2>
      <p><strong>Meaning:</strong> ${w.meaning}</p>
      <p><strong>Example:</strong> ${w.example}</p>
      <button class="fav-btn">⭐ Add to Favorites</button>
    `;
    card.querySelector(".fav-btn").addEventListener("click", () => {
      saveFavorite(w);
      alert(`Added "${w.word}" to favorites!`);
    });
    container.appendChild(card);
  });
}


/* Expose functions to global scope */
window.loadWords = loadWords;
window.loadHistory = loadHistory;
window.loadFavorites = loadFavorites;
window.loadCategory = loadCategory;
