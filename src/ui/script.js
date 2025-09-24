import {
  BOARD_SIZE,
  createEmptyBoard,
  checkWin,
  isBoardFull,
} from "../core/gomoku.js";

import { chooseAIMove } from "../ai/ai.js";
import { playerLabel, setCellLabel, selectCellElement, createCell, highlightWin } from "./dom.js";

let boardElement;
let statusElement;
let resetButton;
let optionsBtn;
let optionsPanel;
let optionsCloseBtn;
let optionsBackdrop;
let aiToggle;
let boardState = [];
let currentPlayer = "black";
let gameOver = false;
let vsAI = false;
const aiPlayer = "white"; // AI は白固定
let aiThinking = false;

// ---- 相槌設定（確率/頻度のオプション化） ----
const reactionConfig = {
  enabled: true,            // 相槌全体の有効/無効
  interjectProbability: 0.7,// プレイヤー着手ごとに発生する確率（0〜1）
  cooldownMs: 1200,         // 相槌と相槌の最小間隔(ms)
  minTurnsBetween: 0,       // 何手おきに発生可能か（プレイヤー着手ベース）
  phrases: [                // 相槌候補
    "なるほど…",
    "いい手だね！",
    "うーん、どう来るかな…",
    "面白い！",
    "読んでるね。",
  ],
  // AI手番のひとこと
  aiEnabled: true,
  aiProbability: 0.8,
  aiCooldownMs: 1000,
  aiMinTurnsBetween: 0,
  aiPhrases: [
    "ここかな！",
    "よし！",
    "これでどう？",
    "うん、いい感じ",
  ],
};

let playerMoveCount = 0;      // プレイヤーの着手回数（人間側）
let lastReactionAt = 0;       // 最後に相槌した時間
let lastReactMoveIndex = -99; // 最後に相槌したときのプレイヤー着手インデックス
let aiMoveCount = 0;          // AIの着手回数
let lastAISayAt = 0;          // 最後にAIが一言発した時間
let lastAISayMoveIndex = -99; // 最後にAIが一言発したときのAI着手インデックス

// 外部から設定を変更できるよう公開
window.vrmReactions = Object.assign(window.vrmReactions || {}, {
  config(next = {}) {
    const allow = [
      "enabled",
      "interjectProbability",
      "cooldownMs",
      "minTurnsBetween",
      "phrases",
      // AI手番
      "aiEnabled",
      "aiProbability",
      "aiCooldownMs",
      "aiMinTurnsBetween",
      "aiPhrases",
    ];
    for (const k of allow) if (k in next) reactionConfig[k] = next[k];
  },
  get() { return { ...reactionConfig }; },
});

function init() {
  boardElement = document.getElementById("board");
  statusElement = document.getElementById("status");
  resetButton = document.getElementById("reset");
  aiToggle = document.getElementById("aiToggle");
  optionsBtn = document.getElementById("optionsBtn");
  optionsPanel = document.getElementById("optionsPanel");
  optionsCloseBtn = document.getElementById("optionsClose");
  optionsBackdrop = document.getElementById("optionsBackdrop");

  if (!boardElement || !statusElement || !resetButton) {
    console.error("五目並べの要素が見つかりません。HTML を確認してください。");
    return;
  }

  boardElement.style.setProperty("--board-size", String(BOARD_SIZE));
  resetButton.addEventListener("click", resetGame);
  if (aiToggle) {
    aiToggle.addEventListener("change", () => {
      vsAI = aiToggle.checked;
      resetGame();
    });
    vsAI = aiToggle.checked;
  }
  if (optionsBtn && optionsPanel) {
    optionsBtn.addEventListener("click", openOptions);
  }
  if (optionsCloseBtn) {
    optionsCloseBtn.addEventListener("click", closeOptions);
  }
  if (optionsBackdrop) {
    optionsBackdrop.addEventListener("click", closeOptions);
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && optionsPanel && !optionsPanel.hasAttribute("hidden")) {
      closeOptions();
    }
  });
  resetGame();
}

function resetGame() {
  boardState = createEmptyBoard(BOARD_SIZE);
  currentPlayer = "black";
  gameOver = false;
  aiThinking = false;
  playerMoveCount = 0;
  lastReactionAt = 0;
  lastReactMoveIndex = -99;
  aiMoveCount = 0;
  lastAISayAt = 0;
  lastAISayMoveIndex = -99;
  if (aiToggle) {
    vsAI = aiToggle.checked;
  }
  statusElement.textContent = `${playerLabel(currentPlayer)}の番です`;
  boardElement.innerHTML = "";

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      boardElement.appendChild(createCell(row, col, handleCellClick));
    }
  }

  // 先手は黒なので、AI が白固定の限りここでの自動手は不要
  // VRM: 軽い挨拶（吹き出し）
  try {
    if (window.vrmChat && typeof window.vrmChat.say === "function") {
      if (vsAI) {
        window.vrmChat.say("よろしくね！勝負しよう。", { typeSpeed: 22, size: "large" });
      } else {
        window.vrmChat.say("ふたり対戦モードだよ。", { typeSpeed: 22, size: "large" });
      }
    }
  } catch (_) {}
}

// ---- Options panel wiring ----
function openOptions() {
  if (!optionsPanel) return;
  const gear = optionsBtn;
  if (gear) optionsPanel.setAttribute("aria-labelledby", "optionsTitle");
  // 相槌設定
  try {
    const rc = window.vrmReactions?.get ? window.vrmReactions.get() : reactionConfig;
    setChecked("reactEnabled", rc.enabled);
    setRange("reactProb", Math.round((rc.interjectProbability ?? 0) * 100));
    setNumber("reactCooldown", rc.cooldownMs ?? 1200);
    setNumber("reactTurns", rc.minTurnsBetween ?? 0);
    setTextarea("reactPhrases", (rc.phrases || []).join("\n"));
    // AI手番一言
    setChecked("aiSayEnabled", rc.aiEnabled ?? true);
    setRange("aiSayProb", Math.round((rc.aiProbability ?? 0) * 100));
    setNumber("aiSayCooldown", rc.aiCooldownMs ?? 1000);
    setNumber("aiSayTurns", rc.aiMinTurnsBetween ?? 0);
    setTextarea("aiSayPhrases", (rc.aiPhrases || []).join("\n"));
  } catch (_) {}
  // チャット設定（VRMがまだなら pending に貯める）
  try {
    const cc = window.vrmChat?.get ? window.vrmChat.get() : (window.__pendingVrmChatConfig || { preset: "head-left", size: "normal", enableLog: true, maxLogItems: 6 });
    setSelect("chatPreset", cc.preset || "head-left");
    setSelect("chatSize", cc.size || "normal");
    setChecked("chatEnableLog", !!cc.enableLog);
    setNumber("chatMaxLog", cc.maxLogItems ?? 6);
  } catch (_) {}
  optionsPanel.removeAttribute("hidden");
  if (optionsBackdrop) optionsBackdrop.removeAttribute("hidden");
  try { document.body.style.overflow = 'hidden'; } catch (_) {}
  // enforce popup positioning even if older CSS is cached
  try {
    optionsPanel.style.position = 'fixed';
    optionsPanel.style.left = '50%';
    optionsPanel.style.top = '50%';
    optionsPanel.style.transform = 'translate(-50%, -50%)';
    optionsPanel.style.zIndex = '2147483646';
    if (optionsBackdrop) {
      optionsBackdrop.style.position = 'fixed';
      optionsBackdrop.style.left = '0';
      optionsBackdrop.style.top = '0';
      optionsBackdrop.style.right = '0';
      optionsBackdrop.style.bottom = '0';
      optionsBackdrop.style.zIndex = '2147483645';
      optionsBackdrop.style.background = 'rgba(0,0,0,0.35)';
    }
  } catch (_) {}
  // イベントを初期化（重複防止のため一度だけバインド）
  bindOptionEventsOnce();
  // 初期フォーカス
  const firstFocus = byId("reactEnabled") || optionsCloseBtn || optionsPanel;
  try { firstFocus.focus(); } catch (_) {}
}

function closeOptions() {
  if (!optionsPanel) return;
  optionsPanel.setAttribute("hidden", "");
  if (optionsBackdrop) optionsBackdrop.setAttribute("hidden", "");
  try { document.body.style.overflow = ''; } catch (_) {}
  // 戻りフォーカス
  try { optionsBtn?.focus(); } catch (_) {}
}

let optionEventsBound = false;
function bindOptionEventsOnce() {
  if (optionEventsBound) return;
  optionEventsBound = true;
  byId("reactEnabled")?.addEventListener("change", () => applyReactionFromUI());
  byId("reactProb")?.addEventListener("input", () => applyReactionFromUI());
  byId("reactCooldown")?.addEventListener("change", () => applyReactionFromUI());
  byId("reactTurns")?.addEventListener("change", () => applyReactionFromUI());
  byId("reactPhrases")?.addEventListener("change", () => applyReactionFromUI());
  byId("aiSayEnabled")?.addEventListener("change", () => applyReactionFromUI());
  byId("aiSayProb")?.addEventListener("input", () => applyReactionFromUI());
  byId("aiSayCooldown")?.addEventListener("change", () => applyReactionFromUI());
  byId("aiSayTurns")?.addEventListener("change", () => applyReactionFromUI());
  byId("aiSayPhrases")?.addEventListener("change", () => applyReactionFromUI());

  const applyChat = () => applyChatFromUI();
  byId("chatPreset")?.addEventListener("change", applyChat);
  byId("chatSize")?.addEventListener("change", applyChat);
  byId("chatEnableLog")?.addEventListener("change", applyChat);
  byId("chatMaxLog")?.addEventListener("change", applyChat);
}

function applyReactionFromUI() {
  const enabled = !!getChecked("reactEnabled");
  const prob = Math.max(0, Math.min(100, getRange("reactProb") ?? 0)) / 100;
  const out = document.getElementById("reactProbOut");
  if (out) out.textContent = ` ${Math.round(prob * 100)}%`;
  const cooldown = Math.max(0, Number(getNumber("reactCooldown") ?? 0));
  const turns = Math.max(0, Number(getNumber("reactTurns") ?? 0));
  const phrasesRaw = String(getTextarea("reactPhrases") || "");
  const phrases = phrasesRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  // AI手番用
  const aiEnabled = !!getChecked("aiSayEnabled");
  const aiProb = Math.max(0, Math.min(100, getRange("aiSayProb") ?? 0)) / 100;
  const aiOut = document.getElementById("aiSayProbOut");
  if (aiOut) aiOut.textContent = ` ${Math.round(aiProb * 100)}%`;
  const aiCooldown = Math.max(0, Number(getNumber("aiSayCooldown") ?? 0));
  const aiTurns = Math.max(0, Number(getNumber("aiSayTurns") ?? 0));
  const aiPhrasesRaw = String(getTextarea("aiSayPhrases") || "");
  const aiPhrases = aiPhrasesRaw.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  try {
    window.vrmReactions?.config({
      enabled,
      interjectProbability: prob,
      cooldownMs: cooldown,
      minTurnsBetween: turns,
      phrases,
      aiEnabled,
      aiProbability: aiProb,
      aiCooldownMs: aiCooldown,
      aiMinTurnsBetween: aiTurns,
      aiPhrases,
    });
  } catch (_) {}
}

function applyChatFromUI() {
  const preset = String(getSelect("chatPreset") || "head-left");
  const size = String(getSelect("chatSize") || "normal");
  const enableLog = !!getChecked("chatEnableLog");
  const maxLogItems = Math.max(1, Number(getNumber("chatMaxLog") ?? 6));
  const next = { preset, size, enableLog, maxLogItems };
  if (window.vrmChat?.config) {
    try { window.vrmChat.config(next); } catch (_) {}
  } else {
    // VRM未初期化時は一時保存して、VRM側で受け取って適用
    window.__pendingVrmChatConfig = Object.assign(window.__pendingVrmChatConfig || {}, next);
  }
}

// small DOM helpers
function byId(id) { return document.getElementById(id); }
function setChecked(id, v) { const el = byId(id); if (el) el.checked = !!v; }
function setRange(id, v) { const el = byId(id); if (el) { el.value = String(v); const out = byId(id+"Out"); if (out) out.textContent = ` ${el.value}%`; } }
function setNumber(id, v) { const el = byId(id); if (el) el.value = String(v ?? ""); }
function setSelect(id, v) { const el = byId(id); if (el) el.value = String(v); }
function setTextarea(id, v) { const el = byId(id); if (el) el.value = String(v); }
function getChecked(id) { const el = byId(id); return el ? el.checked : false; }
function getRange(id) { const el = byId(id); return el ? Number(el.value) : undefined; }
function getNumber(id) { const el = byId(id); return el ? Number(el.value) : undefined; }
function getSelect(id) { const el = byId(id); return el ? el.value : undefined; }
function getTextarea(id) { const el = byId(id); return el ? el.value : undefined; }

// createCell moved to dom.js

function handleCellClick(row, col) {
  if (aiThinking) return;
  if (vsAI && currentPlayer === aiPlayer) return; // AI の手番中は無効
  applyMove(row, col);
  // VRM: プレイヤーの手にリアクション（AI対戦時）
  try {
    // currentPlayer === aiPlayer になっているタイミング＝人間が打った直後
    if (vsAI && !gameOver && typeof window.vrmChat?.say === "function" && currentPlayer === aiPlayer) {
      playerMoveCount += 1; // 人間の手をカウント

      if (!reactionConfig.enabled) return;

      // ターン間隔チェック（minTurnsBetween）
      const enoughTurns = (playerMoveCount - lastReactMoveIndex) > (reactionConfig.minTurnsBetween | 0);
      // クールダウンチェック
      const now = Date.now();
      const cooled = (now - lastReactionAt) >= Math.max(0, reactionConfig.cooldownMs | 0);
      // 確率チェック
      const probOK = Math.random() < Math.max(0, Math.min(1, reactionConfig.interjectProbability));

      if (enoughTurns && cooled && probOK) {
        const pool = Array.isArray(reactionConfig.phrases) && reactionConfig.phrases.length > 0
          ? reactionConfig.phrases
          : ["なるほど…"]; // フォールバック
        const msg = pool[Math.floor(Math.random() * pool.length)];
        window.vrmChat.say(msg, { typeSpeed: 26, size: "small", preset: "head-left", log: true });
        lastReactionAt = now;
        lastReactMoveIndex = playerMoveCount;
      }
    }
  } catch (_) {}
  maybeAIMove();
}

function applyMove(row, col) {
  if (gameOver || boardState[row][col]) {
    return false;
  }

  const cell = selectCellElement(boardElement, row, col);
  if (!cell) return false;

  boardState[row][col] = currentPlayer;
  cell.classList.add(currentPlayer);
  cell.dataset.filled = "true";
  setCellLabel(cell, currentPlayer);

  const winningLine = checkWin(boardState, row, col);
  if (winningLine) {
    highlightWin(boardElement, winningLine);
    statusElement.textContent = `${playerLabel(currentPlayer)}の勝ちです`;
    // VRM: 勝敗に応じて表情を切替（AIキャラ想定）
    try {
      if (vsAI && window.vrmFace) {
        if (currentPlayer === aiPlayer && typeof window.vrmFace.smile === "function") {
          // AIが勝利
          window.vrmFace.smile(5000, 0.9);
          if (window.vrmChat?.say) window.vrmChat.say("やった！私の勝ち！", { typeSpeed: 24 });
        } else if (currentPlayer !== aiPlayer && typeof window.vrmFace.sad === "function") {
          // AIが敗北
          window.vrmFace.sad(3000, 0.85);
          if (window.vrmChat?.say) window.vrmChat.say("ああ…負けちゃった。", { typeSpeed: 24 });
        }
      }
    } catch (_) {}
    gameOver = true;
    return true;
  }

  if (isBoardFull(boardState)) {
    statusElement.textContent = "引き分けです";
    try { if (vsAI && window.vrmChat?.say) window.vrmChat.say("引き分けだね。ナイスゲーム！", { typeSpeed: 24 }); } catch (_) {}
    gameOver = true;
    return true;
  }

  currentPlayer = currentPlayer === "black" ? "white" : "black";
  statusElement.textContent = `${playerLabel(currentPlayer)}の番です`;
  // VRM: 手番切り替えのタイミングで口を閉じる（形が残らないように）
  try {
    if (window.vrmTalk && typeof window.vrmTalk.close === "function") {
      window.vrmTalk.close();
    }
  } catch (_) {}
  return true;
}

// highlightWin, playerLabel, setCellLabel, selectCellElement moved to ./dom.js

function maybeAIMove() {
  if (!vsAI || gameOver || currentPlayer !== aiPlayer) return;
  aiThinking = true;
  // VRM: AI の手番中に口パクを少しだけ再生
  try {
    if (window.vrmTalk && typeof window.vrmTalk.start === "function") {
      window.vrmTalk.start(260);
    }
  } catch (_) {}
  setTimeout(() => {
    const start = Date.now();
    const choice = chooseAIMove(boardState, aiPlayer);
    const elapsed = Date.now() - start;
    const wait = Math.max(0, 200 - elapsed);
    (async () => {
      if (wait > 0) {
      await new Promise(resolve => setTimeout(resolve, wait));
      }
      if (choice) {
      const [r, c] = choice;
      applyMove(r, c);
      // VRM: 一言チャット（吹き出し）
      // AI手番の一言（確率/頻度の設定に従う）
      try {
        aiMoveCount += 1;
        if (vsAI && !gameOver && typeof window.vrmChat?.say === "function") {
          const cfg = reactionConfig;
          if (cfg.aiEnabled) {
            const turnsOK = (aiMoveCount - lastAISayMoveIndex) > (cfg.aiMinTurnsBetween | 0);
            const now = Date.now();
            const cooled = (now - lastAISayAt) >= Math.max(0, cfg.aiCooldownMs | 0);
            const probOK = Math.random() < Math.max(0, Math.min(1, cfg.aiProbability));
            if (turnsOK && cooled && probOK) {
              const pool = Array.isArray(cfg.aiPhrases) && cfg.aiPhrases.length > 0 ? cfg.aiPhrases : ["ここかな！"];
              const msg = pool[Math.floor(Math.random() * pool.length)];
              window.vrmChat.say(msg, { typeSpeed: 26, size: "small", preset: "head-right", log: true });
              lastAISayAt = now;
              lastAISayMoveIndex = aiMoveCount;
            }
          }
        }
      } catch (_) {}
      }
      aiThinking = false;
    })();
  }, 200);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
